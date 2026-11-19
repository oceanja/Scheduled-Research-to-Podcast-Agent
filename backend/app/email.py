"""Transactional email via Resend."""
from __future__ import annotations

import asyncio
import logging

import resend

from app.config import get_settings

log = logging.getLogger(__name__)


def _render_html(topic: str, episode_url: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #111;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Your Daily Brief is ready</h1>
    <p style="margin: 0 0 12px; color: #444;">Topic: <strong>{topic}</strong></p>
    <p style="margin: 24px 0;">
      <a href="{episode_url}"
         style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Listen to today's episode
      </a>
    </p>
    <p style="font-size: 12px; color: #999; margin-top: 32px;">
      You're receiving this because you scheduled a daily brief. You can pause or delete it any time from your dashboard.
    </p>
  </body>
</html>
"""


async def send_episode_ready(to: str, topic: str, episode_url: str) -> None:
    settings = get_settings()
    resend.api_key = settings.resend_api_key

    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [to],
        "subject": f"Your Daily Brief: {topic}",
        "html": _render_html(topic, episode_url),
    }
    try:
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as exc:  # pragma: no cover
        log.exception("resend send failed to=%s: %s", to, exc)
