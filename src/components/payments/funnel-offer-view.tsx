"use client"

// ============================================================
// Upsell / downsell sales page (migration 063) — the presentational
// half, shared by the live page (`/pay/offer/[token]`) and the admin
// preview (`/pay/offer/preview`). It renders the merchant's copy from
// `payment_funnel_steps.page` with the page's own defaults for anything
// left empty; the parent owns payment (`paymentSlot`) and "No, gracias".
// ============================================================

import { useEffect, useState, type ReactNode } from "react"
import { Check, CheckCircle2, Clock, Gift, ShieldCheck } from "lucide-react"

import type { PublicFunnelOffer } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { FunnelPageStrings } from "@/lib/payments/funnel-page-i18n"

/** Countdown that survives a reload: the deadline is remembered per `storageKey` for this tab. */
function useCountdown(minutes: number | undefined, storageKey: string) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!minutes) return
    let deadline = Date.now() + minutes * 60_000
    try {
      const stored = Number(sessionStorage.getItem(storageKey))
      if (stored > Date.now() - 24 * 3600_000) deadline = stored
      else sessionStorage.setItem(storageKey, String(deadline))
    } catch {}
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [minutes, storageKey])
  return remaining
}

function StepsBar({ t }: { t: FunnelPageStrings }) {
  const steps = [
    { label: t.stepOrder, state: "done" },
    { label: t.stepOffer, state: "current" },
    { label: t.stepAccess, state: "todo" },
  ] as const
  return (
    <ol className="flex items-center justify-center gap-2 text-[11px] font-medium sm:gap-3 sm:text-xs">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                step.state === "done" && "bg-emerald-600 text-white",
                step.state === "current" && "bg-[#1f2937] text-white",
                step.state === "todo" && "border border-slate-300 bg-white text-slate-400",
              )}
            >
              {step.state === "done" ? <Check className="size-3" strokeWidth={3.5} /> : i + 1}
            </span>
            <span className={step.state === "todo" ? "text-slate-400" : "text-slate-700"}>{step.label}</span>
          </span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-slate-300 sm:w-10" />}
        </li>
      ))}
    </ol>
  )
}

export function FunnelOfferView({
  offer,
  t,
  buyerName,
  timerKey,
  paymentSlot,
  onDecline,
  declining,
  preview,
}: {
  offer: PublicFunnelOffer
  t: FunnelPageStrings
  buyerName: string | null
  /** sessionStorage key for the countdown deadline. */
  timerKey: string
  /** The accept button + payment buttons, owned by the parent. */
  paymentSlot: ReactNode
  onDecline: () => void
  declining?: boolean
  preview?: boolean
}) {
  const page = offer.page
  const firstItem = offer.items[0]
  const productLabel = offer.items.map((i) => i.name).join(" + ")
  const headline = page.headline || t.defaultHeadline[offer.kind](productLabel)
  const banner = page.banner || t.defaultBanner[offer.kind]
  const covers = page.image_url
    ? [page.image_url]
    : offer.items.map((i) => i.image_url).filter((u): u is string => !!u)
  const remaining = useCountdown(page.timer_minutes, timerKey)
  const savePercent =
    offer.compare_at_price != null
      ? Math.round((1 - offer.price / offer.compare_at_price) * 100)
      : null

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      {preview && (
        <div className="bg-indigo-600 px-4 py-1.5 text-center text-xs font-medium text-white">
          {t.previewBadge} · {t.previewNote}
        </div>
      )}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2.5 text-center text-sm font-bold tracking-wide text-white sm:text-base">
        {banner}
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-10 sm:py-8">
        <StepsBar t={t} />

        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" />
          {t.orderConfirmed(buyerName)}
        </p>

        <div className="space-y-3 text-center">
          <h1
            className="text-2xl leading-tight font-extrabold text-[#111827] sm:text-[2rem]"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {headline}
          </h1>
          {page.subheadline && (
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg">{page.subheadline}</p>
          )}
        </div>

        <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:gap-8">
          <div className="relative mx-auto flex w-full max-w-xs items-center justify-center">
            {covers.length === 0 ? (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
                <Gift className="size-16 text-slate-300" />
              </div>
            ) : covers.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={covers[0]}
                alt={productLabel}
                className="w-full rounded-xl object-cover shadow-2xl ring-1 ring-black/10"
              />
            ) : (
              <div className="flex w-full items-center justify-center">
                {covers.slice(0, 3).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src + i}
                    src={src}
                    alt=""
                    className={cn(
                      "w-1/2 rounded-xl object-cover shadow-2xl ring-2 ring-white",
                      i > 0 && "-ml-6",
                      i % 2 === 1 ? "rotate-3" : "-rotate-3",
                    )}
                    style={{ zIndex: 10 - i }}
                  />
                ))}
              </div>
            )}
            {savePercent != null && savePercent > 0 && (
              <span className="absolute -top-3 -right-2 z-20 rotate-6 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-[#111827] shadow-md">
                -{savePercent}%
              </span>
            )}
          </div>

          <div className="space-y-4">
            {offer.items.length > 1 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">{t.includes}</p>
                <ul className="space-y-1">
                  {offer.items.map((item) => (
                    <li key={item.name} className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                      <Gift className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {offer.items.length === 1 && firstItem.author && (
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{firstItem.name}</span> · {firstItem.author}
              </p>
            )}
            {page.bullets && page.bullets.length > 0 && (
              <ul className="space-y-2.5">
                {page.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug text-slate-700">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="size-3.5 text-emerald-700" strokeWidth={3} />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {page.body && (
          <p className="mx-auto max-w-2xl text-center text-[15px] leading-relaxed whitespace-pre-line text-slate-600">
            {page.body}
          </p>
        )}

        <div className="mx-auto max-w-md space-y-4 rounded-2xl border-2 border-dashed border-emerald-500/60 bg-emerald-50/50 p-5 text-center">
          {remaining != null && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-red-600">
              <Clock className="size-4" />
              <span>{t.expiresIn}</span>
              <span className="rounded-md bg-red-600 px-2 py-0.5 font-mono text-white tabular-nums">
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          <div>
            {offer.compare_at_price != null && (
              <p className="text-sm text-slate-500">
                {t.before}{" "}
                <span className="line-through">{formatPaymentAmount(offer.compare_at_price, offer.currency)}</span>
                {savePercent != null && savePercent > 0 && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                    {t.youSave(savePercent)}
                  </span>
                )}
              </p>
            )}
            <p className="text-4xl font-extrabold text-[#111827]">
              {formatPaymentAmount(offer.price, offer.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t.oneTimePayment}</p>
          </div>

          {paymentSlot}

          <button
            type="button"
            onClick={onDecline}
            disabled={declining}
            className="text-sm text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700 disabled:opacity-50"
          >
            {page.decline_label || t.defaultDecline}
          </button>
        </div>

        {page.guarantee && (
          <p className="mx-auto flex max-w-xl items-start justify-center gap-2 text-center text-xs text-slate-500">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            {page.guarantee}
          </p>
        )}
      </div>
    </div>
  )
}

/** The big green "Sí, lo quiero" button — the parent swaps it for the PayPal buttons once clicked. */
export function FunnelAcceptButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-emerald-600 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60 sm:text-lg"
    >
      {label}
    </button>
  )
}
