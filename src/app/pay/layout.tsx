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
    // NO `bg-background` on this div itself, still on purpose — a
    // background painted directly on this wrapper would sit on top of
    // the fixed, negative-z-index background layer(s) the page renders
    // (see `src/app/pay/[slug]/page.tsx`) and hide them permanently.
    // The white default + any custom skin "Fondo" are both rendered as
    // `fixed inset-0 -z-10` siblings inside the page itself instead.
    //
    // `pay-page-surface` (see `src/app/globals.css`) forces the
    // neutral surface tokens (`--background`, `--foreground`, `--card`,
    // `--border`, `--muted*`, …) to their light values for every page
    // under `/pay`, regardless of the visitor's saved dashboard theme
    // (or its dark default — `DEFAULT_MODE` in `src/lib/themes.ts`).
    // Without it, an anonymous visitor with no saved preference gets
    // the dashboard's dark tokens here too: light text/borders that
    // become unreadable once the page (or a merchant's skin) renders a
    // white/light background. Edit the values in that CSS class to
    // change the checkout pages' palette.
    <div className="pay-page-surface flex min-h-screen items-start justify-center px-4 py-6 sm:py-10">
      {children}
    </div>
  )
}
