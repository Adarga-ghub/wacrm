"use client"

// ============================================================
// /pay/offer/[token] — upsell / downsell page (migration 063).
//
// Reached only from the checkout's capture response: the token is
// issued once the main payment is completed (see
// `resolvePostPurchaseRedirect`). Shows the step the buyer is on; "Sí"
// reveals PayPal/card buttons for THAT step's own PayPal order, "No,
// gracias" moves to the downsell (or the thank-you). Like the checkout,
// the browser never sends a price — only the token and the step.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

import type { PaymentFunnelStepKind, PublicFunnelOffer } from "@/types"
import { localeForCountry, resolvePaypalSdkLocale } from "@/lib/payments/pay-page-i18n"
import { funnelPageStrings } from "@/lib/payments/funnel-page-i18n"
import { FunnelAcceptButton, FunnelOfferView } from "@/components/payments/funnel-offer-view"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any
  }
}

interface ThankYou {
  redirect_url: string | null
  inline_message: string | null
}

interface FunnelData {
  stage: PaymentFunnelStepKind | "done"
  offer?: PublicFunnelOffer
  paypal_client_id?: string | null
  buyer_name?: string | null
  thank_you: ThankYou
}

export default function FunnelOfferPage() {
  const { token } = useParams<{ token: string }>()

  const [country, setCountry] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/public/payments/geo")
      .then((res) => res.json())
      .then((data) => setCountry(data.country ?? "DO"))
      .catch(() => setCountry("DO"))
  }, [])
  const locale = localeForCountry(country ?? "DO")
  const t = funnelPageStrings[locale]

  const [data, setData] = useState<FunnelData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [postPayment, setPostPayment] = useState<"confirming" | "redirecting" | null>(null)
  const [thankYouMessage, setThankYouMessage] = useState<string | null>(null)

  // The step the PayPal callbacks charge — a ref so the long-lived
  // button closures always read the step currently on screen.
  const stageRef = useRef<FunnelData["stage"]>("done")
  useEffect(() => {
    stageRef.current = data?.stage ?? "done"
  })

  const finish = useCallback(
    (thankYou: ThankYou, message: string) => {
      if (thankYou.redirect_url) {
        setPostPayment("redirecting")
        const url = thankYou.redirect_url
        setTimeout(() => {
          window.location.href = url
        }, 1200)
        return
      }
      setPostPayment(null)
      setThankYouMessage(thankYou.inline_message || message || "")
    },
    [],
  )

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/payments/funnel/${token}`).catch(() => null)
    if (!res?.ok) {
      setNotFound(true)
      return
    }
    const next = (await res.json()) as FunnelData
    setData(next)
    setAccepted(false)
    setErrorMessage(null)
    if (next.stage === "done") finish(next.thank_you, "")
  }, [token, finish])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Back/forward cache restore after leaving for the thank-you page.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPostPayment(null)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  // PayPal JS SDK — loaded as soon as the offer is known (not on "Sí"),
  // so the buttons appear instantly when the buyer accepts.
  const clientId = data?.paypal_client_id
  const currency = data?.offer?.currency
  useEffect(() => {
    if (!clientId || !currency || country === null) return
    const desiredLocale = resolvePaypalSdkLocale(locale, country)
    const existing = document.getElementById("paypal-sdk") as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.locale === desiredLocale) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSdkReady(true)
        return
      }
      existing.remove()
      delete window.paypal
      setSdkReady(false)
    }
    const script = document.createElement("script")
    script.id = "paypal-sdk"
    script.dataset.locale = desiredLocale
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId,
    )}&currency=${encodeURIComponent(currency)}&enable-funding=card&components=buttons&locale=${desiredLocale}`
    script.onload = () => setSdkReady(true)
    script.onerror = () => setErrorMessage(funnelPageStrings[locale].sdkLoadError)
    document.body.appendChild(script)
  }, [clientId, currency, locale, country])

  const stage = data?.stage
  useEffect(() => {
    if (!accepted || !sdkReady || !window.paypal || !stage || stage === "done") return
    const paypalContainer = document.getElementById("funnel-paypal-button")
    const cardContainer = document.getElementById("funnel-card-button")
    if (!paypalContainer) return
    paypalContainer.innerHTML = ""
    if (cardContainer) cardContainer.innerHTML = ""
    const strings = funnelPageStrings[locale]

    const buttonConfig = (fundingSource: string) => ({
      fundingSource,
      onClick: () => setPaymentLoading(true),
      createOrder: async () => {
        try {
          setErrorMessage(null)
          const res = await fetch(`/api/public/payments/funnel/${token}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: stageRef.current }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            setErrorMessage(body.error || strings.startError)
            throw new Error("handled")
          }
          return body.order_id as string
        } finally {
          setPaymentLoading(false)
        }
      },
      onApprove: async ({ orderID }: { orderID: string }) => {
        setPostPayment("confirming")
        try {
          const res = await fetch(`/api/public/payments/orders/${orderID}/capture`, { method: "POST" })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            setPostPayment(null)
            setErrorMessage(body.error || strings.paymentIncomplete)
            return
          }
          finish(
            { redirect_url: body.redirect_url ?? null, inline_message: body.inline_message ?? null },
            strings.thankYou,
          )
        } catch {
          setPostPayment(null)
          setErrorMessage(strings.paymentIncomplete)
        }
      },
      onError: (err?: unknown) => {
        setPaymentLoading(false)
        if (err instanceof Error && err.message === "handled") return
        setErrorMessage(strings.paypalGenericError)
      },
    })

    const paypalButtons = window.paypal.Buttons(buttonConfig(window.paypal.FUNDING.PAYPAL))
    if (paypalButtons.isEligible()) paypalButtons.render("#funnel-paypal-button")
    if (cardContainer) {
      const cardButtons = window.paypal.Buttons({
        ...buttonConfig(window.paypal.FUNDING.CARD),
        style: { label: "pay", color: "black" },
      })
      if (cardButtons.isEligible()) cardButtons.render("#funnel-card-button")
    }
  }, [accepted, sdkReady, stage, token, locale, finish])

  async function handleDecline() {
    if (!data || data.stage === "done") return
    setDeclining(true)
    const res = await fetch(`/api/public/payments/funnel/${token}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: data.stage }),
    }).catch(() => null)
    const body = res?.ok ? await res.json() : null
    if (body?.stage === "done") {
      setPostPayment("redirecting")
      finish(body.thank_you, t.thankYou)
      setDeclining(false)
      return
    }
    await load()
    setDeclining(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const overlay = (paymentLoading || postPayment) && (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="mx-4 flex max-w-xs flex-col items-center gap-3 rounded-xl bg-white px-6 py-6 text-center shadow-lg">
        {postPayment === "redirecting" ? (
          <>
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="text-base font-semibold text-slate-900">{t.paymentSuccessTitle}</p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span>{t.finishing}</span>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-slate-900">
              {postPayment === "confirming" ? t.confirmingPayment : t.loadingGateway}
            </p>
          </>
        )}
      </div>
    </div>
  )

  const background = <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-100 to-slate-200" />

  if (notFound) {
    return (
      <>
        {background}
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center shadow-lg">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm text-slate-600">{t.notAvailable}</p>
        </div>
      </>
    )
  }

  if (thankYouMessage !== null) {
    return (
      <>
        {background}
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center shadow-lg">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <p className="text-base text-slate-800">{thankYouMessage || t.thankYou}</p>
        </div>
      </>
    )
  }

  if (!data?.offer || data.stage === "done") {
    return (
      <>
        {background}
        {overlay}
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
          <p className="text-sm">{t.loading}</p>
        </div>
      </>
    )
  }

  const offer = data.offer
  return (
    <>
      {background}
      {overlay}
      <FunnelOfferView
        key={data.stage}
        offer={offer}
        t={t}
        buyerName={data.buyer_name ?? null}
        timerKey={`wacrm:funnel-timer:${token}:${data.stage}`}
        onDecline={handleDecline}
        declining={declining}
        paymentSlot={
          <div className="space-y-3">
            {!accepted ? (
              <FunnelAcceptButton
                label={offer.page.accept_label || t.defaultAccept}
                onClick={() => setAccepted(true)}
              />
            ) : (
              <div className="space-y-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-800">{t.choosePayment}</p>
                <p className="text-xs text-slate-500">{t.paymentHint}</p>
                {data.paypal_client_id ? (
                  <>
                    <div id="funnel-paypal-button" />
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />
                      {t.or}
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                    <div id="funnel-card-button" />
                    {!sdkReady && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="size-5 animate-spin text-slate-400" />
                      </div>
                    )}
                    <p className="flex items-center justify-center gap-1 pt-1 text-xs">
                      <span className="text-slate-500 italic">{t.securedByPrefix}</span>
                      <span className="text-sm font-bold italic">
                        <span style={{ color: "#253B80" }}>Pay</span>
                        <span style={{ color: "#179BD7" }}>Pal</span>
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">{t.sdkLoadError}</p>
                )}
              </div>
            )}
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          </div>
        }
      />
    </>
  )
}
