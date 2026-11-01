"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ToneId } from "./tones";

/**
 * Message-alert preferences. Stored per device/browser (localStorage)
 * on purpose: the user turns alerts on separately on desktop and on the
 * phone, and may want a different tone/volume on each.
 */
export interface AlertSettings {
  /** Play a sound when a customer message arrives. */
  sound: boolean;
  /** Show a system (OS) notification while the CRM tab is in background. */
  desktop: boolean;
  tone: ToneId;
  /** 0–1 */
  volume: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  sound: false,
  desktop: false,
  tone: "chime",
  volume: 0.7,
};

const KEY = "wacrm:message-alerts";
const EVENT = "wacrm:message-alerts-changed";

let cachedRaw: string | null | undefined;
let cached: AlertSettings = DEFAULT_ALERT_SETTINGS;

export function readAlertSettings(): AlertSettings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw
      ? { ...DEFAULT_ALERT_SETTINGS, ...(JSON.parse(raw) as Partial<AlertSettings>) }
      : DEFAULT_ALERT_SETTINGS;
  } catch {
    cached = DEFAULT_ALERT_SETTINGS;
  }
  return cached;
}

export function writeAlertSettings(next: AlertSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / blocked storage — settings just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAlertSettings(): [
  AlertSettings,
  (patch: Partial<AlertSettings>) => void,
] {
  const settings = useSyncExternalStore(
    subscribe,
    readAlertSettings,
    () => DEFAULT_ALERT_SETTINGS,
  );
  const update = useCallback((patch: Partial<AlertSettings>) => {
    writeAlertSettings({ ...readAlertSettings(), ...patch });
  }, []);
  return [settings, update];
}

/**
 * Cross-tab de-dupe: with the CRM open in several tabs, only the first
 * tab to claim a message id rings. Best-effort (localStorage has no
 * atomic CAS), but tabs receive Realtime events milliseconds apart.
 */
export function claimAlert(messageId: string): boolean {
  const k = `wacrm:alerted:${messageId}`;
  try {
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, String(Date.now()));
    // Drop the claim later so storage doesn't grow unbounded.
    setTimeout(() => {
      try {
        localStorage.removeItem(k);
      } catch {}
    }, 60_000);
  } catch {
    // No storage → every tab rings; acceptable.
  }
  return true;
}
