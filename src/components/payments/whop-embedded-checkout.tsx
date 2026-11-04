"use client"

import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react"
import { loadWhop } from "@whop/elements"

interface Props {
  checkoutConfigurationId: string
  /** Where the buyer lands after paying; Whop adds `payment` and `status` when it sends them there itself. */
  returnUrl: string
}

/**
 * Whop's checkout, inside our page. Loaded on demand (see the
 * `next/dynamic` import in the checkout page), so a buyer who pays with
 * PayPal never downloads any of it.
 */
export default function WhopEmbeddedCheckout({ checkoutConfigurationId, returnUrl }: Props) {
  return (
    <WhopElements elements={loadWhop()}>
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
        <CheckoutElement />
      </Checkout>
    </WhopElements>
  )
}
