"use client"

import { Check, Eye } from "lucide-react"

import type { PublicOrderBump } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { PayPageStrings } from "@/lib/payments/pay-page-i18n"

/**
 * One order bump box as the buyer sees it on the checkout — cover + eye
 * button, title, description, "Añadir a la compra" checkbox and prices.
 * Shared by the checkout (`/pay/[slug]`) and the admin's "Vista previa"
 * in the order bumps dialog, so the preview can't drift from the real
 * thing.
 *
 * Every box is the SAME fixed height whatever its copy: title and
 * description are clamped to 2 lines each in fixed-height slots (the
 * admin caps their length to match — see CHECKOUT_TEXT_LIMITS), so a
 * short bump never renders smaller than a long one.
 */
export function OrderBumpBox({
  bump,
  currency,
  checked,
  onCheckedChange,
  onPreview,
  t,
}: {
  bump: PublicOrderBump
  currency: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Opens the eye pop-up — the eye is only shown when there's something to preview. */
  onPreview: () => void
  t: Pick<PayPageStrings, "addToPurchase" | "viewBumpDetails">
}) {
  const hasPreview = bump.gallery_images.length > 0 || !!bump.image_url
  return (
    <label
      className={cn(
        "flex h-[134px] cursor-pointer gap-3 rounded-xl border-2 border-dashed p-3 transition-colors",
        checked ? "border-emerald-500 bg-emerald-50" : "border-amber-300 bg-[#fffbea] hover:bg-amber-50",
      )}
    >
      <div className="flex w-[60px] shrink-0 flex-col items-center gap-1.5">
        {bump.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bump.image_url}
            alt=""
            className="size-[60px] rounded-md object-cover shadow-sm ring-1 ring-black/10"
          />
        ) : (
          <span className="size-[60px] rounded-md bg-amber-100 ring-1 ring-black/5" />
        )}
        {hasPreview && (
          <button
            type="button"
            onClick={(e) => {
              // Inside the <label>: without preventDefault the click
              // would also tick the checkbox.
              e.preventDefault()
              e.stopPropagation()
              onPreview()
            }}
            aria-label={`${t.viewBumpDetails}: ${bump.title}`}
            title={t.viewBumpDetails}
            className="rounded-full p-1 text-slate-800 transition-colors hover:bg-black/5 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            <Eye className="size-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 h-[36px] text-[13.5px] leading-[18px] font-bold text-slate-900">{bump.title}</p>
        <p className="mt-0.5 line-clamp-2 h-[32px] text-[11.5px] leading-[16px] text-slate-500">{bump.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {/* Drawn by us (`appearance-none` + a Check icon), NOT the
                browser's native checkbox: a phone in system dark mode
                painted the native one dark/black even on this light
                page, so it looked different from desktop. These fixed
                colors render the same on every device and color scheme. */}
            <span className="relative inline-flex size-[18px] shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onCheckedChange(e.target.checked)}
                className="peer size-[18px] cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-slate-800 bg-white transition-colors checked:border-emerald-600 checked:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              />
              <Check
                aria-hidden
                strokeWidth={3.5}
                className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100"
              />
            </span>
            <span className="truncate text-[14px] font-medium text-slate-800 sm:text-[15px]">{t.addToPurchase}</span>
          </span>
          {/* The struck-through "before" price (migration 062) frames the
              bump price as a deal. */}
          <span className="shrink-0 whitespace-nowrap">
            {bump.compare_at_price != null && (
              <span className="mr-1.5 text-[11px] text-slate-400 line-through">
                {formatPaymentAmount(bump.compare_at_price, currency)}
              </span>
            )}
            <span className="text-sm font-extrabold text-slate-900">{formatPaymentAmount(bump.price, currency)}</span>
          </span>
        </div>
      </div>
    </label>
  )
}
