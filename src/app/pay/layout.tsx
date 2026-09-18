// ============================================================
// /pay/[slug] layout — minimal full-bleed public shell.
//
// Outside both `(auth)` and `(dashboard)` for the same reason as
// `/join`'s layout: this route must render for anonymous visitors
// (paying customers, who never log in) and the dashboard shell would
// funnel them through the login redirect.
// ============================================================

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    // `items-start` (not `items-center`) is deliberate: a checkout
    // card's height varies a lot (card-fields expand it, a
    // product_list or a validation error adds a line, a tall top-
    // section banner adds more) and can exceed a phone's viewport
    // height. Flexbox cross-axis centering on overflowing content
    // clips inconsistently across browsers — the payer can lose
    // access to the top of the card (language toggle, logo) with no
    // way to scroll back up to it. Top-anchoring with symmetric
    // padding avoids that entirely and is how most checkout pages
    // (Stripe, PayPal's own) already behave.
    //
    // NO `bg-background` here on purpose — `body` already carries it
    // (globals.css), which is what actually shows through when a
    // skin sets no custom "Fondo". A skin's background renders as a
    // `position: fixed` layer with a negative z-index
    // (`backgroundStyle()` in `checkout-render.tsx`), and negative
    // z-index content paints BELOW the in-flow content of its
    // stacking context — including this div's own background, if it
    // had one. Repainting `bg-background` here would sit on top of
    // that layer and hide every custom background, color or image,
    // permanently. Leave this div transparent; `body`'s background is
    // the visual fallback.
    <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:py-10">
      {children}
    </div>
  )
}
