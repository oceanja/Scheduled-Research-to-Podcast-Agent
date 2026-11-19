"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";

const EXAMPLES = [
  "Startup funding rounds announced in the last 24 hours",
  "AI and large language model news today",
  "Indian stock market highlights and movers",
  "Global climate and energy policy updates",
  "Premier League football scores and transfers",
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function NewBriefingPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [time, setTime] = useState("08:00");
  const [tz, setTz] = useState(detectTimezone());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const b = await api.createBriefing({
        topic: topic.trim(),
        run_time: `${time}:00`,
        timezone: tz,
      });
      router.push(`/briefings/${b.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition mb-6"
        >
          <ArrowLeftIcon /> Dashboard
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight">New briefing</h1>
        <p className="text-[15px] text-zinc-500 mt-2 mb-10">
          Tell the agent what to research and when to deliver it.
        </p>

        <form onSubmit={submit} className="space-y-8">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-2">Topic</label>
            <textarea
              required
              minLength={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. All startup funding rounds announced in the last 24 hours"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-[15px] placeholder:text-zinc-400 resize-none focus:border-zinc-400 outline-none shadow-card"
            />
            <div className="text-xs text-zinc-500 mt-2">
              Be specific. The agent searches news from the last 24 hours using
              this phrasing.
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-zinc-500 mb-2">
                Or try one of these
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setTopic(ex)}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Time + TZ */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Delivery time
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-[15px] focus:border-zinc-400 outline-none shadow-card"
              />
              <div className="text-xs text-zinc-500 mt-2">
                We'll start generating 5 min early.
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Time zone
              </label>
              <input
                type="text"
                required
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-[15px] font-mono focus:border-zinc-400 outline-none shadow-card"
              />
              <div className="text-xs text-zinc-500 mt-2">
                Auto-detected from your browser.
              </div>
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {err}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 shadow-card transition"
            >
              {loading ? "Creating…" : "Create briefing"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
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
