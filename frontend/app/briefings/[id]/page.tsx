"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { api, type Briefing, type Episode } from "@/lib/api";

export default function BriefingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const [all, eps] = await Promise.all([
        api.listBriefings(),
        api.listEpisodes(id),
      ]);
      setBriefing(all.find((b) => b.id === id) ?? null);
      setEpisodes(eps);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  async function runNow() {
    setRunning(true);
    setErr(null);
    try {
      await api.runBriefing(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10 animate-fade-in">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition mb-6"
        >
          <ArrowLeftIcon /> All briefings
        </Link>

        {briefing ? (
          <>
            {/* Hero */}
            <section className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8 shadow-card mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-medium">
                    Topic
                  </div>
                  <h1 className="text-[22px] md:text-2xl font-semibold tracking-tight leading-snug">
                    {briefing.topic}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon /> Daily at{" "}
                      <span className="font-medium text-zinc-900">
                        {briefing.run_time.slice(0, 5)}
                      </span>
                    </span>
                    <span className="text-zinc-300">·</span>
                    <span>{briefing.timezone}</span>
                    <span className="text-zinc-300">·</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        briefing.is_active
                          ? "text-emerald-700"
                          : "text-zinc-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          briefing.is_active
                            ? "bg-emerald-500"
                            : "bg-zinc-400"
                        }`}
                      />
                      {briefing.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={runNow}
                  disabled={running}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 shadow-card transition"
                >
                  <SparkIcon />
                  {running ? "Queueing…" : "Generate now"}
                </button>
                <p className="text-xs text-zinc-500">
                  Runs in the background. Takes about a minute.
                </p>
              </div>

              {err && (
                <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  {err}
                </p>
              )}
            </section>

            {/* Episodes */}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
              Episodes
            </h2>

            {episodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
                <p className="text-sm text-zinc-600">
                  No episodes yet. Press{" "}
                  <span className="font-medium text-zinc-900">
                    Generate now
                  </span>{" "}
                  to get your first one.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {episodes.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/episodes/${e.id}`}
                      className="flex items-center justify-between gap-3 p-4 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-card-hover shadow-card transition"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {formatDate(e.run_date)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Created {new Date(e.created_at).toLocaleString()}
                        </div>
                      </div>
                      <StatusPill status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="mt-6 space-y-2">
            <div className="h-24 rounded-2xl shimmer" />
            <div className="h-16 rounded-xl shimmer" />
          </div>
        )}
      </main>
    </>
  );
}

function formatDate(d: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d + "T00:00:00"));
  } catch {
    return d;
  }
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.2 6.5L21 10l-6.8 1.5L12 18l-2.2-6.5L3 10l6.8-1.5L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}
