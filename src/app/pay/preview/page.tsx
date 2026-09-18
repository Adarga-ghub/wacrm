"use client"

// ============================================================
// /pay/preview — standalone rendering of a checkout page's
// cosmetics ONLY (background, top section, accent color, logo). No
// real form, no PayPal SDK, no backend calls — the "design" query
// param (built by `buildSkinPreviewUrl`) carries the WHOLE
// `PaymentFormDesign` object as JSON, so the Payment Skins editor can
// preview in-progress, unsaved edits by opening this in a new tab
// with no save round trip first. Renders the same shared pieces
// (`src/lib/payments/checkout-render.tsx`) the real `/pay/[slug]`
// page uses, so what you see here is what a real checkout page with
// this design would look like.
// ============================================================

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CreditCard, Eye, Loader2 } from "lucide-react"

import type { PaymentFormDesign } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { payPageStrings, type PayLocale } from "@/lib/payments/pay-page-i18n"
import { backgroundStyle, LanguageToggle, TopSectionBlock } from "@/lib/payments/checkout-render"

function parseDesign(raw: string | null): PaymentFormDesign {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function isPayLocale(value: string | null): value is PayLocale {
  return value === "es" || value === "en"
}

export default function SkinPreviewPage() {
  return (
    <Suspense fallback={<Loader2 className="size-6 animate-spin text-primary" />}>
      <SkinPreviewPageInner />
    </Suspense>
  )
}

function SkinPreviewPageInner() {
  const searchParams = useSearchParams()
  const design = parseDesign(searchParams.get("design"))
  const requestedLocale = searchParams.get("locale")

  const [locale, setLocale] = useState<PayLocale>(isPayLocale(requestedLocale) ? requestedLocale : "es")
  // The URL is the source of truth on first load, but the toggle
  // still works locally afterwards without touching it.
  useEffect(() => {
    if (isPayLocale(requestedLocale)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(requestedLocale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const t = payPageStrings[locale]

  const bgStyle = backgroundStyle(design.background)
  const accent = design.accent_color || undefined
  const topSection = design.top_section

  return (
    <>
      {Object.keys(bgStyle).length > 0 && <div className="fixed inset-0 -z-10" style={bgStyle} />}
      <Card className="w-full max-w-md overflow-hidden">
        <LanguageToggle locale={locale} onChange={setLocale} />
        <div className="flex items-center justify-center gap-1.5 border-b border-border/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Eye className="size-3.5" />
          {t.previewBadge}
        </div>
        <div className="h-1.5 w-full" style={{ backgroundColor: accent || "var(--primary)" }} />

        <TopSectionBlock topSection={topSection} />

        <CardHeader>
          {!topSection?.banner_image_url && design.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={design.logo_url} alt="" className="mb-2 h-10 w-auto object-contain" />
          )}
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" style={accent ? { color: accent } : undefined} />
            {t.sampleProductName}
          </CardTitle>
          <CardDescription>49.00 USD</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {[t.firstName, t.email, "WhatsApp"].map((label) => (
            <div key={label} className="grid gap-1.5">
              <Label className="text-muted-foreground">{label}</Label>
              <Input disabled placeholder={label} />
            </div>
          ))}

          <p className="text-center text-xs text-muted-foreground">{t.previewPayNote}</p>

          <button
            type="button"
            disabled
            className="flex h-9 w-full items-center justify-center rounded-lg font-medium text-white opacity-90"
            style={{ backgroundColor: accent || "var(--primary)" }}
          >
            {t.pay}
          </button>
        </CardContent>
      </Card>
    </>
  )
}
