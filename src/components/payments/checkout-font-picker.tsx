"use client"

import { GatewayLogo } from "@/components/payments/gateway-logo"
import { Label } from "@/components/ui/label"
import type { CheckoutFontStyle } from "@/lib/payments/checkout-font"

const OPTIONS: { value: CheckoutFontStyle; logo: string; alt: string }[] = [
  { value: "paypal", logo: "/logos/paypal.svg", alt: "PayPal" },
  { value: "whop", logo: "/logos/whop.svg", alt: "Whop" },
]

/** Two exclusive logo buttons: which gateway's typography this skin's checkout follows. */
export function CheckoutFontPicker({
  value,
  onChange,
  label,
  hint,
}: {
  value: CheckoutFontStyle
  onChange: (value: CheckoutFontStyle) => void
  label: string
  hint: string
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border-2 p-1 transition-colors ${
              value === option.value ? "border-primary bg-primary/10" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <GatewayLogo src={option.logo} alt={option.alt} />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
