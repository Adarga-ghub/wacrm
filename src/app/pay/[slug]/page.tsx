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

import { Suspense, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react"

import type { PublicPaymentForm } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  payPageStrings,
  resolvePaypalSdkLocale,
  translateFieldLabel,
  type PayLocale,
} from "@/lib/payments/pay-page-i18n"
import { backgroundStyle, LanguageToggle, TopSectionBlock } from "@/lib/payments/checkout-render"

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

  // Default to Spanish (this product's primary market); flip to
  // English only when the browser reports an English locale. The
  // visitor can always override with the toggle regardless.
  const [locale, setLocale] = useState<PayLocale>("es")
  useEffect(() => {
    if (typeof navigator === "undefined") return
    if (navigator.language?.toLowerCase().startsWith("en")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale("en")
    }
  }, [])
  const t = payPageStrings[locale]

  // IP-based, best-effort — only ever narrows which PayPal SDK
  // locale we ask for (see `resolvePaypalSdkLocale`); `null` (still
  // detecting, or detection failed) just keeps today's behavior.
  const [buyerCountry, setBuyerCountry] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/public/payments/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data.country) setBuyerCountry(data.country)
      })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState<PublicPaymentForm | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [variableAmount, setVariableAmount] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [sdkReady, setSdkReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{ inline_message: string | null } | null>(null)

  // Advanced Card Fields (inline Number/Expiry/CVV, no PayPal-hosted
  // billing-address overlay) when the merchant's PayPal account is
  // eligible for it; otherwise we fall back to the classic
  // FUNDING.CARD button, which opens PayPal's own hosted guest
  // checkout instead.
  const [cardEligible, setCardEligible] = useState(false)
  // The only fields Advanced Card Fields collects beyond the card
  // itself: no postal code, no separate email, no first/last-name
  // split — the top form above already captured name/email/WhatsApp,
  // so re-asking for them here would just duplicate data entry.
  const [cardholderName, setCardholderName] = useState("")
  const [cardSubmitting, setCardSubmitting] = useState(false)

  // Autofill the cardholder name from the "name" field up top as the
  // buyer types it, so they never have to enter it twice on one
  // screen — but stop overwriting as soon as they've edited the card
  // field themselves, in case the cardholder differs from the
  // contact (e.g. a gift purchase).
  const [cardNameTouched, setCardNameTouched] = useState(false)
  const topName = fieldValues["name"] ?? ""
  useEffect(() => {
    if (cardNameTouched) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardholderName(topName)
  }, [topName, cardNameTouched])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardFieldsRef = useRef<any>(null)

  // Buttons/CardFields callbacks are set up once per SDK/form/locale
  // (see the effect below) and stay mounted across keystrokes — tearing
  // down and remounting the PayPal iframes on every keystroke would be
  // jarring. These refs let those long-lived closures always read the
  // latest typed values at click time instead of a stale snapshot from
  // whenever the effect last ran. Synced via a no-deps effect (runs
  // after every render) rather than a direct assignment during render,
  // which the ref lint rule flags even though it's the same result.
  const fieldValuesRef = useRef(fieldValues)
  const variableAmountRef = useRef(variableAmount)
  const selectedProductIdRef = useRef(selectedProductId)
  const cardholderNameRef = useRef(cardholderName)
  useEffect(() => {
    fieldValuesRef.current = fieldValues
    variableAmountRef.current = variableAmount
    selectedProductIdRef.current = selectedProductId
    cardholderNameRef.current = cardholderName
  })

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

  // Load the PayPal JS SDK once we know the merchant's Client ID —
  // and reload it whenever the visitor toggles language or their
  // detected country resolves, since the SDK's own `locale` param
  // controls both the text AND the regional defaults (e.g. country
  // picker) PayPal renders inside its own button/hosted-checkout UI.
  useEffect(() => {
    if (!form?.paypal_client_id) return
    const desiredLocale = resolvePaypalSdkLocale(locale, buyerCountry)
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
    // `enable-funding=card` is what makes the "Debit or Credit Card"
    // button show reliably: PayPal's own eligibility heuristic
    // otherwise sometimes hides it (e.g. when the buyer's browser
    // carries a recognized PayPal login cookie), and this merchant
    // explicitly wants guest card checkout offered every time
    // alongside the PayPal button, not only when auto-detected.
    // `components=buttons,card-fields` additionally pulls in Advanced
    // Card Payments so we can render our own minimal inline card form
    // instead of PayPal's hosted (address-heavy) card overlay, on
    // accounts that have that capability enabled.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      form.paypal_client_id,
    )}&currency=${encodeURIComponent(form.currency)}&enable-funding=card&components=buttons,card-fields&locale=${desiredLocale}`
    script.onload = () => setSdkReady(true)
    script.onerror = () => setErrorMessage(payPageStrings[locale].sdkLoadError)
    document.body.appendChild(script)
  }, [form?.paypal_client_id, form?.currency, locale, buyerCountry])

  // Render the PayPal button, and either Advanced Card Fields (inline,
  // minimal) or the FUNDING.CARD fallback button, once the SDK is
  // ready. Deliberately NOT re-run on every keystroke in the form
  // fields/amount/product picker (see the refs above) — only when the
  // SDK reloads, the form itself changes, or the language toggles.
  useEffect(() => {
    if (!sdkReady || !form || !window.paypal) return
    const paypalContainer = document.getElementById("paypal-button-container")
    const cardContainer = document.getElementById("card-button-container")
    if (!paypalContainer) return
    paypalContainer.innerHTML = ""
    if (cardContainer) cardContainer.innerHTML = ""

    const strings = payPageStrings[locale]

    const requiredFieldsOk = (extraChecks: { label: string; value: string }[] = []) => {
      for (const field of form.fields) {
        if (field.required && !fieldValuesRef.current[field.id]?.trim()) {
          setErrorMessage(strings.fieldRequired(translateFieldLabel(field, locale)))
          return false
        }
      }
      for (const check of extraChecks) {
        if (!check.value.trim()) {
          setErrorMessage(strings.fieldRequired(check.label))
          return false
        }
      }
      if (form.amount_type === "product_list" && !selectedProductIdRef.current) {
        setErrorMessage(strings.chooseProductError)
        return false
      }
      return true
    }

    const submitOrder = async (overrideFieldValues?: Record<string, string>): Promise<string> => {
      const res = await fetch("/api/public/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          link_code: linkCode ?? undefined,
          field_values: overrideFieldValues ?? fieldValuesRef.current,
          amount: form.amount_type === "variable" ? Number(variableAmountRef.current) : undefined,
          product_id: form.amount_type === "product_list" ? selectedProductIdRef.current : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || strings.startError)
        // "handled" tells `handleError` (below) a specific message is
        // already on screen — PayPal still calls onError after a
        // thrown createOrder, and without this marker it clobbers this
        // message with the generic "problema con PayPal" one.
        throw new Error("handled")
      }
      return data.order_id
    }

    const handleApprove = async (data: { orderID: string }) => {
      const res = await fetch(`/api/public/payments/orders/${data.orderID}/capture`, {
        method: "POST",
      })
      const captureData = await res.json()
      if (!res.ok) {
        setErrorMessage(captureData.error || strings.paymentIncomplete)
        return
      }
      if (captureData.redirect_url) {
        window.location.href = captureData.redirect_url
        return
      }
      setResult({ inline_message: captureData.inline_message })
    }

    // A thrown createOrder always triggers onError too, on top of
    // whatever we already told the buyer (a missing-field message, an
    // order-creation failure) — skip the generic overwrite for those
    // "handled" cases so the specific message stays on screen instead
    // of being replaced by a misleading "problema con PayPal".
    const handleError = (err?: unknown) => {
      if (err instanceof Error && err.message === "handled") return
      setErrorMessage(strings.paypalGenericError)
    }

    const buttonConfig = (fundingSource: string) => ({
      fundingSource,
      createOrder: async () => {
        setErrorMessage(null)
        if (!requiredFieldsOk()) throw new Error("handled")
        return submitOrder()
      },
      onApprove: handleApprove,
      onError: handleError,
    })

    const paypalButtons = window.paypal.Buttons(buttonConfig(window.paypal.FUNDING.PAYPAL))
    if (paypalButtons.isEligible()) paypalButtons.render("#paypal-button-container")

    // Try Advanced Card Fields first — it's the only way to render our
    // own minimal card form (Number/Expiry/CVV/cardholder name only,
    // no PayPal-hosted billing address). Falls back to the classic
    // FUNDING.CARD button (PayPal's own hosted card overlay) on
    // accounts that don't have Advanced Card Payments enabled — that
    // way a card option is always offered and working, even when it
    // isn't our own trimmed-down form.
    let cardFieldsInstance: ReturnType<typeof window.paypal.CardFields> | null = null
    if (window.paypal.CardFields) {
      cardFieldsInstance = window.paypal.CardFields({
        style: {
          input: { "font-size": "14px", "font-family": "inherit", color: "#0f172a" },
          ".invalid": { color: "#dc2626" },
        },
        createOrder: async () => {
          setErrorMessage(null)
          const ok = requiredFieldsOk([
            { label: strings.cardholderName, value: cardholderNameRef.current },
          ])
          if (!ok) throw new Error("handled")
          return submitOrder()
        },
        onApprove: handleApprove,
        onError: handleError,
      })
    }

    if (cardFieldsInstance?.isEligible?.()) {
      setCardEligible(true)
      cardFieldsRef.current = cardFieldsInstance
      const numberContainer = document.getElementById("card-number-field")
      const expiryContainer = document.getElementById("card-expiry-field")
      const cvvContainer = document.getElementById("card-cvv-field")
      if (numberContainer) numberContainer.innerHTML = ""
      if (expiryContainer) expiryContainer.innerHTML = ""
      if (cvvContainer) cvvContainer.innerHTML = ""
      cardFieldsInstance.NumberField().render("#card-number-field")
      cardFieldsInstance.ExpiryField().render("#card-expiry-field")
      cardFieldsInstance.CVVField().render("#card-cvv-field")
    } else {
      setCardEligible(false)
      cardFieldsRef.current = null
      if (cardContainer) {
        const cardButtons = window.paypal.Buttons({
          ...buttonConfig(window.paypal.FUNDING.CARD),
          style: { label: "pay", color: "black" },
        })
        if (cardButtons.isEligible()) cardButtons.render("#card-button-container")
      }
    }
  }, [sdkReady, form, linkCode, slug, locale])

  const handleCardSubmit = async () => {
    if (!cardFieldsRef.current) return
    setCardSubmitting(true)
    try {
      await cardFieldsRef.current.submit({ cardholderName: cardholderName.trim() })
    } catch {
      setErrorMessage((prev) => prev ?? t.paypalGenericError)
    } finally {
      setCardSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <Card className="w-full max-w-md overflow-hidden sm:max-w-lg">
        <LanguageToggle locale={locale} onChange={setLocale} />
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">{t.notAvailable}</p>
        </CardContent>
      </Card>
    )
  }

  if (!form) {
    return <Loader2 className="size-6 animate-spin text-primary" />
  }

  const bgStyle = backgroundStyle(form.design?.background)

  if (result) {
    return (
      <>
        {Object.keys(bgStyle).length > 0 && <div className="fixed inset-0 -z-10" style={bgStyle} />}
        <Card className="w-full max-w-md sm:max-w-lg">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="text-sm text-foreground">{result.inline_message || t.thankYou}</p>
          </CardContent>
        </Card>
      </>
    )
  }

  const accent = form.design?.accent_color || undefined
  const topSection = form.design?.top_section
  const product = form.product

  const priceLine =
    form.amount_type === "fixed" && form.amount != null
      ? formatPaymentAmount(form.amount, form.currency)
      : form.amount_type === "variable"
        ? t.fromAmount(formatPaymentAmount(form.min_amount ?? 0, form.currency))
        : t.chooseProduct

  return (
    <>
      {Object.keys(bgStyle).length > 0 && <div className="fixed inset-0 -z-10" style={bgStyle} />}
      <Card className="w-full max-w-md overflow-hidden sm:max-w-lg">
        <LanguageToggle locale={locale} onChange={setLocale} />
        <div className="h-1.5 w-full" style={{ backgroundColor: accent || "var(--primary)" }} />

        <TopSectionBlock topSection={topSection} />

      <CardHeader>
        {form.design?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.design.logo_url}
            alt=""
            className="mb-2 h-10 w-auto object-contain"
          />
        )}
        {product ? (
          // Title/image/author "halados" from the linked Producto
          // (migration 054/056) — Hotmart-style — instead of any
          // per-form/per-skin copy, so the same skin can be applied to
          // different products without carrying one product's title
          // baked into shared design. Layout mirrors Hotmart's own
          // checkout exactly: small cover on the left, title/author/
          // price stacked to its right — NOT the description, which
          // stays product-page-only by design.
          <div className="flex items-start gap-3">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt=""
                className="size-16 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0">
              <CardTitle>{product.name}</CardTitle>
              {product.author && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.authorLabel(product.author)}</p>
              )}
              <p className="mt-1 text-base font-semibold text-foreground">{priceLine}</p>
            </div>
          </div>
        ) : (
          <>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" style={accent ? { color: accent } : undefined} />
              {form.name}
            </CardTitle>
            <CardDescription>{priceLine}</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id} className="grid gap-1.5">
            <Label className="text-muted-foreground">
              {translateFieldLabel(field, locale)}
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
                placeholder={field.type === "phone" ? (locale === "es" ? "Ej: 809-000-0000" : "e.g. 809-000-0000") : undefined}
                className={field.type === "phone" ? "placeholder:text-muted-foreground/50" : undefined}
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
              {t.amountLabel(form.currency)} <span className="text-destructive">*</span>
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
              {t.productLabel} <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              {(form.products ?? []).map((product) => (
                <label
                  key={product.id}
                  className={`flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border p-3 text-sm transition-colors ${
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
                  <span className="flex min-w-0 items-center gap-2 break-words">
                    <input
                      type="radio"
                      name="product"
                      checked={selectedProductId === product.id}
                      onChange={() => setSelectedProductId(product.id)}
                      className="shrink-0"
                    />
                    {product.name}
                  </span>
                  <span className="shrink-0 font-medium text-foreground">
                    {formatPaymentAmount(product.price, form.currency)}
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
              {t.or}
              <span className="h-px flex-1 bg-border" />
            </div>
            {cardEligible ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{t.cardSectionTitle}</p>
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">{t.cardNumber}</Label>
                  <div id="card-number-field" className="h-8 rounded-lg border border-input px-2.5 py-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.cardExpiry}</Label>
                    <div id="card-expiry-field" className="h-8 rounded-lg border border-input px-2.5 py-1" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.cardCvv}</Label>
                    <div id="card-cvv-field" className="h-8 rounded-lg border border-input px-2.5 py-1" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">{t.cardholderName}</Label>
                  <Input
                    value={cardholderName}
                    onChange={(e) => {
                      setCardNameTouched(true)
                      setCardholderName(e.target.value)
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCardSubmit}
                  disabled={cardSubmitting}
                  className="flex h-9 w-full items-center justify-center rounded-lg bg-black text-sm font-medium text-white transition-opacity disabled:opacity-50"
                >
                  {cardSubmitting ? <Loader2 className="size-4 animate-spin" /> : t.pay}
                </button>
              </div>
            ) : (
              <div id="card-button-container" />
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t.noGateway}</p>
        )}
      </CardContent>
      </Card>
    </>
  )
}
