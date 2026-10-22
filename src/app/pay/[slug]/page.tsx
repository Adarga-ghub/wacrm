import { loadPublicPaymentForm } from "@/lib/payments/public-form"
import { CheckoutPage } from "./checkout-page"

// ============================================================
// /pay/[slug] — server half of the public checkout.
//
// Loads the form here and hands it to the client checkout
// (`./checkout-page.tsx`), so the first HTML response already
// contains the rendered checkout. Before, the browser had to download
// and start the page's JS, then request the form from the API, and
// only then draw it — several seconds on a mid-range phone. While this
// load runs, `loading.tsx` is streamed first, so the buyer still sees
// the loading screen immediately.
// ============================================================

export default async function PublicPaymentFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let initialForm
  try {
    initialForm = await loadPublicPaymentForm(slug)
  } catch (error) {
    // Leave it `undefined` — the client falls back to fetching it.
    console.error("[pay/[slug]] server-side form load failed:", error)
  }

  return <CheckoutPage initialForm={initialForm} />
}
