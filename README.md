<div align="center">

# Daily Brief

**A scheduled research-to-podcast agent.**
Enter a topic, pick a time, and every day at that time an AI-written, AI-narrated ~5-minute podcast lands in your inbox.

Built as the take-home for the **Full-Stack + AI Engineer** role at **Gnani.ai**.

[Live demo](https://scheduled-research-to-podcast-agent-mocha.vercel.app) · [API](https://scheduled-research-to-podcast-agent.onrender.com) · [Video walkthrough](https://drive.google.com/file/d/1EgjjijCWD_jNJI6aA0RPn2XB02qHMGgQ/view?usp=sharing)

</div>

---

## Table of contents

1. [What it does](#what-it-does)
2. [Try it in 2 minutes](#try-it-in-2-minutes)
3. [Architecture](#architecture)
4. [Daily flow](#daily-flow)
5. [Tech stack & why](#tech-stack--why)
6. [Local setup](#local-setup)
7. [Deployment](#deployment)
8. [API reference](#api-reference)
9. [Data model](#data-model)
10. [Design decisions & trade-offs](#design-decisions--trade-offs)
11. [Security](#security)
12. [Known limitations & next steps](#known-limitations--next-steps)
13. [Repo layout](#repo-layout)

---

## What it does

A logged-in user creates a **briefing** — a topic plus a daily run time in their timezone. Every day at that time, a background agent:

1. Searches the web's last 24 hours of news on the topic.
2. Writes a ~750-word, spoken-style script grounded in what it found.
3. Narrates it with Gnani's `timbre-v2.5` TTS voice.
4. Uploads the finished MP3 to object storage.
5. Emails the user a link to the episode page, where they can play the audio, read the script, and see the sources.

The whole pipeline is idempotent, concurrency-safe, and self-healing — a crashed worker can't orphan an episode.

### Feature highlights

| | |
|---|---|
| **Sign in with Google** or an email magic link (Supabase Auth). |
| **Create / edit / pause / delete** briefings; pick any IANA timezone. |
| **Scheduled runs**: one episode per briefing per day, delivered on time. |
| **Generate now**: a button that triggers an immediate run for demos. |
| **Episode page**: audio player, full script, clickable sources, status. |
| **Retry** on failure, with a precise error message surfaced to the user. |
| **Stuck-episode watchdog**: anything hung >15 min auto-resets. |
| **Horizontal scaling** of workers via Postgres `SELECT … FOR UPDATE SKIP LOCKED`. |

---

## Try it in 2 minutes

1. Open the live demo and sign in with Google (or an email magic link).
2. Click **New briefing** → enter a topic like `startup funding rounds announced in the last 24 hours` → pick a time → create.
3. On the briefing page, hit **Generate now** — a worker picks it up within ~5 seconds.
4. Wait about a minute. Status goes `pending → generating → ready`. An email arrives with a link to the episode page.
5. Any briefing created at a future daily time will run on its own from then on.

---

## Architecture

```
          ┌──────────────┐         JWT         ┌─────────────────────────────────────────┐
          │  Next.js 15  │ ──────────────────▶ │           FastAPI (Railway)             │
 Browser  │  (Vercel)    │                     │                                         │
 ───────▶ │              │ ◀──── JSON ──────── │  routes/       scheduler   (every 1 m)  │
          │  Supabase    │                     │  agent         worker      (every 5 s)  │
          │  Auth (SSR)  │                     │  deps (JWT)    stuck-reset (every 5 m)  │
          └──────┬───────┘                     └──────┬──────────────────────────────────┘
                 │                                    │
                 ▼                                    ▼
          ┌─────────────────┐                  ┌──────────────┐   ┌──────────────┐
          │ Supabase        │ ◀─ SQL/Storage ─ │  Tavily      │   │  OpenAI      │
          │ Auth · DB · Obj │                  │  (news)      │   │  gpt-4o-mini │
          └─────────────────┘                  └──────────────┘   └──────────────┘
                                                      ▲
                                                      │  MP3 bytes
                                               ┌──────┴───────┐
                                               │  Gnani TTS   │
                                               │  timbre-v2.5 │
                                               └──────────────┘
                                                      │
                                                      ▼  Resend email
                                                 user inbox
```

Three long-running jobs live inside one FastAPI process, coordinated through Postgres:

| Job | Period | What it does |
|---|---|---|
| **Scheduler** | 1 min | Finds active briefings with `next_run_at <= now + 5 min`, inserts a `pending` episode (unique on `(briefing_id, run_date)`), and advances `next_run_at` by one day. |
| **Worker** | 5 s | Picks one `pending` episode with `SELECT … FOR UPDATE SKIP LOCKED`, marks it `generating`, runs the agent pipeline. |
| **Stuck-reset** | 5 min | Anything stuck in `generating` for >15 min is flipped back to `pending` so another worker can retry. |

---

## Daily flow

1. **Scheduler tick.** Inserts a `pending` row for every briefing due in the next five minutes.
2. **Worker tick.** Claims one `pending` episode atomically. Marks it `generating`.
3. **Agent pipeline** (~60–90 s end to end):
   1. **Search** — Tavily news, last 1 day, 10 results.
   2. **Write** — one OpenAI call turns the articles into a disciplined ~750-word spoken-style script with per-headline citations.
   3. **Speak** — the script is chunked by sentence (~500 char cap), sent to Gnani TTS one chunk at a time with exponential-backoff retry on 429/5xx, and concatenated with `pydub` into one MP3.
4. **Upload** to Supabase Storage (public `podcasts` bucket).
5. **Email** the user via Resend with a deep link to `/episodes/{id}`.
6. On any failure the episode is marked `failed` with the error. The user can press **Retry**. The stuck-reset job catches silent crashes.

The scheduled path and the **Generate now** button share the exact same code path — "Generate now" is just an immediate `pending` insert.

---

## Tech stack & why

| Part | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15** (App Router) on **Vercel** | Required stack. Typed routes, SSR auth, free hobby tier. |
| Backend | **FastAPI** on **Railway** | Required. Railway is always-on, so the scheduler keeps ticking. |
| Auth | **Supabase Auth** (Google + email magic link) | HS256 JWT verified locally — no round-trip per request. |
| DB | **Supabase Postgres** via **asyncpg** | Need `SELECT … FOR UPDATE SKIP LOCKED` for safe concurrent workers; the Supabase client doesn't expose that cleanly, so raw asyncpg is simpler. |
| File storage | **Supabase Storage** (public `podcasts` bucket) | Zero config. URLs are unguessable and only emailed to the owner — good enough for demo scope. |
| Scheduling / queue | **APScheduler** + **Postgres as a queue** (`SKIP LOCKED`) | One deploy, no Redis. Scales horizontally — just add more worker processes. |
| News search | **Tavily** (`topic=news`, `days=1`) | Built for agents; returns page text so the LLM has real content to ground on. |
| LLM | **OpenAI `gpt-4o-mini`** | Cheap (~$0.02 per episode), fast, reliable structured output. |
| TTS | **Gnani `timbre-v2.5`**, `en-IN` | Required. Chunked (500-char) sequential calls with exponential-backoff retry. |
| Email | **Resend** | Free tier + `onboarding@resend.dev` sender, no DNS setup for the demo. |

---

## Local setup

**Prereqs:** Python 3.12, Node 20+, a Supabase project, API keys for Gnani / Tavily / OpenAI / Resend, and `ffmpeg` installed (used by `pydub` to concatenate MP3 chunks).

```bash
brew install ffmpeg          # macOS
# or: sudo apt-get install ffmpeg
```

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. In the SQL editor, paste and run `supabase/schema.sql`.
3. In **Authentication → Providers**, enable **Google** and **Email**.
4. Add `http://localhost:3000/auth/callback` (and later your Vercel URL) to **Redirect URLs**.
5. From **Project Settings → API**, copy:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
6. From **Project Settings → Database**, copy the **session pooler** connection string (port 5432) as `DATABASE_URL`.

### 2. Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../.env.example .env         # fill in the values
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local   # only the NEXT_PUBLIC_* vars matter here
npm run dev
```

App: <http://localhost:3000>

---

## Deployment

### Backend → Railway

1. New project → **Deploy from GitHub repo** → point at this repo, root `backend/`.
2. Railway picks up `backend/Dockerfile` and `backend/railway.toml` automatically.
3. Add every variable from `.env.example` *except* the `NEXT_PUBLIC_*` ones as **Service Variables**.
4. Set `APP_URL` to your Vercel URL. Set `CORS_ORIGINS` to the same Vercel URL.
5. Deploy. Health check: `GET /health`.

### Frontend → Vercel

1. Import the repo → set **Root Directory** to `frontend/`.
2. Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (your Railway URL).
3. Deploy.
4. Add the final Vercel URL to **Supabase → Authentication → Redirect URLs**.

---

## API reference

All routes require `Authorization: Bearer <Supabase JWT>`. The JWT is verified locally with `SUPABASE_JWT_SECRET`; its `sub` becomes the user id, and every query filters by `user_id`.

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/briefings`               | List my briefings |
| `POST`   | `/briefings`               | Create — `{topic, run_time, timezone}` |
| `PATCH`  | `/briefings/{id}`          | Edit topic / time / tz, pause / resume |
| `DELETE` | `/briefings/{id}`          | Delete (cascades to episodes) |
| `POST`   | `/briefings/{id}/run`      | Generate now (rate-limited per user per day) |
| `GET`    | `/briefings/{id}/episodes` | List episodes for a briefing |
| `GET`    | `/episodes/{id}`           | Episode detail (status, audio, script, sources) |
| `POST`   | `/episodes/{id}/retry`     | Retry a failed episode |
| `GET`    | `/health`                  | Liveness probe |

---

## Data model

```
briefings (id, user_id, topic, run_time, timezone, is_active, next_run_at, created_at)
episodes  (id, briefing_id, user_id, run_date, status, script, sources, audio_url, error, created_at, updated_at)
          UNIQUE (briefing_id, run_date)
```

- **RLS** is enabled on both tables. The backend uses the service-role key (bypasses RLS) and enforces scoping in code; RLS is a defence-in-depth guarantee that if anyone ever queries with the anon key, they only see their own rows.
- `next_run_at` is stored in UTC. The client sends a local `run_time` + IANA `timezone`; the backend computes UTC via `pytz`.
- `UNIQUE (briefing_id, run_date)` is the natural idempotency key — the scheduler can tick twice and only one episode will ever exist per day.

---

## Design decisions & trade-offs

**Postgres as the job queue, not Redis/Celery.**
`SELECT … FOR UPDATE SKIP LOCKED` gives correct, exactly-once-per-worker dequeue semantics without a second data store. For a demo-scale service this is strictly better than adding Redis: one less thing to deploy, one less thing to monitor, and the scheduler + workers share transactions with the business data. At much higher throughput we'd swap in ARQ or Celery + Redis.

**Local JWT verification.**
Supabase JWTs are HS256-signed with the project's `SUPABASE_JWT_SECRET`. Verifying locally (via PyJWT) saves ~150 ms per request vs. calling `supabase.auth.getUser()`, and removes a hard dependency on the Supabase auth server being up on every API call.

**One LLM call, not a chain.**
The brief is "write a 5-minute script from these articles" — that's a perfect single-shot task for a cheap model with a disciplined system prompt. Adding query decomposition, de-duplication passes, and per-fact citation would be more "agentic" but also 5× the cost and 5× the latency, and most of it isn't tested at this scope. Noted as the top thing to extend.

**Sequential TTS chunks.**
Gnani's docs warn that some accounts only allow one request at a time. Rather than fight for parallelism and risk 429 storms, chunks are streamed sequentially with exponential backoff. A 5-minute episode is ~5 chunks × ~5 s each ≈ 25 s of TTS — fine.

**Scheduler + API in one process (for the demo).**
The PRD asks for background jobs on any cloud; one Railway service is the simplest thing that works. The scheduler and workers are already written as standalone functions in `worker.py`, so splitting them into their own service is a config change — no code changes.

**`onboarding@resend.dev` sender.**
No DNS to configure, and Resend permits it in test mode. For a real production deploy, swap in a verified domain.

---

## Security

- Every API route is JWT-gated; the token is verified locally, not round-tripped to Supabase.
- Every DB query filters by `user_id` taken from the verified JWT — no cross-tenant reads are possible even on the service-role connection.
- RLS is enabled on `briefings` and `episodes` as defence-in-depth against a mis-scoped anon key call.
- Secrets live only in environment variables; `.env` and `.env.local` are git-ignored, and `.env.example` ships without any live values.
- The `podcasts` bucket is public but keyed by `user_id/episode_id` — URLs are unguessable and only emailed to the owner. Signed URLs would be strictly better and are listed below as a next step.
- No user-controlled input is interpolated into SQL (asyncpg parameterised queries) or shell commands.
- CORS is explicitly allow-listed to the Vercel origin.

---

## Known limitations & next steps

Deliberate trade-offs for a one-day build:

- **Single-process scheduler.** If the API restarts mid-generation, the episode is caught by the stuck-episode reset (15 min), but there's a brief delay. For scale: separate the worker into its own Railway service — same code, different start command.
- **No fact-checking.** The script is only as good as the top 10 Tavily results. Natural next step: multiple search queries per topic, dedup by canonical URL, and a verification pass that spot-checks each claim against its source.
- **Per-user generation only.** Two users subscribed to "AI news today" each burn a separate agent run. A natural follow-up is to cache the search + script for identical/near-identical topics and only re-synth per voice.
- **Public bucket.** Audio URLs are unguessable, but the path pattern (`podcasts/{user_id}/{episode_id}.mp3`) is predictable. Signed URLs would be strictly better.
- **No streaming for long scripts.** The user waits for the full MP3 before the player loads. Streaming chunks to the browser as they come back from Gnani would make the "ready" state feel instant.

---

## Repo layout

```
.
├── backend/              FastAPI app, Dockerfile for Railway
│   └── app/
│       ├── main.py       lifespan: pool + worker start/stop
│       ├── agent.py      search → write → speak
│       ├── worker.py     scheduler + worker + stuck-reset (APScheduler)
│       ├── routes/       /briefings and /episodes
│       ├── deps.py       Supabase JWT verification
│       ├── storage.py    Supabase Storage upload
│       ├── email.py      Resend email
│       └── scheduling.py local-time → UTC next_run_at
├── frontend/             Next.js 15 (App Router), Tailwind
│   ├── app/              login, dashboard, briefings, episodes
│   ├── lib/              api client + Supabase browser/server
│   └── middleware.ts     SSR auth gate
├── supabase/schema.sql   tables, RLS, storage bucket
└── .env.example          every env var the project reads
```

---

<div align="center">

Built in a day for the Gnani.ai Full-Stack + AI Engineer take-home.

</div>
