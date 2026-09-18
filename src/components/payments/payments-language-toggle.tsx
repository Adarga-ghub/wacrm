"use client"

import { Languages } from "lucide-react"

import { usePaymentsLocale } from "@/hooks/use-payments-locale"
import type { AdminLocale } from "@/lib/payments/admin-i18n"

const OPTIONS: AdminLocale[] = ["es", "en"]

/** Language toggle for the Payments admin panel header — see `PaymentsLocaleProvider`. */
export function PaymentsLanguageToggle() {
  const { locale, setLocale } = usePaymentsLocale()

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-1.5 py-1"
      role="group"
      aria-label="Panel language"
    >
      <Languages className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors ${
            locale === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
