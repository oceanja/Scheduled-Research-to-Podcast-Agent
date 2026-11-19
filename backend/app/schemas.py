from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class BriefingCreate(BaseModel):
    topic: str = Field(min_length=3, max_length=500)
    run_time: time
    timezone: str = Field(min_length=1, max_length=64)
    is_active: bool = True

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("topic cannot be empty")
        return v


class BriefingUpdate(BaseModel):
    topic: str | None = Field(default=None, min_length=3, max_length=500)
    run_time: time | None = None
    timezone: str | None = None
    is_active: bool | None = None


class BriefingOut(BaseModel):
    id: UUID
    user_id: UUID
    topic: str
    run_time: time
    timezone: str
    is_active: bool
    next_run_at: datetime | None
    created_at: datetime


class EpisodeOut(BaseModel):
    id: UUID
    briefing_id: UUID
    user_id: UUID
    run_date: date
    status: Literal["pending", "generating", "ready", "failed"]
    script: str | None
    sources: list[dict[str, Any]] | None
    audio_url: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime
