"use client"

import { useEffect, type CSSProperties } from "react"

import type { PaymentFormDesign } from "@/types"

/**
 * The checkout's typography, chosen per skin. 'paypal' is the original
 * Hotmart-style look (serif title, Open Sans details). 'whop' matches
 * Whop's embedded form: Inter throughout, nothing heavier than 600.
 */
export type CheckoutFontStyle = NonNullable<PaymentFormDesign["font_style"]>

export function checkoutFonts(fontStyle: PaymentFormDesign["font_style"]): {
  title: CSSProperties
  details: CSSProperties
} {
  if (fontStyle === "whop") {
    const inter = { fontFamily: "var(--font-sans)" }
    return { title: { ...inter, fontWeight: 600 }, details: inter }
  }
  return {
    title: { fontFamily: '"Times New Roman", Times, serif' },
    details: { fontFamily: "var(--font-open-sans)" },
  }
}

/**
 * Marks the whole document, because the bump pop-up renders outside the
 * page's own tree. `globals.css` lowers the heavy font weights under it.
 */
export function useCheckoutFontAttribute(fontStyle: PaymentFormDesign["font_style"]) {
  useEffect(() => {
    if (fontStyle !== "whop") return
    const root = document.documentElement
    root.dataset.checkoutFont = "whop"
    return () => {
      delete root.dataset.checkoutFont
    }
  }, [fontStyle])
}
