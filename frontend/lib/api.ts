"use client";

import { supabaseBrowser } from "./supabase-browser";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

async function authHeader(): Promise<Record<string, string>> {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type Briefing = {
  id: string;
  user_id: string;
  topic: string;
  run_time: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  created_at: string;
};

export type Episode = {
  id: string;
  briefing_id: string;
  user_id: string;
  run_date: string;
  status: "pending" | "generating" | "ready" | "failed";
  script: string | null;
  sources: { title: string; url: string }[] | null;
  audio_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const api = {
  listBriefings: () => request<Briefing[]>("/briefings"),
  createBriefing: (body: {
    topic: string;
    run_time: string;
    timezone: string;
  }) => request<Briefing>("/briefings", { method: "POST", body: JSON.stringify(body) }),
  updateBriefing: (id: string, body: Partial<Briefing>) =>
    request<Briefing>(`/briefings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBriefing: (id: string) =>
    request<void>(`/briefings/${id}`, { method: "DELETE" }),
  runBriefing: (id: string) =>
    request<Episode>(`/briefings/${id}/run`, { method: "POST" }),
  listEpisodes: (briefingId: string) =>
    request<Episode[]>(`/briefings/${briefingId}/episodes`),
  getEpisode: (id: string) => request<Episode>(`/episodes/${id}`),
  retryEpisode: (id: string) =>
    request<Episode>(`/episodes/${id}/retry`, { method: "POST" }),
};
