import { redirect } from "next/navigation"
import { loadPublicPaymentForm } from "@/lib/payments/public-form"
import { resolveRenamedSlug } from "@/lib/payments/slug-history"
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

export default async function PublicPaymentFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params

  let initialForm
  try {
    initialForm = await loadPublicPaymentForm(slug)
  } catch (error) {
    // Leave it `undefined` — the client falls back to fetching it.
    console.error("[pay/[slug]] server-side form load failed:", error)
  }

  // An edited link (migration 068): the old slug sends the buyer to the
  // offer's current one, keeping the query (`?l=` tracking code…). A
  // temporary redirect, so browsers don't cache it if the link is
  // edited again later.
  if (initialForm === null) {
    let renamedTo: string | null = null
    try {
      renamedTo = await resolveRenamedSlug(slug)
    } catch (error) {
      console.error("[pay/[slug]] old-slug lookup failed:", error)
    }
    if (renamedTo) {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(await searchParams)) {
        for (const v of Array.isArray(value) ? value : value != null ? [value] : []) query.append(key, v)
      }
      const qs = query.toString()
      redirect(`/pay/${renamedTo}${qs ? `?${qs}` : ""}`)
    }
  }

  return <CheckoutPage initialForm={initialForm} />
}
