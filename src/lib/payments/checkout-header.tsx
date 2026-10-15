"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Orbitron } from "next/font/google"
import { AlarmClock, Gift } from "lucide-react"

import type { PaymentFormDesign } from "@/types"
import { payPageStrings, type PayLocale } from "@/lib/payments/pay-page-i18n"
import { urgencyDurationSeconds } from "@/lib/payments/checkout-limits"

// Squared, "digital display" face for the countdown digits only.
const timerFont = Orbitron({ subsets: ["latin"], weight: ["600", "800"], display: "swap" })

/** Neon green of the countdown — digits, icon and glow all derive from it. */
const NEON = "#39ff88"
const NEON_RGB = "57, 255, 136"

/** Whether the checkout shows its logo: needs a URL, and the switch not turned off (undefined = on). */
export function showsLogo(design?: PaymentFormDesign): boolean {
  return !!design?.logo_url && design.logo_enabled !== false
}

/** Whether the urgency line + countdown are on and have a duration to count down from. */
export function showsUrgency(design?: PaymentFormDesign): boolean {
  return !!design?.urgency?.enabled && urgencyDurationSeconds(design.urgency) > 0
}

/**
 * Seconds left on the countdown. The deadline is "first visit +
 * configured duration" and is kept in this browser's localStorage under
 * `storageKey` (plus the duration, so editing the duration in the admin
 * starts a fresh countdown) — a reload continues where it was instead of
 * restarting, which would make the timer meaningless. Stops at 0.
 * `storageKey` null = don't persist (the skin preview page).
 */
function useCountdown(durationSeconds: number, storageKey: string | null): number {
  const [remaining, setRemaining] = useState(durationSeconds)

  useEffect(() => {
    const key = storageKey ? `wacrm:checkout-timer:${storageKey}:${durationSeconds}` : null
    let deadline = Date.now() + durationSeconds * 1000
    if (key) {
      try {
        const stored = Number(localStorage.getItem(key))
        if (stored > 0) deadline = stored
        else localStorage.setItem(key, String(deadline))
      } catch {
        // Storage blocked — the countdown just restarts on reload.
      }
    }
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [durationSeconds, storageKey])

  return remaining
}

function UrgencyTimer({
  durationSeconds,
  storageKey,
  locale,
}: {
  durationSeconds: number
  storageKey: string | null
  locale: PayLocale
}) {
  const t = payPageStrings[locale]
  const remaining = useCountdown(durationSeconds, storageKey)
  const parts = [
    { value: Math.floor(remaining / 3600), label: t.timerHours },
    { value: Math.floor((remaining % 3600) / 60), label: t.timerMinutes },
    { value: remaining % 60, label: t.timerSeconds },
  ]
  const glow = `0 0 6px rgba(${NEON_RGB}, 0.75), 0 0 14px rgba(${NEON_RGB}, 0.35)`

  return (
    <div
      role="timer"
      aria-label={parts.map((p) => `${p.value} ${p.label}`).join(", ")}
      className="inline-flex items-center gap-2.5 rounded-xl px-3 py-1.5"
      style={{
        background: "linear-gradient(160deg, #0c2437 0%, #04111d 100%)",
        border: `1px solid rgba(${NEON_RGB}, 0.35)`,
        boxShadow: `0 0 12px rgba(${NEON_RGB}, 0.22), inset 0 0 14px rgba(${NEON_RGB}, 0.07)`,
      }}
    >
      <AlarmClock
        aria-hidden
        className="size-6 shrink-0"
        strokeWidth={2.2}
        style={{ color: NEON, filter: `drop-shadow(0 0 4px rgba(${NEON_RGB}, 0.8))` }}
      />
      <div className={`${timerFont.className} flex items-start`} aria-hidden>
        {parts.map((part, i) => (
          <div key={part.label} className="flex items-start">
            {i > 0 && (
              <span
                className="px-1 text-[19px] font-semibold leading-[22px] motion-safe:animate-pulse"
                style={{ color: NEON, textShadow: glow }}
              >
                :
              </span>
            )}
            <div className="flex w-[34px] flex-col items-center">
              <span
                className="text-[21px] font-extrabold leading-[22px] tabular-nums"
                style={{ color: NEON, textShadow: glow }}
              >
                {String(part.value).padStart(2, "0")}
              </span>
              <span
                className="mt-0.5 font-sans text-[6.5px] font-semibold uppercase leading-none tracking-[0.1em]"
                style={{ color: `rgba(${NEON_RGB}, 0.6)` }}
              >
                {part.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Top bar of the checkout card: logo + urgency line + countdown on the
 * left (each one optional — see `showsLogo`/`showsUrgency`), and
 * `right` (the country picker, or the preview's language toggle) on
 * the right. With neither logo nor urgency it collapses to the plain
 * one-line bar the checkout always had.
 */
export function CheckoutTopBar({
  design,
  locale,
  timerStorageKey,
  right,
}: {
  design?: PaymentFormDesign
  locale: PayLocale
  /** Per-offer key for the countdown's deadline — null = don't persist. */
  timerStorageKey: string | null
  right: ReactNode
}) {
  const t = payPageStrings[locale]
  const logo = showsLogo(design)
  const urgency = showsUrgency(design)

  if (!logo && !urgency) {
    return (
      <div className="flex items-center justify-end border-b border-border/60 bg-muted/30 px-3 py-1.5">{right}</div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={design!.logo_url}
            alt=""
            className="size-12 shrink-0 rounded-full bg-white object-cover shadow-sm ring-1 ring-black/10"
          />
        )}
        {urgency && (
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold leading-tight text-slate-800">
              <span className="truncate">{design!.urgency!.text?.trim() || t.urgencyDefaultText}</span>
              <Gift aria-hidden className="size-4 shrink-0 text-amber-500" strokeWidth={2.4} />
            </p>
            <UrgencyTimer
              durationSeconds={urgencyDurationSeconds(design!.urgency)}
              storageKey={timerStorageKey}
              locale={locale}
            />
          </div>
        )}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  )
}
