from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_pool, init_pool
from app.routes import briefings, episodes
from app.worker import shutdown as worker_shutdown
from app.worker import start as worker_start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("daily-brief")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup: initializing pool")
    await init_pool()
    worker_start()
    try:
        yield
    finally:
        log.info("shutdown: stopping worker + pool")
        worker_shutdown()
        await close_pool()


app = FastAPI(title="Daily Brief API", version="0.1.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(briefings.router)
app.include_router(episodes.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "daily-brief", "docs": "/docs"}
