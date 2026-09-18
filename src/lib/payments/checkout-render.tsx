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
  return !!(
    topSection?.banner_image_url ||
    topSection?.product_image_url ||
    topSection?.title ||
    topSection?.subtitle
  )
}

/** "Parte superior" block — banner image, product image, title, subtitle. Renders nothing when empty. */
export function TopSectionBlock({ topSection }: { topSection?: PaymentPageTopSection }) {
  if (!hasTopSectionContent(topSection)) return null
  return (
    <div className="space-y-3 px-6 pt-6">
      {topSection?.banner_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={topSection.banner_image_url}
          alt=""
          className="w-full rounded-lg object-cover"
        />
      )}
      {topSection?.product_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={topSection.product_image_url}
          alt=""
          className="mx-auto block h-20 w-20 rounded-lg object-cover"
        />
      )}
      {topSection?.title && (
        <h2
          className="text-center font-bold text-foreground"
          style={{ fontSize: topSection.title_size ?? 36 }}
        >
          {topSection.title}
        </h2>
      )}
      {topSection?.subtitle && (
        <p
          className="text-center text-muted-foreground"
          style={{ fontSize: topSection.subtitle_size ?? 24 }}
        >
          {topSection.subtitle}
        </p>
      )}
    </div>
  )
}
