"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { supabaseBrowser } from "@/lib/supabase-browser";

const features = [
  {
    title: "Fresh every morning",
    body: "An AI agent pulls the latest news on your topic from the last 24 hours — no stale reruns.",
  },
  {
    title: "Five minutes of signal",
    body: "A tight, spoken-style script read aloud with natural-sounding voice. Perfect for your commute.",
  },
  {
    title: "Sources you can trust",
    body: "Every episode links back to the real articles it was built from. No made-up facts.",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  async function signInGoogle() {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-5 bg-[#FAFAF9]">
      {/* Left — brand + value prop */}
      <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between p-12 bg-zinc-900 text-zinc-50 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 35%)",
          }}
        />
        <div className="relative">
          <div className="text-zinc-50">
            <Logo size={32} />
          </div>
        </div>

        <div className="relative max-w-md animate-fade-in">
          <h1 className="text-[42px] leading-[1.1] font-semibold tracking-tight">
            Your personal morning briefing,
            <br />
            <span className="text-zinc-400">read aloud.</span>
          </h1>
          <p className="mt-6 text-zinc-400 text-[17px] leading-relaxed">
            Pick a topic. Pick a time. Every day, an AI agent researches,
            writes, and narrates a 5-minute podcast just for you.
          </p>

          <ul className="mt-10 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <div>
                  <div className="text-zinc-100 font-medium">{f.title}</div>
                  <div className="text-zinc-500 text-sm mt-0.5">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-zinc-500">
          Built for Gnani.ai — scheduled research-to-podcast agent.
        </div>
      </aside>

      {/* Right — auth */}
      <section className="lg:col-span-2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden mb-8">
            <Logo size={32} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-zinc-500 mt-1.5">
            Sign in to create your daily briefings.
          </p>

          <button
            onClick={signInGoogle}
            className="mt-8 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 shadow-card text-sm font-medium transition"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6 text-xs text-zinc-400">
            <div className="h-px bg-zinc-200 flex-1" />
            or continue with email
            <div className="h-px bg-zinc-200 flex-1" />
          </div>

          {sent ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
              <div className="font-medium mb-0.5">Check your inbox</div>
              <div className="text-emerald-800/80">
                We sent a sign-in link to <strong>{email}</strong>.
              </div>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm placeholder:text-zinc-400 focus:border-zinc-400 outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition shadow-card"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
              {err && <p className="text-xs text-red-600">{err}</p>}
            </form>
          )}

          <p className="mt-10 text-xs text-zinc-400">
            By continuing you agree to let us email you your scheduled
            episodes.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
