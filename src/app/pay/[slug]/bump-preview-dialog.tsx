"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"

import type { PublicOrderBump } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { payPageStrings, type PayLocale } from "@/lib/payments/pay-page-i18n"

/**
 * A flat cover drawn as a 3D book (perspective tilt, page edges, spine
 * shading) — the pop-up's main image when the bump has no gallery of
 * its own, so it still looks like a product mockup instead of a flat
 * thumbnail blown up.
 */
function BookMockup({ src }: { src: string }) {
  return (
    <div className="flex w-full justify-center py-2" style={{ perspective: "1100px" }}>
      <div
        className="relative w-[82%]"
        style={{ transform: "rotateY(-22deg) rotateX(4deg)", transformStyle: "preserve-3d" }}
      >
        {/* Page block peeking out on the right. */}
        <div
          aria-hidden
          className="absolute inset-y-[1.5%] -right-[9px] w-[12px] rounded-r-[3px]"
          style={{
            background: "repeating-linear-gradient(to bottom, #fafaf9 0 2px, #e7e5e4 2px 3px)",
            transform: "translateZ(-8px)",
            boxShadow: "inset -2px 0 4px rgba(0,0,0,0.12)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="relative block w-full rounded-r-md rounded-l-[3px] object-cover"
          style={{ boxShadow: "18px 22px 28px rgba(15, 23, 42, 0.35), 4px 4px 8px rgba(15, 23, 42, 0.2)" }}
        />
        {/* Spine shading + a soft gloss across the cover. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[8%] rounded-l-[3px]"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.38), rgba(255,255,255,0.22) 45%, rgba(0,0,0,0.12))",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-r-md"
          style={{ background: "linear-gradient(110deg, rgba(255,255,255,0.22), transparent 42%)" }}
        />
      </div>
    </div>
  )
}

/**
 * Order bump preview pop-up — opened from the "eye" under a bump's
 * cover on the checkout. Main image (the first gallery image — usually
 * a perspective mockup — or the cover drawn as a 3D book), the bump's
 * title, description and prices, and the rest of the gallery as
 * thumbnails that swap the main image.
 *
 * Rendered in place (not portaled) with fixed light colors, like the
 * checkout's other overlays: the dashboard's dark theme variables would
 * otherwise leak into a portal outside `.pay-page-surface`. `z-[1000]`
 * clears PayPal's button iframes (inline `z-index: 100`).
 */
export function BumpPreviewDialog({
  bump,
  currency,
  locale,
  checked,
  onToggle,
  onClose,
}: {
  bump: PublicOrderBump
  currency: string
  locale: PayLocale
  checked: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const t = payPageStrings[locale]
  const gallery = bump.gallery_images ?? []
  const [selected, setSelected] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes; the page behind doesn't scroll while it's open.
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const mainImage = gallery[selected] ?? null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[3px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bump-preview-title"
        className="relative max-h-[92vh] w-full max-w-[34rem] overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute right-3 top-3 rounded-full p-1 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <X className="size-6" strokeWidth={2.2} />
        </button>

        <div className="grid grid-cols-1 items-center gap-4 min-[380px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex min-h-[200px] items-center justify-center">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={mainImage}
                src={mainImage}
                alt=""
                className="max-h-[52vh] w-auto max-w-full object-contain drop-shadow-[0_16px_20px_rgba(15,23,42,0.28)] animate-in fade-in duration-300"
              />
            ) : bump.image_url ? (
              <BookMockup src={bump.image_url} />
            ) : null}
          </div>

          <div className="min-w-0 pr-1">
            <h2
              id="bump-preview-title"
              className="pr-6 text-[19px] font-extrabold leading-tight text-slate-900 sm:text-[22px]"
            >
              {bump.title}
            </h2>
            {bump.description && (
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600 sm:text-[15px]">{bump.description}</p>
            )}
            <div className="mt-4">
              {bump.compare_at_price != null && (
                <p className="text-[15px] text-slate-400 line-through sm:text-base">
                  {formatPaymentAmount(bump.compare_at_price, currency)}
                </p>
              )}
              <p className="text-[26px] font-extrabold leading-tight text-red-600 sm:text-[30px]">
                {formatPaymentAmount(bump.price, currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={checked}
              className={cn(
                "mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
                checked
                  ? "border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
            >
              {checked && <Check className="size-4" strokeWidth={3} />}
              {checked ? t.bumpAdded : t.addToPurchase}
            </button>
          </div>
        </div>

        {gallery.length > 1 && (
          <div
            className="mt-5 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${gallery.length}, minmax(0, 1fr))` }}
          >
            {gallery.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${i + 1} / ${gallery.length}`}
                aria-current={i === selected}
                className={cn(
                  "aspect-[4/5] overflow-hidden rounded-md bg-slate-50 shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-amber-400",
                  i === selected ? "ring-[3px] ring-amber-400" : "ring-1 ring-slate-200 hover:ring-slate-300",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
