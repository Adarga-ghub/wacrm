"use client"

import type { useTranslations } from "next-intl"

import type { PaymentFormDesign } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const DEFAULT_ACCENT = "#16a34a"

/**
 * "Diseño" tab — the checkout page's only cosmetic knobs (accent
 * color + logo). Read by the public page as `PublicPaymentForm.design`
 * (migration 052's `payment_forms.design` jsonb) — see
 * `src/app/pay/[slug]/page.tsx`.
 */
export function DesignTab({
  design,
  onChange,
  t,
}: {
  design: PaymentFormDesign
  onChange: (design: PaymentFormDesign) => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-2">
          <Label className="text-muted-foreground">{t("accentColorLabel")}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={design.accent_color || DEFAULT_ACCENT}
              onChange={(e) => onChange({ ...design, accent_color: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
            />
            <Input
              value={design.accent_color || ""}
              onChange={(e) => onChange({ ...design, accent_color: e.target.value })}
              placeholder={DEFAULT_ACCENT}
              className="w-32"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-muted-foreground">{t("logoUrlLabel")}</Label>
          <Input
            type="url"
            value={design.logo_url || ""}
            onChange={(e) => onChange({ ...design, logo_url: e.target.value || undefined })}
            placeholder="https://…/logo.png"
          />
          {design.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={design.logo_url}
              alt=""
              className="mt-1 h-10 w-auto rounded border border-border object-contain p-1"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
