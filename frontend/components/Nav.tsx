"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Logo } from "./Logo";

export function Nav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function signOut() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" aria-label="Daily Brief home">
          <Logo size={26} />
        </Link>

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-8 h-8 rounded-full bg-zinc-900 text-white text-sm font-medium flex items-center justify-center hover:bg-zinc-700 transition"
            aria-label="Account menu"
          >
            {initial}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-zinc-200 bg-white shadow-pop overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <div className="text-xs text-zinc-500">Signed in as</div>
                <div className="text-sm font-medium truncate">
                  {email ?? "—"}
                </div>
              </div>
              <button
                onMouseDown={signOut}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
