"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"

import type { PublicOrderBump } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { payPageStrings, type PayLocale } from "@/lib/payments/pay-page-i18n"
import { BUMP_GALLERY_IMAGE } from "@/lib/payments/checkout-limits"

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
        <BumpPreviewContent bump={bump} currency={currency} locale={locale} checked={checked} onToggle={onToggle} />
      </div>
    </div>
  )
}

/**
 * "Añadir a la compra" / "Añadido a tu compra" toggle of the pop-up.
 * Added state: light green pill with a check inside a green circle —
 * the same mark on phone, tablet and desktop. The label never wraps.
 */
function BumpToggleButton({
  checked,
  onToggle,
  label,
  className,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
        checked
          ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-emerald-600 text-white hover:bg-emerald-700",
        className,
      )}
    >
      {checked && (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 bg-white"
        >
          <Check className="size-3.5 text-emerald-600" strokeWidth={3.5} />
        </span>
      )}
      {label}
    </button>
  )
}

const THUMB_GAP = 8
const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * The pop-up's thumbnail strip, as an endless carousel: swiping it
 * (finger or mouse drag) slides the thumbnails one or more places, and
 * whichever lands in the FIRST slot is the one shown big above. It
 * loops — past the last image comes the first again — so the strip is
 * never left with an empty slot. Tapping a thumbnail slides it to the
 * first slot.
 *
 * The track renders the images three times (previous / visible / next
 * copy) and sits shifted left by one copy, so whatever direction it's
 * dragged there is always an image coming in. When a slide ends, `start`
 * moves and the track snaps back to the middle copy without animation —
 * the same picture, so the jump is invisible.
 */
