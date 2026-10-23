"use client"

import { Check, Eye } from "lucide-react"

import type { PublicOrderBump } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { PayPageStrings } from "@/lib/payments/pay-page-i18n"
import { BUMP_BOX_FONT_SIZES } from "@/lib/payments/checkout-limits"

/** Box height at the default font sizes. */
const BOX_HEIGHT = 152

/**
 * Font sizes + line heights of the box's text, and the box height that
 * fits them: the defaults give a 152px box (134px before the prices
 * got their own line), and every px a bigger font adds to the 2-line
 * title/description slots (or the checkbox row) is added to the box,
 * so nothing is ever cut off.
 */
function boxLayout(sizes: PublicOrderBump["box_font_sizes"] | undefined) {
  const title = sizes?.title ?? BUMP_BOX_FONT_SIZES.title.default
  const description = sizes?.description ?? BUMP_BOX_FONT_SIZES.description.default
  const checkbox = sizes?.checkbox ?? null
  const titleLine = Math.round((title * 4) / 3)
  const descriptionLine = Math.round(description * 1.39)
  const extra =
    2 * (titleLine - 18) + 2 * (descriptionLine - 16) + (checkbox ? Math.max(0, Math.round(checkbox * 1.5 - 22.5)) : 0)
  return { title, titleLine, description, descriptionLine, checkbox, height: BOX_HEIGHT + Math.max(0, extra) }
}

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
 * short bump never renders smaller than a long one. Only the font
 * sizes the merchant picks (`box_font_sizes`) change that height.
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
  t: Pick<PayPageStrings, "addToPurchase" | "bumpAdded" | "viewBumpDetails">
}) {
  const hasPreview = bump.gallery_images.length > 0 || !!bump.image_url
  const layout = boxLayout(bump.box_font_sizes)
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border-2 border-dashed p-3 transition-colors",
        checked ? "border-emerald-500 bg-emerald-50" : "border-amber-300 bg-[#fffbea] hover:bg-amber-50",
      )}
      style={{ height: layout.height }}
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
        <p
          className="line-clamp-2 shrink-0 font-bold text-slate-900"
          style={{ fontSize: layout.title, lineHeight: `${layout.titleLine}px`, height: 2 * layout.titleLine }}
        >
          {bump.title}
        </p>
        <p
          className="mt-0.5 line-clamp-2 shrink-0 text-slate-500"
          style={{
            fontSize: layout.description,
            lineHeight: `${layout.descriptionLine}px`,
            height: 2 * layout.descriptionLine,
          }}
        >
          {bump.description}
        </p>
        {/* Prices on their own line above the checkbox, so the checkbox
            label gets the full width — beside the prices it was cut to
            "Añadido a…" on phones. The struck-through "before" price
            (migration 062) frames the bump price as a deal. */}
        <span className="mt-auto self-end whitespace-nowrap leading-[18px]">
          {bump.compare_at_price != null && (
            <span className="mr-1.5 text-[11px] text-slate-400 line-through">
              {formatPaymentAmount(bump.compare_at_price, currency)}
            </span>
          )}
          <span className="text-sm font-extrabold text-slate-900">{formatPaymentAmount(bump.price, currency)}</span>
        </span>
        <div className="mt-1 flex min-w-0 items-center">
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
            {/* Default: 14px on phones, 15px from sm up; a picked size applies everywhere. */}
            <span
              className={cn(
                "truncate font-medium text-slate-800",
                layout.checkbox == null && "text-[14px] sm:text-[15px]",
              )}
              style={layout.checkbox != null ? { fontSize: layout.checkbox } : undefined}
            >
              {checked ? bump.checkbox_added_label || t.bumpAdded : bump.checkbox_label || t.addToPurchase}
            </span>
          </span>
        </div>
      </div>
    </label>
  )
}
