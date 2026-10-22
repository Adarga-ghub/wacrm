// ============================================================
// Initial loading state for /pay/[slug].
//
// Shown from the very first paint — it's the Suspense fallback baked
// into the prerendered HTML, the `loading.tsx` for navigations, and
// the "form still fetching" branch of the page — so a buyer who taps
// a WhatsApp link button sees a white screen with a spinner right
// away instead of a black in-app browser while the form + PayPal SDK
// load.
//
// Styled ONLY through the inline critical CSS in
// `src/app/pay/layout.tsx` (`.pay-boot*` classes) — never Tailwind.
// On a slow phone connection the HTML arrives seconds before the
// stylesheets do, and anything that depends on them renders unstyled
// (tiny text in a corner, on the phone's dark canvas) until then.
// ============================================================

export function PayPageLoading({ label = "Cargando página..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="pay-boot">
      <span aria-hidden className="pay-boot-spinner" />
      <p className="pay-boot-label">{label}</p>
    </div>
  )
}
