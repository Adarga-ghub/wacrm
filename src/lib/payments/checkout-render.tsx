import type { CSSProperties } from "react"

import type { PaymentPageBackground, PaymentPageTopSection } from "@/types"
import type { PayLocale } from "@/lib/payments/pay-page-i18n"

/** ES/EN toggle shared by the real checkout page (`/pay/[slug]`) and the skin preview page (`/pay/preview`). */
export function LanguageToggle({
  locale,
  onChange,
}: {
  locale: PayLocale
  onChange: (l: PayLocale) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1 border-b border-border/60 bg-muted/30 px-3 py-1.5">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={locale === l}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors ${
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/**
 * "Fondo" block (see the Payment Skins builder) — page-wide
 * background behind the checkout Card. Shared by the real checkout
 * page (`/pay/[slug]`) and the skin preview page (`/pay/preview`) so
 * a preview is pixel-for-pixel what a real checkout page would show.
 */
export function backgroundStyle(background?: PaymentPageBackground): CSSProperties {
  if (!background) return {}
  if ((background.type ?? "color") === "color") {
    return background.color ? { backgroundColor: background.color } : {}
  }
  if (!background.image_url) return {}
  return {
    backgroundImage: `url(${background.image_url})`,
    backgroundSize: background.fill ? "cover" : "auto",
    backgroundRepeat: background.fill ? "no-repeat" : background.repeat ? "repeat" : "no-repeat",
    backgroundAttachment: background.fixed ? "fixed" : "scroll",
    backgroundPosition: "center",
  }
}

export function hasTopSectionContent(topSection?: PaymentPageTopSection): boolean {
  return !!topSection?.banner_image_url
}

/**
 * "Parte superior" block — a purely decorative marketing banner now
 * (see `PaymentPageTopSection`'s header comment). The product's
 * title/description/image/author render separately, driven by the
 * linked `PublicPaymentProduct` — see `/pay/[slug]/page.tsx`.
 * Renders nothing when no banner is set.
 */
export function TopSectionBlock({ topSection }: { topSection?: PaymentPageTopSection }) {
  if (!hasTopSectionContent(topSection)) return null
  return (
    <div className="px-4 pt-4 sm:px-6 sm:pt-6">
      {/* `aspect-[3/1]` matches the editor's recommended 1200×400
          upload — fixes the banner's height at a predictable ratio of
          whatever width the card renders at (full-bleed on a phone,
          ~28rem on desktop) instead of the image's own natural aspect
          ratio, which would otherwise make the card jump to a
          different height per skin/device. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={topSection?.banner_image_url}
        alt=""
        className="aspect-[3/1] w-full rounded-lg object-cover"
      />
    </div>
  )
}
