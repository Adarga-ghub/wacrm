"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  deriveIsTyping,
  type ConversationTypingRow,
  type TypingActorType,
} from "@/lib/conversation-typing";

// Re-derive faster than presence's 15s tick — this drives a live
// header label, not a coarse roster, so staleness needs to resolve
// within a couple of seconds of the typist actually stopping.
const RE_DERIVE_MS = 2_000;

interface UseConversationTypingResult {
  isTyping: boolean;
  actorType: TypingActorType | null;
}

/**
 * Live "is someone typing on THIS conversation right now" status.
 * Subscribes to `conversation_typing` filtered to one conversation id
 * (RLS scopes it to the caller's account regardless). See migration
 * 045 — a human agent's ping goes through the `touch_conversation_
 * typing` RPC; the AI auto-reply pipeline writes the row directly
 * with the service-role client.
 */
export function useConversationTyping(
  conversationId: string | null | undefined,
): UseConversationTypingResult {
  const [row, setRow] = useState<ConversationTypingRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    let cancelled = false;

    const channel: RealtimeChannel = supabase
      .channel(`conversation_typing:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_typing",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRow(null);
            return;
          }
          setRow(payload.new as ConversationTypingRow);
        },
      )
      .subscribe();

    supabase
      .from("conversation_typing")
      .select("actor_type, updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        // A live event that arrived first (rare, but the subscribe
        // above races this fetch) must win over a staler snapshot.
        setRow((prev) => {
          if (prev && new Date(prev.updated_at) >= new Date(data.updated_at)) {
            return prev;
          }
          return data as ConversationTypingRow;
        });
      });

    const tick = setInterval(() => setNow(Date.now()), RE_DERIVE_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      supabase.removeChannel(channel);
      // Runs on thread switch (before the next effect body) AND on
      // unmount — either way, a stale row from this conversation must
      // never bleed into whatever's rendered next.
      setRow(null);
    };
  }, [conversationId]);

  return {
    isTyping: deriveIsTyping(row, now),
    actorType: row?.actor_type ?? null,
  };
}
