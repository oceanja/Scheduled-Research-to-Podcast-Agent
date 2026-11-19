"""Supabase Storage upload helper."""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from supabase import Client, create_client

from app.config import get_settings

log = logging.getLogger(__name__)

_BUCKET = "podcasts"
_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = create_client(
            settings.supabase_url, settings.supabase_service_role_key
        )
    return _client


async def upload_audio(user_id: UUID, episode_id: UUID, data: bytes) -> str:
    """Upload MP3 bytes, return the public URL."""
    key = f"{user_id}/{episode_id}.mp3"

    def _blocking_upload() -> str:
        client = _get_client()
        client.storage.from_(_BUCKET).upload(
            path=key,
            file=data,
            file_options={
                "content-type": "audio/mpeg",
                "upsert": "true",
                "cache-control": "3600",
            },
        )
        return client.storage.from_(_BUCKET).get_public_url(key)

    url = await asyncio.to_thread(_blocking_upload)
    # supabase-py sometimes appends '?' — strip it for cleanliness.
    return url.rstrip("?")
