"use client"

// ============================================================
// /pay/[slug] — public checkout page. No session, no dashboard
// chrome (see `src/app/pay/layout.tsx`). The PayPal JS SDK is loaded
// client-side with the merchant's Client ID (safe to expose — that's
// what it's designed for); every money-moving call
// (`POST /api/public/payments/orders`, `.../capture`) happens
// server-side against PayPal's REST API, never trusting anything the
// SDK reports back to the browser beyond "the payer approved it".
// ============================================================

import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react"

import type { PublicPaymentForm } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any
  }
}

export default function PublicPaymentFormPage() {
  return (
    <Suspense fallback={<Loader2 className="size-6 animate-spin text-primary" />}>
      <PublicPaymentFormPageInner />
    </Suspense>
  )
}

function PublicPaymentFormPageInner() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const linkCode = searchParams.get("l")

  const [form, setForm] = useState<PublicPaymentForm | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [variableAmount, setVariableAmount] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [sdkReady, setSdkReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{ inline_message: string | null } | null>(null)

  useEffect(() => {
    fetch(`/api/public/payments/forms/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setForm(data.form)
      })
      .catch(() => setNotFound(true))
  }, [slug])

  // Load the PayPal JS SDK once we know the merchant's Client ID.
  useEffect(() => {
    if (!form?.paypal_client_id) return
    const existing = document.getElementById("paypal-sdk")
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSdkReady(true)
      return
    }
    const script = document.createElement("script")
    script.id = "paypal-sdk"
    // `enable-funding=card` is what makes the "Debit or Credit Card"
    // button show reliably: PayPal's own eligibility heuristic
    // otherwise sometimes hides it (e.g. when the buyer's browser
    // carries a recognized PayPal login cookie), and this merchant
    // explicitly wants guest card checkout offered every time
    // alongside the PayPal button, not only when auto-detected.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      form.paypal_client_id,
    )}&currency=${encodeURIComponent(form.currency)}&enable-funding=card`
    script.onload = () => setSdkReady(true)
    script.onerror = () => setErrorMessage("Could not load the payment provider.")
    document.body.appendChild(script)
  }, [form?.paypal_client_id, form?.currency])

  // Render two SEPARATE button sets once the SDK is ready — one
  // pinned to the PayPal funding source, one pinned to Card — rather
  // than a single unrestricted `Buttons()` call. The unrestricted
  // form stacks/collapses funding sources by its own eligibility
  // heuristic and can drop the card option entirely depending on the
  // buyer's browser; rendering `FUNDING.CARD` into its own container
  // guarantees "Debit or Credit Card" always has its own visible
  // button whenever PayPal considers the buyer eligible for it at
  // all (see the `enable-funding=card` SDK flag above).
  useEffect(() => {
    if (!sdkReady || !form || !window.paypal) return
    const paypalContainer = document.getElementById("paypal-button-container")
    const cardContainer = document.getElementById("card-button-container")
    if (!paypalContainer || !cardContainer) return
    paypalContainer.innerHTML = ""
    cardContainer.innerHTML = ""

    const buttonConfig = (fundingSource: string) => ({
      fundingSource,
      createOrder: async () => {
        setErrorMessage(null)
        for (const field of form.fields) {
          if (field.required && !fieldValues[field.id]?.trim()) {
            setErrorMessage(`${field.label} is required`)
            throw new Error("validation")
          }
        }
        if (form.amount_type === "product_list" && !selectedProductId) {
          setErrorMessage("Please choose a product")
          throw new Error("validation")
        }
        const res = await fetch("/api/public/payments/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            link_code: linkCode ?? undefined,
            field_values: fieldValues,
            amount: form.amount_type === "variable" ? Number(variableAmount) : undefined,
            product_id: form.amount_type === "product_list" ? selectedProductId : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorMessage(data.error || "Could not start the payment")
          throw new Error(data.error || "create-order-failed")
        }
        return data.order_id
      },
      onApprove: async (data: { orderID: string }) => {
        const res = await fetch(`/api/public/payments/orders/${data.orderID}/capture`, {
          method: "POST",
        })
        const captureData = await res.json()
        if (!res.ok) {
          setErrorMessage(captureData.error || "The payment could not be completed")
          return
        }
        if (captureData.redirect_url) {
          window.location.href = captureData.redirect_url
          return
        }
        setResult({ inline_message: captureData.inline_message })
      },
      onError: () => {
        setErrorMessage("Something went wrong with PayPal — please try again.")
      },
    })

    const paypalButtons = window.paypal.Buttons(buttonConfig(window.paypal.FUNDING.PAYPAL))
    if (paypalButtons.isEligible()) paypalButtons.render("#paypal-button-container")

    const cardButtons = window.paypal.Buttons({
      ...buttonConfig(window.paypal.FUNDING.CARD),
      style: { label: "pay", color: "black" },
    })
    if (cardButtons.isEligible()) cardButtons.render("#card-button-container")
    // fieldValues intentionally excluded — createOrder reads the latest
    // via closure each click; re-rendering the buttons on every keystroke
    // would tear down and remount the PayPal iframe constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, form, linkCode, slug, variableAmount, selectedProductId])

  if (notFound) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            This payment form isn&apos;t available.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!form) {
    return <Loader2 className="size-6 animate-spin text-primary" />
  }

  if (result) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <p className="text-sm text-foreground">
            {result.inline_message || "Thank you — your payment was received."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const accent = form.design?.accent_color || undefined

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent || "var(--primary)" }} />
      <CardHeader>
        {form.design?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.design.logo_url}
            alt=""
            className="mb-2 h-10 w-auto object-contain"
          />
        )}
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" style={accent ? { color: accent } : undefined} />
          {form.name}
        </CardTitle>
        <CardDescription>
          {form.amount_type === "fixed" && form.amount != null
            ? `${form.amount} ${form.currency}`
            : form.amount_type === "variable"
              ? `From ${form.min_amount ?? 0} ${form.currency}`
              : "Choose a product below"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id} className="grid gap-1.5">
            <Label className="text-muted-foreground">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
              {field.locked && <Lock className="ml-1 inline size-3" />}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                rows={3}
                value={fieldValues[field.id] ?? ""}
                onChange={(e) =>
                  setFieldValues((v) => ({ ...v, [field.id]: e.target.value }))
                }
              />
            ) : (
              <Input
                type={field.type === "phone" ? "tel" : field.type}
                placeholder={field.type === "phone" ? "+1 555 123 4567" : undefined}
                value={fieldValues[field.id] ?? ""}
                onChange={(e) =>
                  setFieldValues((v) => ({ ...v, [field.id]: e.target.value }))
                }
              />
            )}
          </div>
        ))}

        {form.amount_type === "variable" && (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Amount ({form.currency}) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={form.min_amount ?? 0}
              step="0.01"
              value={variableAmount}
              onChange={(e) => setVariableAmount(e.target.value)}
            />
          </div>
        )}

        {form.amount_type === "product_list" && (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Product <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              {(form.products ?? []).map((product) => (
                <label
                  key={product.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                    selectedProductId === product.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  style={
                    selectedProductId === product.id && accent
                      ? { borderColor: accent, backgroundColor: `${accent}10` }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="product"
                      checked={selectedProductId === product.id}
                      onChange={() => setSelectedProductId(product.id)}
                    />
                    {product.name}
                  </span>
                  <span className="font-medium text-foreground">
                    {product.price} {form.currency}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        {form.paypal_client_id ? (
          <div className="space-y-3">
            <div id="paypal-button-container" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <div id="card-button-container" />
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            This merchant hasn&apos;t connected PayPal yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
