// ============================================================
// /pay/[slug] layout — minimal full-bleed public shell.
//
// Outside both `(auth)` and `(dashboard)` for the same reason as
// `/join`'s layout: this route must render for anonymous visitors
// (paying customers, who never log in) and the dashboard shell would
// funnel them through the login redirect.
// ============================================================

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

// Public pages (checkout, upsell/downsell offers) carry the store's
// brand in the browser tab instead of the CRM's own "wacrm" title and
// chat-bubble icon set in the root layout — the dashboard keeps those.
export const metadata: Metadata = {
  title: {
    // `absolute`, not `default` — otherwise the root layout's
    // "%s — wacrm" template wraps it.
    absolute: 'Librería Adarga',
    template: '%s — Librería Adarga',
  },
  icons: {
    icon: [{ url: '/brand/adarga-icon.png', type: 'image/png' }],
    apple: [{ url: '/brand/adarga-icon.png' }],
  },
  robots: { index: false, follow: false },
}

// The root layout declares a dark `theme-color` and `color-scheme:
// dark light` for the dashboard. On a phone in dark mode that made the
// browser paint a BLACK canvas (and dark toolbar) for every /pay link
// until the stylesheets finished downloading — several seconds on a
// slow connection inside WhatsApp's in-app browser. Checkout is always
// light, so say so up front.
export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
}

// Critical CSS, inlined in the HTML itself so it applies on the very
// first paint — before the external stylesheets arrive. Paints the
// page white and styles the loading screen (`PayPageLoading`, the
// `.pay-boot*` classes): a centered spinner + black "Cargando
// página..." over a full-screen white layer, which the real checkout
// replaces once it renders.
const CRITICAL_CSS = `
html,body{background:#fff;color-scheme:light}
.pay-boot{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#fff}
.pay-boot-spinner{width:40px;height:40px;border-radius:9999px;border:4px solid #e5e7eb;border-top-color:#111;animation:pay-boot-spin .8s linear infinite}
.pay-boot-label{margin:0;color:#000;font:500 16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@keyframes pay-boot-spin{to{transform:rotate(360deg)}}
`

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
      <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      {children}
    </div>
  )
}
