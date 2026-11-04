"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { payPageStrings, type PayLocale } from "@/lib/payments/pay-page-i18n"

/** How long to keep asking the server before telling the buyer we'll confirm by email. */
const CONFIRM_ATTEMPTS = 20
const CONFIRM_INTERVAL_MS = 3000

type View =
  | { kind: "confirming" }
  | { kind: "redirecting" }
  | { kind: "done"; message: string | null }
  | { kind: "failed" }
  | { kind: "pending" }

function ReturnContent() {
  const params = useSearchParams()
  const orderId = params.get("order")
  // Whop's embedded checkout returns `payment`; its hosted page, `payment_id`.
  const paymentId = params.get("payment") ?? params.get("payment_id")
  const status = params.get("status")
  const slug = params.get("slug")

  const [view, setView] = useState<View>(
    !orderId || status === "failed" || status === "canceled" ? { kind: "failed" } : { kind: "confirming" },
  )
  const [locale, setLocale] = useState<PayLocale>("es")
  const t = payPageStrings[locale]

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(navigator.language?.toLowerCase().startsWith("en") ? "en" : "es")
  }, [])

  useEffect(() => {
    if (view.kind !== "confirming") return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const attempt = async (remaining: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null
      try {
        const res = await fetch("/api/public/payments/whop/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId, payment_id: paymentId ?? undefined }),
        })
        data = await res.json().catch(() => null)
      } catch {
        // Network hiccup: same as "not yet".
      }
      if (cancelled) return

      if (data?.success) {
        if (data.redirect_url) {
          setView({ kind: "redirecting" })
          timer = setTimeout(() => {
            window.location.href = data.redirect_url
          }, 1200)
        } else {
          setView({ kind: "done", message: data.inline_message ?? null })
        }
        return
      }
      if (remaining <= 1) {
        setView({ kind: "pending" })
        return
      }
      timer = setTimeout(() => attempt(remaining - 1), CONFIRM_INTERVAL_MS)
    }

    attempt(CONFIRM_ATTEMPTS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // Runs once for this return visit; `view` only leaves "confirming" from inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, paymentId])

  return (
    <Card className="w-full max-w-md sm:max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        {(view.kind === "confirming" || view.kind === "redirecting") && (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-foreground">
              {view.kind === "confirming" ? t.whopConfirming : t.whopRedirecting}
            </p>
          </>
        )}
        {view.kind === "done" && (
          <>
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="text-sm text-foreground">{view.message || t.thankYou}</p>
          </>
        )}
        {view.kind === "pending" && (
          <>
            <Loader2 className="size-8 text-amber-500" />
            <p className="text-sm text-foreground">{t.whopStillPending}</p>
          </>
        )}
        {view.kind === "failed" && (
          <>
            <AlertTriangle className="size-8 text-amber-500" />
            <p className="text-sm text-foreground">{t.whopNotCharged}</p>
            {slug && (
              <a className="text-sm font-medium text-primary underline" href={`/pay/${encodeURIComponent(slug)}`}>
                {t.whopBackToCheckout}
              </a>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Where the buyer lands after paying through Whop. Shows the outcome; the server decides whether the payment counts. */
export default function WhopReturnPage() {
  return (
    <Suspense fallback={<Loader2 className="size-8 animate-spin text-primary" />}>
      <ReturnContent />
    </Suspense>
  )
}
