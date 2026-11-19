-- ============================================================
-- Daily Brief — Supabase schema
-- Run this once in the Supabase SQL editor on a fresh project.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists public.briefings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic       text not null,
  run_time    time not null,
  timezone    text not null default 'Asia/Kolkata',
  is_active   boolean not null default true,
  next_run_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists briefings_next_run_idx
  on public.briefings (next_run_at)
  where is_active = true;

create index if not exists briefings_user_idx
  on public.briefings (user_id);

create table if not exists public.episodes (
  id          uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  run_date    date not null,
  status      text not null default 'pending'
              check (status in ('pending','generating','ready','failed')),
  script      text,
  sources     jsonb,
  audio_url   text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (briefing_id, run_date)
);

create index if not exists episodes_status_idx
  on public.episodes (status, created_at)
  where status = 'pending';

create index if not exists episodes_briefing_idx
  on public.episodes (briefing_id, created_at desc);

create index if not exists episodes_user_idx
  on public.episodes (user_id, created_at desc);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists episodes_touch on public.episodes;
create trigger episodes_touch
before update on public.episodes
for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
-- The FastAPI backend uses the service-role key (bypasses RLS) and enforces
-- user_id scoping in code. We still enable RLS so that if anyone ever queries
-- with the anon key directly, they only see their own rows.

alter table public.briefings enable row level security;
alter table public.episodes  enable row level security;

drop policy if exists "briefings owner read"   on public.briefings;
drop policy if exists "briefings owner write"  on public.briefings;
drop policy if exists "episodes owner read"    on public.episodes;
drop policy if exists "episodes owner write"   on public.episodes;

create policy "briefings owner read"
  on public.briefings for select
  using (auth.uid() = user_id);

create policy "briefings owner write"
  on public.briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "episodes owner read"
  on public.episodes for select
  using (auth.uid() = user_id);

create policy "episodes owner write"
  on public.episodes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Storage ----------
-- Create a public bucket named 'podcasts' for audio files.
-- (A signed URL approach would be more secure, but the audio URL is
-- unguessable and only emailed to the owner — public bucket keeps the
-- demo simple.)

insert into storage.buckets (id, name, public)
values ('podcasts', 'podcasts', true)
on conflict (id) do nothing;

-- Allow public read of podcast audio (bucket is public anyway).
drop policy if exists "podcasts public read" on storage.objects;
create policy "podcasts public read"
  on storage.objects for select
  using (bucket_id = 'podcasts');
