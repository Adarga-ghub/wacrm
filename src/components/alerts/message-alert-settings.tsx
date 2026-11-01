"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Info, Play, Volume1, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAlertSettings } from "@/lib/alerts/settings";
import { TONES, playTone, unlockAudio, type ToneId } from "@/lib/alerts/tones";
import {
  getServiceWorker,
  notificationPermission,
  requestNotificationPermission,
  showSystemNotification,
} from "@/lib/alerts/notify";

type Perm = NotificationPermission | "unsupported";

function isIosBrowserTab(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/**
 * "Message alerts" card on the Notifications page: per-device toggle
 * for sound + system notifications, tone picker (with preview) and
 * volume. The listener itself is `MessageAlerts` in the dashboard shell.
 */
export function MessageAlertSettings() {
  const [settings, update] = useAlertSettings();
  const [perm, setPerm] = useState<Perm>("default");
  const [iosTab, setIosTab] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerm(notificationPermission());
    setIosTab(isIosBrowserTab());
  }, []);

  const pickTone = (id: ToneId) => {
    unlockAudio();
    update({ tone: id });
    playTone(id, settings.volume);
  };

  const toggleSound = (on: boolean) => {
    unlockAudio();
    update({ sound: on });
    if (on) playTone(settings.tone, settings.volume);
  };

  const toggleDesktop = async (on: boolean) => {
    if (!on) {
      update({ desktop: false });
      return;
    }
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      void getServiceWorker();
      update({ desktop: true });
    } else if (p === "denied") {
      toast.error("Notifications are blocked for this site in your browser settings.");
    } else if (p === "unsupported") {
      toast.error("This browser doesn't support system notifications.");
    }
  };

  const sendTest = async () => {
    unlockAudio();
    if (settings.sound) playTone(settings.tone, settings.volume);
    if (settings.desktop && perm === "granted") {
      await showSystemNotification({
        title: "Test alert",
        body: "This is how a new WhatsApp message will look.",
        url: "/inbox",
        tag: "wacrm-test",
      });
    }
    if (!settings.sound && !settings.desktop) {
      toast.message("Turn on sound or system notifications first.");
    }
  };

  const enabled = settings.sound || settings.desktop;

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <BellRing className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Message alerts</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  enabled
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {enabled ? "On" : "Off"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Get alerted every time a customer writes in. Settings apply to this
              device only — turn them on separately on your phone.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={sendTest} className="self-start sm:self-auto">
          <Play className="h-4 w-4" />
          Test alert
        </Button>
      </div>

      <div className="divide-y divide-border">
        {/* Sound */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Sound</p>
            <p className="text-xs text-muted-foreground">
              Play a tone when a new message arrives (except in the chat you have open).
            </p>
          </div>
          <Switch
            checked={settings.sound}
            onCheckedChange={(v) => toggleSound(!!v)}
            aria-label="Alert sound"
          />
        </div>

        {/* System notifications */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">System notifications</p>
            <p className="text-xs text-muted-foreground">
              Show a pop-up with the contact and message when the CRM is in another
              tab or minimized. Tap it to open the chat.
            </p>
            {perm === "denied" && (
              <p className="mt-1 text-xs text-destructive">
                Blocked by the browser. Allow notifications for this site (lock icon
                next to the address) and try again.
              </p>
            )}
          </div>
          <Switch
            checked={settings.desktop && perm === "granted"}
            onCheckedChange={(v) => void toggleDesktop(!!v)}
            disabled={perm === "unsupported"}
            aria-label="System notifications"
          />
        </div>

        {/* Tone picker */}
        <div className={cn("space-y-3 p-4", !settings.sound && "opacity-60")}>
          <p className="text-sm font-medium text-foreground">Tone</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TONES.map((t) => {
              const active = settings.tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTone(t.id)}
                  aria-pressed={active}
                  className={cn(
                    "group relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t.label}</span>
                    {active ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {t.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 pt-1">
            <Volume1 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              onPointerUp={() => playTone(settings.tone, settings.volume)}
              onKeyUp={() => playTone(settings.tone, settings.volume)}
              aria-label="Alert volume"
              className="h-1.5 w-full max-w-xs cursor-pointer accent-primary"
            />
            <Volume2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
        </div>

        {/* Mobile caveats */}
        <div className="flex gap-2 p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>
            Alerts work while the CRM is open in the browser (any page, even in a
            background tab). On phones, keep the CRM tab open and your phone off
            silent mode; the phone may pause the page when the screen is locked.
            {iosTab &&
              " On iPhone, notifications only work after adding the CRM to the Home Screen (Share → Add to Home Screen) and opening it from there."}
          </p>
        </div>
      </div>
    </section>
  );
}
