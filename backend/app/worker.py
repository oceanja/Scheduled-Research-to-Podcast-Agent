"""Scheduler + worker, both running inside the FastAPI process.

Scheduler (every minute):
    For every active briefing where next_run_at <= now + 5 min,
    insert a pending episode and advance next_run_at by one day.

Worker (every few seconds):
    Pick one pending episode with SELECT ... FOR UPDATE SKIP LOCKED,
    mark it generating, run the agent, upload audio, email the user.

Stuck-episode reset (every 5 min):
    Any episode stuck in `generating` for > 15 min is reset to `pending`
    so a crashed worker can't orphan an episode forever.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.agent import generate_episode
from app.db import pool
from app.email import send_episode_ready
from app.scheduling import next_run_at, today_in_tz
from app.storage import upload_audio

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


# ---------- Scheduler tick ----------

async def _enqueue_due_briefings() -> None:
    """Enqueue episodes for briefings due in the next 5 minutes."""
    async with pool().acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                select id, user_id, topic, run_time, timezone
                from briefings
                where is_active = true
                  and next_run_at is not null
                  and next_run_at <= now() + interval '5 minutes'
                for update skip locked
                """,
            )
            for r in rows:
                run_date = today_in_tz(r["timezone"])
                # Insert pending episode; ignore if today's slot already exists.
                await conn.execute(
                    """
                    insert into episodes (briefing_id, user_id, run_date, status)
                    values ($1, $2, $3, 'pending')
                    on conflict (briefing_id, run_date) do nothing
                    """,
                    r["id"], r["user_id"], run_date,
                )
                # Advance the schedule by one day (anchored on run_time/tz).
                new_nra = next_run_at(r["run_time"], r["timezone"])
                await conn.execute(
                    "update briefings set next_run_at = $1 where id = $2",
                    new_nra, r["id"],
                )
                log.info(
                    "scheduler: enqueued briefing=%s next_run_at=%s",
                    r["id"], new_nra,
                )


# ---------- Worker tick ----------

async def _process_one_episode() -> None:
    async with pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                select e.id, e.briefing_id, e.user_id, b.topic
                from episodes e
                join briefings b on b.id = e.briefing_id
                where e.status = 'pending'
                order by e.created_at asc
                limit 1
                for update of e skip locked
                """,
            )
            if not row:
                return
            await conn.execute(
                "update episodes set status = 'generating' where id = $1",
                row["id"],
            )

    episode_id: UUID = row["id"]
    briefing_id: UUID = row["briefing_id"]
    user_id: UUID = row["user_id"]
    topic: str = row["topic"]
    log.info("worker: generating episode=%s topic=%r", episode_id, topic)

    try:
        ep = await generate_episode(topic)
        audio_url = await upload_audio(user_id, episode_id, ep.audio_mp3)

        async with pool().acquire() as conn:
            await conn.execute(
                """
                update episodes
                set status = 'ready',
                    script = $1,
                    sources = $2,
                    audio_url = $3,
                    error = null
                where id = $4
                """,
                ep.script,
                [{"title": s.title, "url": s.url} for s in ep.sources],
                audio_url,
                episode_id,
            )

        # Fetch user's email via the auth.users table using service-role DB access.
        async with pool().acquire() as conn:
            user_email = await conn.fetchval(
                "select email from auth.users where id = $1", user_id
            )
        if user_email:
            from app.config import get_settings
            link = f"{get_settings().app_url}/episodes/{episode_id}"
            await send_episode_ready(user_email, topic, link)
        log.info("worker: episode=%s ready", episode_id)

    except Exception as exc:
        log.exception("worker: episode=%s failed", episode_id)
        async with pool().acquire() as conn:
            await conn.execute(
                "update episodes set status = 'failed', error = $1 where id = $2",
                str(exc)[:1000], episode_id,
            )


# ---------- Stuck-episode reset ----------

async def _reset_stuck_episodes() -> None:
    async with pool().acquire() as conn:
        affected = await conn.execute(
            """
            update episodes
            set status = 'pending'
            where status = 'generating'
              and updated_at < now() - interval '15 minutes'
            """,
        )
        if not affected.endswith(" 0"):
            log.warning("worker: reset stuck episodes: %s", affected)


# ---------- Lifecycle ----------

def start() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _enqueue_due_briefings,
        trigger="interval",
        minutes=1,
        id="scheduler",
        max_instances=1,
        coalesce=True,
    )
    sched.add_job(
        _process_one_episode,
        trigger="interval",
        seconds=5,
        id="worker",
        max_instances=1,
        coalesce=True,
    )
    sched.add_job(
        _reset_stuck_episodes,
        trigger="interval",
        minutes=5,
        id="reset-stuck",
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    _scheduler = sched
    log.info("worker: scheduler started")
    return sched


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("worker: scheduler stopped")
