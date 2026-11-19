from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.db import pool
from app.deps import CurrentUser, current_user
from app.schemas import BriefingCreate, BriefingOut, BriefingUpdate, EpisodeOut
from app.scheduling import next_run_at, today_in_tz

router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.get("", response_model=list[BriefingOut])
async def list_briefings(user: CurrentUser = Depends(current_user)):
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            "select * from briefings where user_id = $1 order by created_at desc",
            user.id,
        )
    return [BriefingOut(**dict(r)) for r in rows]


@router.post("", response_model=BriefingOut, status_code=status.HTTP_201_CREATED)
async def create_briefing(
    body: BriefingCreate, user: CurrentUser = Depends(current_user)
):
    try:
        nra = next_run_at(body.run_time, body.timezone)
    except Exception as exc:
        raise HTTPException(400, f"invalid timezone: {exc}")

    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            insert into briefings (user_id, topic, run_time, timezone, is_active, next_run_at)
            values ($1, $2, $3, $4, $5, $6)
            returning *
            """,
            user.id, body.topic, body.run_time, body.timezone,
            body.is_active, nra,
        )
    return BriefingOut(**dict(row))


@router.patch("/{briefing_id}", response_model=BriefingOut)
async def update_briefing(
    briefing_id: UUID,
    body: BriefingUpdate,
    user: CurrentUser = Depends(current_user),
):
    async with pool().acquire() as conn:
        existing = await conn.fetchrow(
            "select * from briefings where id = $1 and user_id = $2",
            briefing_id, user.id,
        )
        if not existing:
            raise HTTPException(404, "briefing not found")

        topic = body.topic if body.topic is not None else existing["topic"]
        run_time = body.run_time if body.run_time is not None else existing["run_time"]
        tz = body.timezone if body.timezone is not None else existing["timezone"]
        is_active = body.is_active if body.is_active is not None else existing["is_active"]

        # Recompute next_run_at if time/tz changed OR if reactivating.
        schedule_changed = (
            body.run_time is not None
            or body.timezone is not None
            or (body.is_active is True and not existing["is_active"])
        )
        try:
            nra = next_run_at(run_time, tz) if schedule_changed else existing["next_run_at"]
        except Exception as exc:
            raise HTTPException(400, f"invalid timezone: {exc}")

        row = await conn.fetchrow(
            """
            update briefings
            set topic = $1, run_time = $2, timezone = $3, is_active = $4, next_run_at = $5
            where id = $6
            returning *
            """,
            topic, run_time, tz, is_active, nra, briefing_id,
        )
    return BriefingOut(**dict(row))


@router.delete("/{briefing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_briefing(
    briefing_id: UUID, user: CurrentUser = Depends(current_user)
):
    async with pool().acquire() as conn:
        res = await conn.execute(
            "delete from briefings where id = $1 and user_id = $2",
            briefing_id, user.id,
        )
    if res.endswith(" 0"):
        raise HTTPException(404, "briefing not found")


@router.post(
    "/{briefing_id}/run",
    response_model=EpisodeOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_now(
    briefing_id: UUID, user: CurrentUser = Depends(current_user)
):
    """Queue a `pending` episode; the worker picks it up within seconds.

    Rate-limited per user per day to protect our Gnani credit balance.
    """
    settings = get_settings()
    async with pool().acquire() as conn:
        briefing = await conn.fetchrow(
            "select * from briefings where id = $1 and user_id = $2",
            briefing_id, user.id,
        )
        if not briefing:
            raise HTTPException(404, "briefing not found")

        # Rate limit: count user's episodes created today (in UTC — approximate).
        count = await conn.fetchval(
            """
            select count(*) from episodes
            where user_id = $1 and created_at >= now() - interval '24 hours'
            """,
            user.id,
        )
        if count >= settings.generate_now_daily_limit:
            raise HTTPException(
                429,
                f"daily generation limit reached ({settings.generate_now_daily_limit}/24h)",
            )

        run_date = today_in_tz(briefing["timezone"])
        row = await conn.fetchrow(
            """
            insert into episodes (briefing_id, user_id, run_date, status)
            values ($1, $2, $3, 'pending')
            on conflict (briefing_id, run_date) do update
              set status = case
                when episodes.status in ('failed')
                  then 'pending'
                else episodes.status
              end,
                  error = null
            returning *
            """,
            briefing_id, user.id, run_date,
        )
    return EpisodeOut(**dict(row))


@router.get("/{briefing_id}/episodes", response_model=list[EpisodeOut])
async def list_episodes(
    briefing_id: UUID, user: CurrentUser = Depends(current_user)
):
    async with pool().acquire() as conn:
        # confirm ownership
        owns = await conn.fetchval(
            "select 1 from briefings where id = $1 and user_id = $2",
            briefing_id, user.id,
        )
        if not owns:
            raise HTTPException(404, "briefing not found")

        rows = await conn.fetch(
            """
            select * from episodes
            where briefing_id = $1
            order by created_at desc
            limit 50
            """,
            briefing_id,
        )
    return [EpisodeOut(**dict(r)) for r in rows]
