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
    // `flex-col` + `justify-center` (main-axis centering), NOT
    // `items-center` on a row (cross-axis centering) — the checkout
    // card's height varies a lot (card-fields expand it, a
    // product_list or a validation error adds a line, a tall top-
    // section banner adds more) and can exceed a phone's viewport
    // height. Cross-axis centering on overflowing content clips
    // inconsistently across browsers — the payer can lose access to
    // the top of the card with no way to scroll back up to it.
    // Main-axis `justify-center` doesn't have that failure mode: once
    // the card is taller than `min-h-dvh`, this container's own
    // height grows to match its content (min-height only sets a
    // floor), so there's no leftover space to center into — the card
    // just renders top-to-bottom like `items-start` did, fully
    // scrollable, nothing clipped. When the card DOES fit the
    // viewport, `justify-center` centers it vertically instead of
    // pinning it to the top.
    //
    // `min-h-dvh` (dynamic viewport height), NOT `min-h-screen`
    // (`100vh`) — on mobile, `100vh` is sized for the SHORTEST
    // possible visible area (address bar collapsed), which is taller
    // than what's actually on screen whenever the address bar is
    // showing. That extra height was exactly what let the page
    // rubber-band/slide a few pixels on load even though the card
    // fit — nothing to scroll to, but the browser still had a few
    // pixels of phantom overflow to bounce through. `100dvh` tracks
    // the real, currently-visible viewport instead, so there's no
    // leftover space to slide into.
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
    <div className="pay-page-surface flex min-h-dvh flex-col items-center justify-center px-4 py-6 sm:py-10">
      {children}
    </div>
  )
}
