"use client"

// ============================================================
// /pay/offer/preview?form=<offer id>&kind=upsell|downsell — admin
// preview of an upsell/downsell page (migration 063), as saved. Needs
// a dashboard session (the data comes from the admin API); nothing on
// it charges. "No, gracias" on the upsell preview jumps to the
// downsell preview, mirroring the live funnel.
// ============================================================

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"

import type { PublicFunnelOffer } from "@/types"
import { funnelPageStrings } from "@/lib/payments/funnel-page-i18n"
import { FunnelAcceptButton, FunnelOfferView } from "@/components/payments/funnel-offer-view"

export default function FunnelPreviewPage() {
  return (
    <Suspense fallback={<Loader2 className="size-8 animate-spin text-emerald-600" />}>
      <FunnelPreviewInner />
    </Suspense>
  )
}

function FunnelPreviewInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const formId = searchParams.get("form")
  const kind = searchParams.get("kind") === "downsell" ? "downsell" : "upsell"
  const t = funnelPageStrings.es

  const [offer, setOffer] = useState<PublicFunnelOffer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!formId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffer(null)
    setAccepted(false)
    fetch(`/api/payments/forms/${formId}/funnel/${kind}/preview`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || t.notAvailable)
        setOffer(data.offer)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [formId, kind, t.notAvailable])

  const background = <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-100 to-slate-200" />

  if (error || !formId) {
    return (
      <>
        {background}
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center shadow-lg">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm text-slate-600">{error ?? t.notAvailable}</p>
        </div>
      </>
    )
  }
  if (!offer) {
    return (
      <>
        {background}
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </>
    )
  }

  return (
    <>
      {background}
      <FunnelOfferView
        key={kind}
        offer={offer}
        t={t}
        buyerName="María"
        timerKey={`wacrm:funnel-preview-timer:${formId}:${kind}`}
        preview
        onDecline={() => {
          if (kind === "upsell") router.push(`/pay/offer/preview?form=${formId}&kind=downsell`)
        }}
        paymentSlot={
          accepted ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              {t.previewNote}
            </p>
          ) : (
            <FunnelAcceptButton
              label={offer.page.accept_label || t.defaultAccept}
              onClick={() => setAccepted(true)}
            />
          )
        }
      />
    </>
  )
}
