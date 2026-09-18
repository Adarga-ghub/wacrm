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

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react"

import type { PaymentPageBackground, PublicPaymentForm } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  PAYPAL_SDK_LOCALE,
  payPageStrings,
  translateFieldLabel,
  type PayLocale,
} from "@/lib/payments/pay-page-i18n"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any
  }
}

function LanguageToggle({ locale, onChange }: { locale: PayLocale; onChange: (l: PayLocale) => void }) {
  return (
    <div className="flex items-center justify-end gap-1 border-b border-border/60 bg-muted/30 px-3 py-1.5">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={locale === l}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors ${
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** "Fondo" block (see the Payment Skins builder) — page-wide background behind the checkout Card. */
function backgroundStyle(background?: PaymentPageBackground): CSSProperties {
  if (!background) return {}
  if ((background.type ?? "color") === "color") {
    return background.color ? { backgroundColor: background.color } : {}
  }
  if (!background.image_url) return {}
  return {
    backgroundImage: `url(${background.image_url})`,
    backgroundSize: background.fill ? "cover" : "auto",
    backgroundRepeat: background.fill ? "no-repeat" : background.repeat ? "repeat" : "no-repeat",
    backgroundAttachment: background.fixed ? "fixed" : "scroll",
    backgroundPosition: "center",
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
  const [cardFirstName, setCardFirstName] = useState("")
  const [cardLastName, setCardLastName] = useState("")
  const [cardEmail, setCardEmail] = useState("")
  const [cardSubmitting, setCardSubmitting] = useState(false)
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
  const cardFirstNameRef = useRef(cardFirstName)
  const cardLastNameRef = useRef(cardLastName)
  const cardEmailRef = useRef(cardEmail)
  useEffect(() => {
    fieldValuesRef.current = fieldValues
    variableAmountRef.current = variableAmount
    selectedProductIdRef.current = selectedProductId
    cardFirstNameRef.current = cardFirstName
    cardLastNameRef.current = cardLastName
    cardEmailRef.current = cardEmail
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
  // and reload it whenever the visitor toggles language, since the
  // SDK's own `locale` param controls the text PayPal renders inside
  // its own button/hosted-checkout UI.
  useEffect(() => {
    if (!form?.paypal_client_id) return
    const desiredLocale = PAYPAL_SDK_LOCALE[locale]
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
  }, [form?.paypal_client_id, form?.currency, locale])

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
        throw new Error(data.error || "create-order-failed")
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

    const handleError = () => setErrorMessage(strings.paypalGenericError)

    const buttonConfig = (fundingSource: string) => ({
      fundingSource,
      createOrder: async () => {
        setErrorMessage(null)
        if (!requiredFieldsOk()) throw new Error("validation")
        return submitOrder()
      },
      onApprove: handleApprove,
      onError: handleError,
    })

    const paypalButtons = window.paypal.Buttons(buttonConfig(window.paypal.FUNDING.PAYPAL))
    if (paypalButtons.isEligible()) paypalButtons.render("#paypal-button-container")

    // Try Advanced Card Fields first — it's the only way to render our
    // own minimal card form (Number/Expiry/CVV only, no PayPal-hosted
    // billing address). Falls back to the classic FUNDING.CARD button
    // (PayPal's own hosted card overlay) on accounts that don't have
    // Advanced Card Payments enabled.
    let cardFieldsInstance: ReturnType<typeof window.paypal.CardFields> | null = null
    if (window.paypal.CardFields) {
      cardFieldsInstance = window.paypal.CardFields({
        style: {
          input: { "font-size": "14px", "font-family": "inherit", color: "#0f172a" },
          ".invalid": { color: "#dc2626" },
        },
        createOrder: async () => {
          setErrorMessage(null)
          const firstName = cardFirstNameRef.current
          const lastName = cardLastNameRef.current
          const email = cardEmailRef.current
          const ok = requiredFieldsOk([
            { label: strings.firstName, value: firstName },
            { label: strings.lastName, value: lastName },
            { label: strings.email, value: email },
          ])
          if (!ok) throw new Error("validation")
          return submitOrder({
            ...fieldValuesRef.current,
            name: `${firstName} ${lastName}`.trim(),
            email: email.trim(),
          })
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
      await cardFieldsRef.current.submit({
        cardholderName: `${cardFirstName} ${cardLastName}`.trim(),
      })
    } catch {
      setErrorMessage((prev) => prev ?? t.paypalGenericError)
    } finally {
      setCardSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <Card className="w-full max-w-md overflow-hidden">
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
        <Card className="w-full max-w-md">
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
  const hasTopSection = !!(
    topSection?.banner_image_url ||
    topSection?.product_image_url ||
    topSection?.title ||
    topSection?.subtitle
  )

  return (
    <>
      {Object.keys(bgStyle).length > 0 && <div className="fixed inset-0 -z-10" style={bgStyle} />}
      <Card className="w-full max-w-md overflow-hidden">
        <LanguageToggle locale={locale} onChange={setLocale} />
        <div className="h-1.5 w-full" style={{ backgroundColor: accent || "var(--primary)" }} />

        {hasTopSection && (
          <div className="space-y-3 px-6 pt-6">
            {topSection?.banner_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={topSection.banner_image_url}
                alt=""
                className="w-full rounded-lg object-cover"
              />
            )}
            {topSection?.product_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={topSection.product_image_url}
                alt=""
                className="mx-auto block h-20 w-20 rounded-lg object-cover"
              />
            )}
            {topSection?.title && (
              <h2
                className="text-center font-bold text-foreground"
                style={{ fontSize: topSection.title_size ?? 36 }}
              >
                {topSection.title}
              </h2>
            )}
            {topSection?.subtitle && (
              <p
                className="text-center text-muted-foreground"
                style={{ fontSize: topSection.subtitle_size ?? 24 }}
              >
                {topSection.subtitle}
              </p>
            )}
          </div>
        )}

      <CardHeader>
        {!topSection?.banner_image_url && form.design?.logo_url && (
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
              ? t.fromAmount(form.min_amount ?? 0, form.currency)
              : t.chooseProduct}
        </CardDescription>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.firstName}</Label>
                    <Input value={cardFirstName} onChange={(e) => setCardFirstName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.lastName}</Label>
                    <Input value={cardLastName} onChange={(e) => setCardLastName(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">{t.email}</Label>
                  <Input type="email" value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} />
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
