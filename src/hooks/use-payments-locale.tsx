"use client"

// ============================================================
// Payments admin panel language toggle (`/payments`, `/payments/skins`).
// Persistence is localStorage only (device-scoped) — same tier as the
// accent theme (`src/hooks/use-theme.tsx`) and the public checkout
// page's language toggle (`src/lib/payments/pay-page-i18n.ts`).
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  paymentsAdminStrings,
  type AdminLocale,
  type PaymentsAdminNamespaces,
} from "@/lib/payments/admin-i18n"

const STORAGE_KEY = "wacrm:payments-admin-locale"

function isAdminLocale(value: unknown): value is AdminLocale {
  return value === "es" || value === "en"
}

interface PaymentsLocaleContextValue {
  locale: AdminLocale
  setLocale: (next: AdminLocale) => void
}

const PaymentsLocaleContext = createContext<PaymentsLocaleContextValue | null>(null)

export function PaymentsLocaleProvider({ children }: { children: ReactNode }) {
  // Default to Spanish (this product's primary market — same default
  // as the public checkout toggle); adopt whatever's stored, or flip
  // to English if the browser reports an English locale, once
  // mounted (no `window`/`localStorage` on the server).
  const [locale, setLocaleState] = useState<AdminLocale>("es")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isAdminLocale(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(stored)
        return
      }
    } catch {
      // Private-browsing / storage-disabled — fall through to browser-language detection.
    }
    if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")) {
      setLocaleState("en")
    }
  }, [])

  function setLocale(next: AdminLocale) {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference just won't survive a reload — the toggle still works this session.
    }
  }

  return (
    <PaymentsLocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </PaymentsLocaleContext.Provider>
  )
}

export function usePaymentsLocale(): PaymentsLocaleContextValue {
  const ctx = useContext(PaymentsLocaleContext)
  if (!ctx) {
    throw new Error("usePaymentsLocale must be used within a PaymentsLocaleProvider")
  }
  return ctx
}

/** `t(key)` / `t("nested.key")` / `t("key", { name: "…" })` — same call shape as next-intl's `useTranslations()`, so call sites didn't need to change beyond the import. */
export type PaymentsT = (key: string, vars?: Record<string, string | number>) => string

function resolve(node: unknown, path: string[]): unknown {
  let current = node
  for (const part of path) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Reads translations for one namespace (`"list"` | `"skins"`) at the
 * panel's current toggled locale. A missing key renders the dotted
 * key path itself (mirrors next-intl's own fallback behaviour) rather
 * than throwing, so a typo fails loud in the UI instead of crashing
 * the page.
 */
export function usePaymentsT<K extends keyof PaymentsAdminNamespaces>(namespace: K): PaymentsT {
  const { locale } = usePaymentsLocale()
  const dict = paymentsAdminStrings[locale][namespace]

  return (key: string, vars?: Record<string, string | number>) => {
    const value = resolve(dict, key.split("."))
    if (typeof value !== "string") return key
    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    )
  }
}
