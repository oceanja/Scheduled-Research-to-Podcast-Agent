from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import pool
from app.deps import CurrentUser, current_user
from app.schemas import EpisodeOut

router = APIRouter(prefix="/episodes", tags=["episodes"])


@router.get("/{episode_id}", response_model=EpisodeOut)
async def get_episode(
    episode_id: UUID, user: CurrentUser = Depends(current_user)
):
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            "select * from episodes where id = $1 and user_id = $2",
            episode_id, user.id,
        )
    if not row:
        raise HTTPException(404, "episode not found")
    return EpisodeOut(**dict(row))


@router.post("/{episode_id}/retry", response_model=EpisodeOut)
async def retry_episode(
    episode_id: UUID, user: CurrentUser = Depends(current_user)
):
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            update episodes
            set status = 'pending', error = null
            where id = $1 and user_id = $2 and status in ('failed')
            returning *
            """,
            episode_id, user.id,
        )
    if not row:
        raise HTTPException(404, "episode not found or not in failed state")
    return EpisodeOut(**dict(row))
