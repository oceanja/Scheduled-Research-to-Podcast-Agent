"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { api, type Briefing } from "@/lib/api";

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = d - now;
  if (diff < 0) return "due now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d ${hrs % 24}h`;
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

export default function DashboardPage() {
  const [briefings, setBriefings] = useState<Briefing[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setBriefings(await api.listBriefings());
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePause(b: Briefing, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await api.updateBriefing(b.id, { is_active: !b.is_active });
    load();
  }

  async function del(b: Briefing, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${b.topic}"? This also deletes its episodes.`))
      return;
    await api.deleteBriefing(b.id);
    load();
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Your briefings
            </h1>
            <p className="text-[15px] text-zinc-500 mt-2">
              One topic. One time. Every day — delivered to your inbox.
            </p>
          </div>
          <Link
            href="/briefings/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 shadow-card transition"
          >
            <PlusIcon /> New briefing
          </Link>
        </div>

        {err && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
            {err}
          </p>
        )}

        {briefings === null ? (
          <SkeletonList />
        ) : briefings.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/briefings/${b.id}`}
                  className="group block bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-card-hover shadow-card transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                        b.is_active
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          b.is_active ? "bg-emerald-500" : "bg-zinc-400"
                        }`}
                      />
                      {b.is_active ? "Active" : "Paused"}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => togglePause(b, e)}
                        className="text-[11px] px-2 py-0.5 rounded-md hover:bg-zinc-100 text-zinc-600"
                      >
                        {b.is_active ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={(e) => del(b, e)}
                        className="text-[11px] px-2 py-0.5 rounded-md hover:bg-red-50 hover:text-red-700 text-zinc-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="font-medium text-[15px] leading-snug line-clamp-2 min-h-[2.6em]">
                    {b.topic}
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <ClockIcon />
                      Daily at{" "}
                      <span className="font-medium text-zinc-900">
                        {fmtTime(b.run_time)}
                      </span>
                      <span className="text-zinc-300">·</span>
                      <span className="text-zinc-500">{b.timezone}</span>
                    </div>
                    <div className="text-zinc-600">
                      Next {fmtRelative(b.next_run_at)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-zinc-300 rounded-3xl p-12 md:p-16 text-center bg-white/60">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-5">
        <WaveIcon />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        Start your first briefing
      </h3>
      <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
        Tell the agent what you want to hear about, pick a daily time, and we'll
        drop a fresh 5-minute podcast in your inbox each morning.
      </p>
      <Link
        href="/briefings/new"
        className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 shadow-card transition"
      >
        <PlusIcon /> Create your first briefing
      </Link>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-card"
        >
          <div className="h-5 w-16 rounded-full shimmer mb-4" />
          <div className="h-4 w-full rounded shimmer mb-2" />
          <div className="h-4 w-3/4 rounded shimmer mb-6" />
          <div className="h-3 w-1/2 rounded shimmer" />
        </li>
      ))}
    </ul>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
function WaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="10" x2="6" y2="14" />
        <line x1="10" y1="7" x2="10" y2="17" />
        <line x1="14" y1="9" x2="14" y2="15" />
        <line x1="18" y1="5" x2="18" y2="19" />
      </g>
    </svg>
  );
}
