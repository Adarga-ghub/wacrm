"use client"

import { useEffect, useRef } from "react"
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react"
import { loadWhop } from "@whop/elements"

import type { PayLocale } from "@/lib/payments/pay-page-i18n"

interface Props {
  checkoutConfigurationId: string
  /** Where the buyer lands after paying; Whop adds `payment` and `status` when it sends them there itself. */
  returnUrl: string
  /** The checkout page's own language (from the buyer's country), so Whop's form matches it. */
  locale: PayLocale
}

/**
 * Whop's checkout, inside our page. Loaded on demand (see the
 * `next/dynamic` import in the checkout page), so a buyer who pays with
 * PayPal never downloads any of it.
 */
export default function WhopEmbeddedCheckout({ checkoutConfigurationId, returnUrl, locale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const bringToTop = () => containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  // Same idea as PayPal's card form in the checkout page: the form opens
  // downward, so on a phone most of it ends up below the screen. It lives
  // in a cross-origin iframe, so its opening is detected from the
  // container's growth; the scroll never goes past the form's own top.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return
    let settledHeight = container.offsetHeight
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const height = container.offsetHeight
        const opened = height - settledHeight > 120
        settledHeight = height
        if (!opened) return
        const { top, bottom } = container.getBoundingClientRect()
        const delta = Math.min(bottom + 16 - window.innerHeight, top - 8)
        if (delta > 0) window.scrollBy({ top: delta, behavior: "smooth" })
      }, 350)
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={containerRef} className="scroll-mt-2">
      <WhopElements elements={loadWhop()} locale={locale}>
        <Checkout
          checkoutConfiguration={checkoutConfigurationId}
          returnUrl={returnUrl}
          onComplete={(completion) => {
            // A card paid without leaving the page never navigates by itself.
            if (completion.result !== "payment") return
            const url = new URL(returnUrl, window.location.origin)
            url.searchParams.set("payment", completion.paymentId)
            url.searchParams.set("status", "succeeded")
            window.location.href = url.toString()
          }}
        >
          <CheckoutElement onReady={bringToTop} />
        </Checkout>
      </WhopElements>
    </div>
  )
}
