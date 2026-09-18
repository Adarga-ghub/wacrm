"use client"

import { AlertTriangle } from "lucide-react"

import { PAYMENT_CURRENCIES, isPaypalSupportedCurrency } from "@/lib/currency"

/**
 * Currency picker for a product/price. Plain string props (no `t`
 * function) rather than a shared i18n hook — this component is used
 * from both the next-intl-backed form editor (`Payments.editor`
 * namespace) and the standalone Payments-panel i18n
 * (`usePaymentsT`), which don't share key names; decoupling avoids
 * duplicating yet another set of keys across both systems.
 *
 * Shows a persistent warning under the select whenever the chosen
 * currency isn't one PayPal's Orders v2 API can actually settle in
 * (`isPaypalSupportedCurrency` — see `PAYMENT_CURRENCIES` in
 * `src/lib/currency.ts` for why DOP/COP/ARS are flagged). This is
 * the "aviso claro" step; the actual publish block lives server-side
 * in the API routes that accept `currency`.
 */
export function PaymentCurrencySelect({
  value,
  onChange,
  warningText,
  className,
}: {
  value: string
  onChange: (code: string) => void
  /** Shown when the selected currency isn't payable through PayPal. */
  warningText: string
  className?: string
}) {
  return (
    <div className={className ?? "grid gap-1.5"}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {PAYMENT_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.label}
          </option>
        ))}
      </select>
      {!isPaypalSupportedCurrency(value) && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {warningText}
        </p>
      )}
    </div>
  )
}
