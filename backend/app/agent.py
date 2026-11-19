"""The research-to-podcast agent.

Three stages, kept intentionally simple:
    1. search  — Tavily news search, last 24h
    2. write   — one LLM call turns sources into a ~5-minute script
    3. speak   — Gnani TTS, called chunk-by-chunk, joined into one MP3

A single public entry point: `generate_episode(topic) -> GeneratedEpisode`.
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from google import genai
from google.genai import types as genai_types
from pydub import AudioSegment
from tavily import TavilyClient
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import get_settings

log = logging.getLogger(__name__)


@dataclass
class Source:
    title: str
    url: str


@dataclass
class GeneratedEpisode:
    script: str
    sources: list[Source]
    audio_mp3: bytes
    duration_seconds: float = 0.0


# ---------- 1. Search ----------

def _search_news(topic: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Tavily news search, last 24 hours."""
    settings = get_settings()
    client = TavilyClient(api_key=settings.tavily_api_key)
    result = client.search(
        query=topic,
        topic="news",
        days=1,
        max_results=max_results,
        include_answer=False,
        include_raw_content=False,
    )
    return result.get("results", []) or []


# ---------- 2. Write ----------

_WRITE_SYSTEM = """You are a professional radio journalist writing a daily news briefing podcast script.

Rules you MUST follow:
- Use ONLY the facts in the articles provided below. Do not invent, speculate, or add outside knowledge.
- Target length: about 750 words (roughly five minutes of speech at 150 wpm).
- Spoken style: short sentences, conversational, no headings, no markdown, no emojis, no URLs.
- Open with a friendly greeting that mentions today's date in words.
- Lead with the most important story first. Group related stories together.
- Write numbers and amounts as words (for example: "fifty million dollars", "twenty twenty six").
- Close with a brief sign-off.
- If the articles are sparse, be honest about it and keep the script shorter rather than padding.
- Return the script as plain text only. No preamble, no title, no explanation."""


def _format_articles_for_prompt(results: list[dict[str, Any]]) -> str:
    if not results:
        return "No articles were found."
    lines: list[str] = []
    for i, r in enumerate(results, start=1):
        title = (r.get("title") or "").strip()
        content = (r.get("content") or "").strip()
        url = (r.get("url") or "").strip()
        lines.append(f"[Article {i}]\nTitle: {title}\nURL: {url}\nContent: {content}\n")
    return "\n".join(lines)


_gemini_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=get_settings().gemini_api_key)
    return _gemini_client


async def _write_script(
    topic: str, results: list[dict[str, Any]]
) -> tuple[str, list[Source]]:
    settings = get_settings()

    today = datetime.now(tz=timezone.utc).strftime("%A, %B %d, %Y")
    user_prompt = (
        f"Today's date: {today}\n"
        f"Topic the listener asked for: {topic}\n\n"
        f"Articles (your only permitted source of facts):\n"
        f"{_format_articles_for_prompt(results)}\n\n"
        f"Write the podcast script now."
    )

    # Gemma models don't support `system_instruction`; inline it instead.
    is_gemma = settings.gemini_model.lower().startswith("gemma")
    if is_gemma:
        contents = f"{_WRITE_SYSTEM}\n\n---\n\n{user_prompt}"
        config = genai_types.GenerateContentConfig(temperature=0.6)
    else:
        contents = user_prompt
        config = genai_types.GenerateContentConfig(
            system_instruction=_WRITE_SYSTEM,
            temperature=0.6,
        )

    response = await _gemini().aio.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
        config=config,
    )
    script = (response.text or "").strip()

    # Keep sources that at least have a URL; de-duplicate by URL.
    seen: set[str] = set()
    sources: list[Source] = []
    for r in results:
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip() or url
        if url and url not in seen:
            seen.add(url)
            sources.append(Source(title=title, url=url))

    return script, sources


# ---------- 3. Speak ----------

_MAX_CHUNK_CHARS = 500  # Gnani rejects long inputs; split at sentence boundaries.
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _chunk_script(script: str, max_chars: int = _MAX_CHUNK_CHARS) -> list[str]:
    """Split a script into TTS-friendly chunks at sentence boundaries."""
    script = script.strip()
    if not script:
        return []
    sentences = [s.strip() for s in _SENT_SPLIT.split(script) if s.strip()]
    chunks: list[str] = []
    current = ""
    for sent in sentences:
        # If a single sentence exceeds the limit, hard-wrap it on whitespace.
        if len(sent) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            words = sent.split()
            buf = ""
            for w in words:
                candidate = f"{buf} {w}".strip()
                if len(candidate) > max_chars:
                    if buf:
                        chunks.append(buf)
                    buf = w
                else:
                    buf = candidate
            if buf:
                current = buf
            continue
        candidate = f"{current} {sent}".strip() if current else sent
        if len(candidate) > max_chars:
            chunks.append(current)
            current = sent
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


class TTSError(RuntimeError):
    pass


async def _tts_one(client: httpx.AsyncClient, text: str) -> bytes:
    """Call Gnani TTS once with retry on 429/5xx."""
    settings = get_settings()
    payload = {
        "text": text,
        "model": settings.gnani_model,
        "voice": settings.gnani_voice,
        "language": settings.gnani_language,
        "audio_config": {"container": "mp3"},
    }
    headers = {
        "X-API-Key-ID": settings.gnani_api_key,
        "Content-Type": "application/json",
    }

    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, TTSError)),
        reraise=True,
    ):
        with attempt:
            resp = await client.post(
                settings.gnani_endpoint,
                json=payload,
                headers=headers,
                timeout=60.0,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                raise TTSError(
                    f"gnani tts transient error {resp.status_code}: {resp.text[:200]}"
                )
            if resp.status_code >= 400:
                # Permanent failure — don't retry.
                raise RuntimeError(
                    f"gnani tts error {resp.status_code}: {resp.text[:400]}"
                )
            return resp.content

    raise RuntimeError("unreachable")  # pragma: no cover


async def _synthesize(script: str) -> tuple[bytes, float]:
    """Run TTS over each chunk sequentially (Gnani may rate-limit concurrency)
    and concatenate the MP3s.
    """
    chunks = _chunk_script(script)
    if not chunks:
        raise ValueError("empty script")

    async with httpx.AsyncClient() as client:
        audio_parts: list[bytes] = []
        for i, chunk in enumerate(chunks):
            log.info("tts chunk %d/%d (%d chars)", i + 1, len(chunks), len(chunk))
            audio_parts.append(await _tts_one(client, chunk))

    combined = AudioSegment.empty()
    for part in audio_parts:
        combined += AudioSegment.from_file(io.BytesIO(part), format="mp3")

    out = io.BytesIO()
    combined.export(out, format="mp3", bitrate="96k")
    return out.getvalue(), combined.duration_seconds


# ---------- Public entry point ----------

async def generate_episode(topic: str) -> GeneratedEpisode:
    log.info("agent: search topic=%r", topic)
    # Tavily SDK is sync; run in a worker thread so we don't block the loop.
    results = await asyncio.to_thread(_search_news, topic)
    log.info("agent: got %d results", len(results))

    log.info("agent: write script")
    script, sources = await _write_script(topic, results)
    log.info("agent: script %d chars, %d sources", len(script), len(sources))

    log.info("agent: synthesize audio")
    audio_mp3, duration = await _synthesize(script)
    log.info("agent: audio %d bytes, %.1fs", len(audio_mp3), duration)

    return GeneratedEpisode(
        script=script,
        sources=sources,
        audio_mp3=audio_mp3,
        duration_seconds=duration,
    )
