import { Loader2, Lock } from "lucide-react"

// ============================================================
// Initial loading state for /pay/[slug].
//
// Shown from the very first paint — it's the Suspense fallback baked
// into the prerendered HTML, the `loading.tsx` for navigations, and
// the "form still fetching" branch of the page — so a buyer who taps
// a WhatsApp link button sees an immediate, stable response instead
// of a blank in-app browser while the form + PayPal SDK load.
//
// Deliberately light: markup + Tailwind only (no images, no client
// JS, no data), and shaped like the checkout card (same max widths,
// header / fields / button rhythm) so the swap to the real card
// doesn't jump. `motion-safe:` keeps the pulse off for visitors who
// asked for reduced motion; the spinner stays as the one moving cue.
// ============================================================

export function PayPageLoading({ label = "Cargando tu pago seguro..." }: { label?: string }) {
  return (
    <>
      {/* Same base white layer the page renders — keeps the loading
          screen on the checkout palette, not the browser default. */}
      <div className="fixed inset-0 -z-10 bg-background" />
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:max-w-lg"
      >
        <div className="flex flex-col items-center gap-3 border-b border-border/60 px-6 py-8">
          <span className="relative flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="absolute size-12 animate-spin text-primary/70" strokeWidth={1.5} />
            <Lock className="size-4 text-primary" />
          </span>
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
        <div aria-hidden className="flex flex-col gap-4 px-6 py-6 motion-safe:animate-pulse">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="mt-2 h-10 w-full rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="mt-2 h-11 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </>
  )
}
