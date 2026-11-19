"""Compute next_run_at (UTC) for a briefing given its local run_time + tz."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytz


def next_run_at(
    run_time: time,
    tz_name: str,
    *,
    now: datetime | None = None,
) -> datetime:
    """Return the next future occurrence of `run_time` in `tz_name`, as UTC.

    If the time today has already passed in the user's timezone, returns tomorrow.
    """
    tz = pytz.timezone(tz_name)
    now_utc = now or datetime.now(timezone.utc)
    now_local = now_utc.astimezone(tz)

    candidate_local = tz.localize(
        datetime.combine(now_local.date(), run_time)
    )
    if candidate_local <= now_local:
        candidate_local = tz.localize(
            datetime.combine(now_local.date() + timedelta(days=1), run_time)
        )
    return candidate_local.astimezone(timezone.utc)


def today_in_tz(tz_name: str, *, now: datetime | None = None) -> date:
    tz = pytz.timezone(tz_name)
    now_utc = now or datetime.now(timezone.utc)
    return now_utc.astimezone(tz).date()
