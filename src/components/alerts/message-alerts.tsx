"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import { claimAlert, readAlertSettings } from "@/lib/alerts/settings";
import { playTone, unlockAudio } from "@/lib/alerts/tones";
import { getServiceWorker, showSystemNotification } from "@/lib/alerts/notify";

const PREVIEW: Partial<Record<Message["content_type"], string>> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Voice message",
  document: "📄 Document",
  location: "📍 Location",
};

/**
 * Headless: rings / shows a system notification for every inbound
 * customer message while the CRM is open (any page, foreground or
 * background tab). Mounted once in the dashboard shell. Preferences
 * live per-device in localStorage — see `src/lib/alerts/settings.ts`.
 */
export function MessageAlerts() {
  const nameCache = useRef<Map<string, string>>(new Map());

  // Mobile browsers keep audio locked until a gesture: unlock on the
  // first tap anywhere so later alerts can sound.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (readAlertSettings().desktop) void getServiceWorker();

    const supabase = createClient();

    const contactName = async (conversationId: string): Promise<string> => {
      const hit = nameCache.current.get(conversationId);
      if (hit) return hit;
      const { data } = await supabase
        .from("conversations")
        .select("contact:contacts(name, phone)")
        .eq("id", conversationId)
        .maybeSingle();
      const c = (data as { contact?: { name?: string; phone?: string } | null } | null)
        ?.contact;
      const name = c?.name || c?.phone || "New message";
      nameCache.current.set(conversationId, name);
      return name;
    };

    const channel = supabase
      .channel("message-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "sender_type=eq.customer",
        },
        async (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_type !== "customer") return;
          const s = readAlertSettings();
          if (!s.sound && !s.desktop) return;

          // Already looking at this exact chat → no alert, like WhatsApp.
          const visible = document.visibilityState === "visible";
          const params = new URLSearchParams(window.location.search);
          if (
            visible &&
            window.location.pathname.startsWith("/inbox") &&
            params.get("c") === msg.conversation_id
          ) {
            return;
          }

          if (!claimAlert(msg.id)) return;

          if (s.sound) playTone(s.tone, s.volume);

          if (s.desktop && !visible) {
            const title = await contactName(msg.conversation_id);
            const body =
              msg.content_text?.trim() ||
              PREVIEW[msg.content_type] ||
              "New message";
            await showSystemNotification({
              title,
              body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
              url: `/inbox?c=${msg.conversation_id}`,
              tag: msg.conversation_id,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
