"use client";

import { useEffect, useState } from "react";
import { matchesTestPhone } from "@/lib/ai/routing";

export interface AiAgentSummary {
  id: string;
  name: string;
  is_default: boolean;
  countries: string[];
  provider: string;
  model: string;
  is_active: boolean;
  auto_reply_enabled: boolean;
}

export interface AiTestPhone {
  id: string;
  phone: string;
  country_iso: string;
}

// Short-lived, per-tab caches shared by every inbox thread so switching
// chats doesn't refetch. The AI Agents page invalidates them on change.
const TTL_MS = 30_000;
let agentsCache: { at: number; data: AiAgentSummary[] } | null = null;
let phonesCache: { at: number; data: AiTestPhone[] } | null = null;
let agentsInflight: Promise<AiAgentSummary[]> | null = null;
let phonesInflight: Promise<AiTestPhone[]> | null = null;

export function invalidateAiAgentCaches() {
  agentsCache = null;
  phonesCache = null;
}

export async function fetchAiAgents(force = false): Promise<AiAgentSummary[]> {
  if (!force && agentsCache && Date.now() - agentsCache.at < TTL_MS) return agentsCache.data;
  if (!force && agentsInflight) return agentsInflight;
  agentsInflight = (async () => {
    try {
      const res = await fetch("/api/ai/agents", { cache: "no-store" });
      if (!res.ok) return agentsCache?.data ?? [];
      const j = await res.json();
      const data = (j?.agents ?? []) as AiAgentSummary[];
      agentsCache = { at: Date.now(), data };
      return data;
    } catch {
      return agentsCache?.data ?? [];
    } finally {
      agentsInflight = null;
    }
  })();
  return agentsInflight;
}

export async function fetchAiTestPhones(force = false): Promise<AiTestPhone[]> {
  if (!force && phonesCache && Date.now() - phonesCache.at < TTL_MS) return phonesCache.data;
  if (!force && phonesInflight) return phonesInflight;
  phonesInflight = (async () => {
    try {
      const res = await fetch("/api/ai/test-phones", { cache: "no-store" });
      if (!res.ok) return phonesCache?.data ?? [];
      const j = await res.json();
      const data = (j?.phones ?? []) as AiTestPhone[];
      phonesCache = { at: Date.now(), data };
      return data;
    } catch {
      return phonesCache?.data ?? [];
    } finally {
      phonesInflight = null;
    }
  })();
  return phonesInflight;
}

/** Name of the AI agent that owns a conversation, or null. */
export function useAiAgentName(agentId: string | null | undefined): string | null {
  // Keyed by the id it was resolved for, so a stale name never shows
  // for a different conversation.
  const [resolved, setResolved] = useState<{ id: string; name: string | null } | null>(null);
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    void fetchAiAgents().then((agents) => {
      if (!cancelled) {
        setResolved({ id: agentId, name: agents.find((a) => a.id === agentId)?.name ?? null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [agentId]);
  return agentId && resolved?.id === agentId ? resolved.name : null;
}

/** Simulated country (ISO) when `phone` is a saved test number, else null. */
export function useSimulatedCountry(phone: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ phone: string; iso: string | null } | null>(null);
  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    void fetchAiTestPhones().then((phones) => {
      if (cancelled) return;
      setResolved({
        phone,
        iso: phones.find((p) => matchesTestPhone(phone, p.phone))?.country_iso ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);
  return phone && resolved?.phone === phone ? resolved.iso : null;
}
