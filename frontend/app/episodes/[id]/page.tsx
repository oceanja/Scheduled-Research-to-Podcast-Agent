"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { api, type Episode } from "@/lib/api";

export default function EpisodeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [ep, setEp] = useState<Episode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function load() {
    try {
      setEp(await api.getEpisode(id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (ep?.status === "ready" || ep?.status === "failed") return;
      load();
    }, 4000);
    return () => clearInterval(t);
  }, [id, ep?.status]);

  async function retry() {
    setRetrying(true);
    try {
      await api.retryEpisode(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10 animate-fade-in">
        <Link
          href={ep ? `/briefings/${ep.briefing_id}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition mb-6"
        >
          <ArrowLeftIcon /> Back to briefing
        </Link>

        {!ep ? (
          <div className="space-y-4">
            <div className="h-56 rounded-3xl shimmer" />
            <div className="h-24 rounded-xl shimmer" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                  Episode
                </div>
                <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight mt-1">
                  {formatDate(ep.run_date)}
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Updated {new Date(ep.updated_at).toLocaleString()}
                </p>
              </div>
              <StatusPill status={ep.status} />
            </div>

            {err && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
                {err}
              </p>
            )}

            {ep.status === "pending" && (
              <Panel>
                <div className="flex items-center gap-3 text-sm text-zinc-700">
                  <Spinner /> Queued. A worker will pick this up within a few
                  seconds.
                </div>
              </Panel>
            )}

            {ep.status === "generating" && (
              <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                    <Spinner />
                  </div>
                  <div>
                    <div className="font-semibold text-amber-950">
                      Researching and recording…
                    </div>
                    <div className="mt-1 text-sm text-amber-900/80">
                      Searching the news, writing a script, and generating audio
                      with Gnani TTS. Typically takes 60–90 seconds.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ep.status === "failed" && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-8">
                <div className="font-semibold text-red-900 mb-1">
                  Generation failed
                </div>
                <pre className="text-xs text-red-900/90 mb-4 whitespace-pre-wrap break-words font-mono">
                  {ep.error}
                </pre>
                <button
                  onClick={retry}
                  disabled={retrying}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50 transition"
                >
                  {retrying ? "Retrying…" : "Retry"}
                </button>
              </div>
            )}

            {ep.status === "ready" && ep.audio_url && (
              <>
                <AudioHero audioUrl={ep.audio_url} />
                {ep.sources && ep.sources.length > 0 && (
                  <SourcesBlock sources={ep.sources} />
                )}
                {ep.script && <ScriptBlock script={ep.script} />}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

function AudioHero({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <section className="rounded-3xl overflow-hidden mb-10 shadow-pop relative bg-zinc-900 text-white">
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, #60a5fa 0, transparent 40%), radial-gradient(circle at 80% 90%, #f59e0b 0, transparent 40%)",
        }}
      />
      <div className="relative p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-medium">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-dot" />
          </span>
          Now playing
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Your Daily Brief
          </h2>
        </div>

        {/* Waveform mock bars (decorative) */}
        <div className="mt-6 flex items-end gap-[3px] h-14 opacity-70">
          {Array.from({ length: 56 }).map((_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.9) * 30 + Math.cos(i * 0.6) * 10);
            return (
              <div
                key={i}
                className="w-[3px] bg-white/70 rounded-full"
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <audio
          ref={audioRef}
          controls
          src={audioUrl}
          className="mt-6 w-full"
        />

        <div className="mt-5 flex items-center justify-between text-xs text-zinc-400">
          <a
            href={audioUrl}
            download
            className="inline-flex items-center gap-1.5 hover:text-white transition"
          >
            <DownloadIcon /> Download MP3
          </a>
          <span>Generated with Gnani TTS</span>
        </div>
      </div>
    </section>
  );
}

function SourcesBlock({
  sources,
}: {
  sources: { title: string; url: string }[];
}) {
  return (
    <section className="mb-10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Sources ({sources.length})
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-2.5 p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-card transition"
            >
              <span className="mt-0.5 text-zinc-300 group-hover:text-zinc-500 transition">
                <LinkIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900 line-clamp-2 leading-snug">
                  {s.title}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                  {new URL(s.url).hostname.replace(/^www\./, "")}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScriptBlock({ script }: { script: string }) {
  const [expanded, setExpanded] = useState(false);
  const words = script.split(/\s+/).length;
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Script
        </h3>
        <span className="text-xs text-zinc-500">{words} words</span>
      </div>
      <div
        className={`relative bg-white border border-zinc-200 rounded-2xl p-6 text-[15px] leading-[1.7] whitespace-pre-wrap text-zinc-800 shadow-card ${
          expanded ? "" : "max-h-72 overflow-hidden"
        }`}
      >
        {script}
        {!expanded && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs font-medium text-zinc-700 hover:text-zinc-900 transition"
      >
        {expanded ? "Show less" : "Read full script →"}
      </button>
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 mb-8 shadow-card">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="42 60"
      />
    </svg>
  );
}

function formatDate(d: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
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
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