function ThumbnailCarousel({
  images,
  start,
  onStartChange,
}: {
  images: string[]
  start: number
  onStartChange: (start: number) => void
}) {
  const n = images.length
  const viewportRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Drag offset in px while the finger is down, then the animated slide.
  const [dx, setDxState] = useState(0)
  // Mirrors `dx` for the pointer handlers: a quick flick can lift the
  // finger before React re-renders with the last move, and the release
  // must see that move or the swipe is lost.
  const dxRef = useRef(0)
  const setDx = (value: number) => {
    dxRef.current = value
    setDxState(value)
  }
  const [sliding, setSliding] = useState(false)
  const pendingSteps = useRef(0)
  const drag = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  // A drag ends with a click on the thumbnail under the finger — ignore it.
  const swallowClick = useRef(false)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const itemWidth = width > 0 ? (width - THUMB_GAP * (n - 1)) / n : 0
  const step = itemWidth + THUMB_GAP

  function slideBy(steps: number) {
    const target = -steps * step
    pendingSteps.current = steps
    setSliding(true)
    // Already there (e.g. a tap on the first thumbnail): no transition
    // would run, so finish right away.
    if (target === dxRef.current) finishSlide()
    else setDx(target)
  }

  function finishSlide() {
    const steps = pendingSteps.current
    pendingSteps.current = 0
    setSliding(false)
    setDx(0)
    if (steps) onStartChange(mod(start + steps, n))
  }

  function onPointerDown(e: React.PointerEvent) {
    // A swipe whose release produced no click must not eat this tap.
    swallowClick.current = false
    if (sliding || !step) return
    drag.current = { x: e.clientX, y: e.clientY, horizontal: null }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const ddx = e.clientX - d.x
    const ddy = e.clientY - d.y
    if (d.horizontal === null) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return
      // Mostly vertical = the buyer is scrolling the pop-up: let it.
      d.horizontal = Math.abs(ddx) > Math.abs(ddy)
      if (!d.horizontal) {
        drag.current = null
        return
      }
      // Keeps the moves coming when the finger leaves the strip. Throws
      // if the pointer is already gone — the swipe still works without it.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    }
    setDx(ddx)
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d?.horizontal) return
    swallowClick.current = true
    const dx = dxRef.current
    // Whole thumbnails dragged past, rounded; a short flick still moves one.
    let steps = Math.round(-dx / step)
    if (steps === 0 && Math.abs(dx) > step * 0.2) steps = dx < 0 ? 1 : -1
    slideBy(steps)
  }

  // Previous copy, visible copy, next copy — each rotated so the visible
  // copy starts at `start`.
  const track = Array.from({ length: 3 * n }, (_, k) => ({ k: k - n, src: images[mod(start + k - n, n)] }))

  return (
    <div
      ref={viewportRef}
      className="relative mt-5 cursor-grab select-none overflow-hidden active:cursor-grabbing"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.stopPropagation()
          e.preventDefault()
        }
      }}
    >
      <div
        className={cn("flex", sliding && "transition-transform duration-300 ease-out")}
        style={{ gap: THUMB_GAP, transform: `translateX(${-n * step + dx}px)` }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && sliding) finishSlide()
        }}
      >
        {track.map(({ k, src }) => {
          const index = mod(start + k, n)
          return (
            <button
              key={k}
              type="button"
              // Only the visible copy is reachable by keyboard / screen readers.
              tabIndex={k >= 0 && k < n ? 0 : -1}
              aria-hidden={k < 0 || k >= n}
              onClick={() => {
                if (!sliding && k > 0 && k < n) slideBy(k)
              }}
              aria-label={`${index + 1} / ${n}`}
              aria-current={k === 0}
              className={cn(
                "relative aspect-[4/5] shrink-0 overflow-hidden rounded-md bg-slate-50 shadow-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400",
              )}
              style={{ width: itemWidth || `calc((100% - ${THUMB_GAP * (n - 1)}px) / ${n})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
              {/* Thin border drawn over the image (an outer ring would be
                  clipped by the strip's overflow-hidden). */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_0_1px_#e2e8f0]"
              />
            </button>
          )
        })}
      </div>
      {/* The amber frame belongs to the first SLOT, not to a thumbnail:
          it stays put while the thumbnails slide under it, so the
          selected one is always framed, even mid-swipe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 rounded-md shadow-[inset_0_0_0_3px_#fbbf24]"
        style={{ width: itemWidth || `calc((100% - ${THUMB_GAP * (n - 1)}px) / ${n})` }}
      />
    </div>
  )
}

/**
 * The pop-up's body (images, copy, prices, add button, thumbnails) —
 * shared by the checkout's eye pop-up above and the admin's "Vista
 * previa" in the order bumps dialog, so the merchant previews exactly
 * what the buyer will see.
 */
export function BumpPreviewContent({
  bump,
  currency,
  locale,
  checked,
  onToggle,
}: {
  bump: PublicOrderBump
  currency: string
  locale: PayLocale
  checked: boolean
  onToggle: () => void
}) {
  const t = payPageStrings[locale]
  const gallery = bump.gallery_images ?? []
  // The image in the thumbnail strip's first slot — shown big.
  const [start, setStart] = useState(0)
  const mainImage = gallery[start] ?? gallery[0] ?? null
  // The pop-up's own copy (migration 065), else the checkout box's.
  const title = bump.popup_title || bump.title
  const description = bump.popup_description || bump.description
  const buttonLabel = checked ? bump.popup_added_label || t.bumpAdded : bump.popup_button_label || t.addToPurchase

  return (
    <>
      <div className="grid grid-cols-1 items-center gap-4 min-[380px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex min-h-[200px] items-center justify-center">
          {mainImage ? (
            // One fixed frame (BUMP_GALLERY_IMAGE: the mockup shape, 11:15) for every
            // gallery image: each one is scaled to fill it — up or down —
            // so switching thumbnails changes the picture, never its size.
            // A small image (e.g. 130×164) is enlarged and may look soft.
            // Inline style, not Tailwind arbitrary classes: those weren't
            // generated, which left the frame 0px tall (blank pop-up).
            <div
              className="relative w-full"
              style={{
                aspectRatio: `${BUMP_GALLERY_IMAGE.width} / ${BUMP_GALLERY_IMAGE.height}`,
                maxWidth: `calc(52vh * ${BUMP_GALLERY_IMAGE.width} / ${BUMP_GALLERY_IMAGE.height})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={mainImage}
                src={mainImage}
                alt=""
                className="absolute inset-0 size-full object-contain drop-shadow-[0_16px_20px_rgba(15,23,42,0.28)] animate-in fade-in duration-300"
              />
            </div>
          ) : bump.image_url ? (
            <BookMockup src={bump.image_url} />
          ) : null}
        </div>

        <div className="min-w-0 pr-1">
          <h2
            id="bump-preview-title"
            className="pr-6 text-[19px] font-extrabold leading-tight text-slate-900 sm:text-[22px]"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600 sm:text-[15px]">{description}</p>
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
          {/* Tablet/desktop: in the text column, full width. */}
          <BumpToggleButton
            checked={checked}
            onToggle={onToggle}
            label={buttonLabel}
            className="mt-4 hidden w-full sm:inline-flex"
          />
        </div>
      </div>

      {/* Phone: the text column is too narrow for "Añadido a tu compra" on
          one line, so the button sits on its own row under both columns,
          right-aligned and as wide as its label. */}
      <div className="mt-3 flex justify-end sm:hidden">
        <BumpToggleButton
          checked={checked}
          onToggle={onToggle}
          label={buttonLabel}
          className="inline-flex"
        />
      </div>

      {gallery.length > 1 && <ThumbnailCarousel images={gallery} start={start} onStartChange={setStart} />}
    </>
  )
}
