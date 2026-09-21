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
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  localeForCountry,
  payPageStrings,
  phonePlaceholderForCountry,
  resolvePaypalSdkLocale,
  translateFieldLabel,
} from "@/lib/payments/pay-page-i18n"
import { backgroundStyle, CountryToggle, TopSectionBlock } from "@/lib/payments/checkout-render"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any
  }
}

/** PayPal's own two-tone wordmark colors ("Pay" dark navy, "Pal" light blue) — used verbatim for the "Powered by PayPal" trust badge so it matches PayPal's brand rendering exactly. Don't substitute theme tokens here; these are fixed brand colors, not accent-dependent. */
const PAYPAL_WORDMARK_COLORS = {
  pay: "#253B80",
  pal: "#179BD7",
} as const

/**
 * Maps Advanced Card Fields' own per-field keys (from its
 * `inputEvents` callbacks — see the `CardFields({...})` setup below)
 * to the short local keys used in `cardFocusedField`/`cardFieldInvalid`
 * state. There's no `cardNameField` here because the cardholder-name
 * input is our own plain `<Input>`, not a PayPal-rendered field (see
 * the comment on `cardholderName` state above).
 */
const CARD_SDK_FIELD_KEYS = {
  cardNumberField: "number",
  cardExpiryField: "expiry",
  cardCvvField: "cvv",
} as const

/** Same visual language as the shadcn `Input`'s own focus/invalid states (see the `.pay-page-surface` rules in globals.css and `aria-invalid:*` in `input.tsx`), reimplemented with plain classes because Advanced Card Fields' Number/Expiry/CVV boxes are plain wrapper `<div>`s around cross-origin iframes — the actual `<input>` inside can't be reached for `:focus-visible`/`aria-invalid`, so focus/validity state has to be tracked in React (via `inputEvents`) and applied here instead. */
function cardFieldBoxClassName(focused: boolean, invalid: boolean) {
  return cn(
    "h-8 rounded-lg border px-2.5 py-1 transition-colors",
    invalid
      ? "border-destructive ring-3 ring-destructive/20"
      : focused
        ? "border-black ring-[1.5px] ring-black/45"
        : "border-input",
  )
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

  // Hotmart-style "Cambiar país" picker (see `CountryToggle`) replaces
  // a bare ES/EN toggle — the page's language is DERIVED from the
  // country, not chosen independently. Defaults to this merchant's own
  // market (Dominican Republic) until IP-based geo-detection resolves
  // (best-effort — see `GET /api/public/payments/geo`); the visitor
  // can always override with the picker regardless. `countryTouchedRef`
  // stops the geo effect from clobbering a manual pick that lands
  // before detection finishes.
  const [country, setCountry] = useState("DO")
  const countryTouchedRef = useRef(false)
  useEffect(() => {
    fetch("/api/public/payments/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data.country && !countryTouchedRef.current) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCountry(data.country)
        }
      })
      .catch(() => {})
  }, [])
  const handleCountryChange = (countryCode: string) => {
    countryTouchedRef.current = true
    setCountry(countryCode)
  }
  const locale = localeForCountry(country)
  const t = payPageStrings[locale]

  const [form, setForm] = useState<PublicPaymentForm | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [variableAmount, setVariableAmount] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [sdkReady, setSdkReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{ inline_message: string | null } | null>(null)

  // Per-field "left empty" state for the red-outline validation on
  // required fields — keyed by `field.id` (plus the synthetic
  // "amount" key for the variable-amount input). Populated on blur
  // (buyer tabs/clicks away leaving it empty) and on a failed submit
  // attempt (`requiredFieldsOk` below), cleared as soon as the field
  // has a value again.
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({})
  const markFieldValidity = (id: string, value: string) => {
    setInvalidFields((prev) => {
      const nowInvalid = !value.trim()
      if (Boolean(prev[id]) === nowInvalid) return prev
      const next = { ...prev }
      if (nowInvalid) next[id] = true
      else delete next[id]
      return next
    })
  }

  // Full-screen overlay shown from the instant the buyer clicks the
  // "PayPal" or "Tarjeta de débito o crédito" button until PayPal's
  // own UI (its popup, or the hosted card panel) takes over — that
  // gap is our own `createOrder`/`submitOrder` round trip, which has
  // no visible feedback of its own otherwise. NOT used for the
  // Advanced Card Fields "Pagar" submit (`cardSubmitting` below) —
  // that button's gateway is already visible on screen by the time
  // it's clicked, so an inline spinner there is enough; this overlay
  // is specifically for the "loading the gateway" gap, not "submitting
  // to it". See the `onClick`/`createOrder` wiring in the SDK-render
  // effect below.
  const [paymentLoading, setPaymentLoading] = useState(false)

  // Focus/invalid state for the Advanced Card Fields boxes (Number/
  // Expiry/CVV) — see `cardFieldBoxClassName` above for why this can't
  // just be CSS like the plain `Input`/`Textarea` fields.
  const [cardFocusedField, setCardFocusedField] = useState<string | null>(null)
  const [cardFieldInvalid, setCardFieldInvalid] = useState<Record<string, boolean>>({})
  const [cardholderNameInvalid, setCardholderNameInvalid] = useState(false)

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
  // and reload it whenever the visitor's country (and so their
  // derived language) changes, since the SDK's own `locale` param
  // controls both the text AND the regional defaults (e.g. country
  // picker) PayPal renders inside its own button/hosted-checkout UI.
  useEffect(() => {
    if (!form?.paypal_client_id) return
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
  }, [form?.paypal_client_id, form?.currency, locale, country])

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

    // Checks every required field (not just the first empty one) so a
    // submit attempt paints ALL of them red at once, not just the one
    // named in the error message below.
    const requiredFieldsOk = (extraChecks: { id: string; label: string; value: string }[] = []) => {
      let firstMissingLabel: string | null = null
      const newlyInvalid: Record<string, boolean> = {}
      for (const field of form.fields) {
        if (field.required && !fieldValuesRef.current[field.id]?.trim()) {
          newlyInvalid[field.id] = true
          firstMissingLabel ??= translateFieldLabel(field, locale)
        }
      }
      if (Object.keys(newlyInvalid).length > 0) {
        setInvalidFields((prev) => ({ ...prev, ...newlyInvalid }))
      }
      for (const check of extraChecks) {
        if (!check.value.trim()) {
          firstMissingLabel ??= check.label
          if (check.id === "cardholderName") setCardholderNameInvalid(true)
        }
      }
      if (firstMissingLabel) {
        setErrorMessage(strings.fieldRequired(firstMissingLabel))
        return false
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
      // Defensive — `createOrder`'s own `finally` (below) already
      // clears this in the normal case; this only matters if PayPal
      // calls onError without ever calling createOrder.
      setPaymentLoading(false)
      if (err instanceof Error && err.message === "handled") return
      setErrorMessage(strings.paypalGenericError)
    }

    const buttonConfig = (fundingSource: string) => ({
      fundingSource,
      // Fires the instant the buyer clicks — before PayPal does
      // anything else — so the loading overlay appears immediately,
      // not only after our own `createOrder`/`submitOrder` round trip
      // has already started.
      onClick: () => setPaymentLoading(true),
      createOrder: async () => {
        try {
          setErrorMessage(null)
          if (!requiredFieldsOk()) throw new Error("handled")
          return await submitOrder()
        } finally {
          // Whether this succeeded or threw, PayPal takes over the
          // visible loading state from here (its popup, or the hosted
          // card panel expanding) — our overlay's job is done.
          setPaymentLoading(false)
        }
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
    // `data.fields` keys (cardNumberField/cardExpiryField/cardCvvField)
    // and their isFocused/isEmpty/isValid/isPotentiallyValid shape come
    // straight from PayPal's documented Advanced Card Fields event API
    // (https://developer.paypal.com/docs/checkout/advanced/customize/card-fields-events/)
    // — see `CARD_SDK_FIELD_KEYS` above. Only touches a field that's
    // NOT currently focused, so a box isn't flagged red while the buyer
    // is still typing in it — only once they've left it empty or
    // invalid, or corrected it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCardFieldValidity = (data: any) => {
      const fields = data?.fields
      if (!fields) return
      setCardFieldInvalid((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [sdkKey, localKey] of Object.entries(CARD_SDK_FIELD_KEYS)) {
          const f = fields[sdkKey]
          if (!f || f.isFocused) continue
          const invalid = Boolean(f.isEmpty || (!f.isValid && !f.isPotentiallyValid))
          if (next[localKey] !== invalid) {
            next[localKey] = invalid
            changed = true
          }
        }
        return changed ? next : prev
      })
    }

    let cardFieldsInstance: ReturnType<typeof window.paypal.CardFields> | null = null
    if (window.paypal.CardFields) {
      cardFieldsInstance = window.paypal.CardFields({
        style: {
          input: { "font-size": "14px", "font-family": "inherit", color: "#0f172a" },
          ".invalid": { color: "#dc2626" },
        },
        inputEvents: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onFocus: (data: any) => {
            const focusedSdkKey = Object.keys(CARD_SDK_FIELD_KEYS).find(
              (key) => data?.fields?.[key]?.isFocused,
            ) as keyof typeof CARD_SDK_FIELD_KEYS | undefined
            setCardFocusedField(focusedSdkKey ? CARD_SDK_FIELD_KEYS[focusedSdkKey] : null)
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onBlur: (data: any) => {
            setCardFocusedField(null)
            updateCardFieldValidity(data)
          },
          onChange: updateCardFieldValidity,
        },
        createOrder: async () => {
          setErrorMessage(null)
          const ok = requiredFieldsOk([
            { id: "cardholderName", label: strings.cardholderName, value: cardholderNameRef.current },
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
        <CountryToggle country={country} locale={locale} onChange={handleCountryChange} />
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
        {/* Base white layer, always rendered first so the page never
            falls back to the dashboard's dark default for visitors
            with no saved theme preference; the skin's own background
            (if any) paints on top of it. */}
        <div className="fixed inset-0 -z-10 bg-background" />
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
      {/* Base white layer, always rendered first — see the comment on
          its twin above in the `result` branch. */}
      <div className="fixed inset-0 -z-10 bg-background" />
      {Object.keys(bgStyle).length > 0 && <div className="fixed inset-0 -z-10" style={bgStyle} />}

      {/* See the `paymentLoading` state comment above for exactly what
          this spans (click → PayPal's own UI taking over). `z-50` sits
          above the Card (no explicit z-index, so it stacks below any
          positive z-index) and above PayPal's button iframes. */}
      {paymentLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-5 shadow-lg">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">{t.loadingGateway}</p>
          </div>
        </div>
      )}

      <Card className="w-full max-w-md overflow-hidden sm:max-w-lg">
        <CountryToggle country={country} locale={locale} onChange={handleCountryChange} />

        <TopSectionBlock topSection={topSection} />

      <CardHeader className="border-b border-border/60 bg-card">
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
          // price/description stacked to its right. `product.description`
          // itself still stays product-page-only by design (see
          // `PublicPaymentProduct` in src/types/index.ts) — the line
          // below is `form.checkout_description`, a PER-OFFER field
          // (migration 057), deliberately separate.
          <div className="flex items-start gap-3">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt=""
                className="size-16 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-border/60"
              />
            )}
            <div className="min-w-0">
              {/* Typography below mirrors the Hotmart checkout template
                  this layout is modeled on (see the comment above this
                  `product` block) — title in a bold serif "Times New
                  Roman" stack, author/price/description in Open Sans
                  (loaded as `--font-open-sans` in `src/app/layout.tsx`),
                  price bold, author/description in Hotmart's own muted
                  neutral-700. Applies to every product-linked checkout,
                  existing or new, since it's the shared render path,
                  not per-form/per-skin styling. */}
              <CardTitle
                className="text-base font-bold text-[#181817]"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {product.name}
              </CardTitle>
              {product.author && (
                <p
                  className="mt-0.5 text-xs font-normal text-[#464542]"
                  style={{ fontFamily: "var(--font-open-sans)" }}
                >
                  {t.authorLabel(product.author)}
                </p>
              )}
              <p
                className="mt-1 text-lg font-bold text-[#0d0d0d]"
                style={{ fontFamily: "var(--font-open-sans)" }}
              >
                {priceLine}
              </p>
              {form.checkout_description && (
                <p
                  className="mt-1 text-xs font-normal text-[#464542]"
                  style={{ fontFamily: "var(--font-open-sans)" }}
                >
                  {form.checkout_description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="size-5 text-primary" style={accent ? { color: accent } : undefined} />
              {form.name}
            </CardTitle>
            <CardDescription>{priceLine}</CardDescription>
            {form.checkout_description && (
              <p className="mt-1 text-xs text-muted-foreground">{form.checkout_description}</p>
            )}
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
                aria-invalid={invalidFields[field.id] || undefined}
                value={fieldValues[field.id] ?? ""}
                onChange={(e) => {
                  setFieldValues((v) => ({ ...v, [field.id]: e.target.value }))
                  if (field.required) markFieldValidity(field.id, e.target.value)
                }}
                onBlur={(e) => field.required && markFieldValidity(field.id, e.target.value)}
              />
            ) : (
              <Input
                type={field.type === "phone" ? "tel" : field.type}
                placeholder={
                  field.type === "phone"
                    ? `${locale === "es" ? "Ej:" : "e.g."} ${phonePlaceholderForCountry(country)}`
                    : undefined
                }
                className={field.type === "phone" ? "placeholder:text-muted-foreground/50" : undefined}
                aria-invalid={invalidFields[field.id] || undefined}
                value={fieldValues[field.id] ?? ""}
                onChange={(e) => {
                  setFieldValues((v) => ({ ...v, [field.id]: e.target.value }))
                  if (field.required) markFieldValidity(field.id, e.target.value)
                }}
                onBlur={(e) => field.required && markFieldValidity(field.id, e.target.value)}
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
              aria-invalid={invalidFields["amount"] || undefined}
              value={variableAmount}
              onChange={(e) => {
                setVariableAmount(e.target.value)
                markFieldValidity("amount", e.target.value)
              }}
              onBlur={(e) => markFieldValidity("amount", e.target.value)}
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
                  <div
                    id="card-number-field"
                    className={cardFieldBoxClassName(cardFocusedField === "number", Boolean(cardFieldInvalid.number))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.cardExpiry}</Label>
                    <div
                      id="card-expiry-field"
                      className={cardFieldBoxClassName(cardFocusedField === "expiry", Boolean(cardFieldInvalid.expiry))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-muted-foreground">{t.cardCvv}</Label>
                    <div
                      id="card-cvv-field"
                      className={cardFieldBoxClassName(cardFocusedField === "cvv", Boolean(cardFieldInvalid.cvv))}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-muted-foreground">{t.cardholderName}</Label>
                  <Input
                    aria-invalid={cardholderNameInvalid || undefined}
                    value={cardholderName}
                    onChange={(e) => {
                      setCardNameTouched(true)
                      setCardholderName(e.target.value)
                      if (e.target.value.trim()) setCardholderNameInvalid(false)
                    }}
                    onBlur={(e) => setCardholderNameInvalid(!e.target.value.trim())}
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

            {/* "Powered by PayPal" trust badge — sits below whichever
                payment action the buyer sees (PayPal button, Advanced
                Card Fields' own "Pagar" submit, or the FUNDING.CARD
                fallback). Move this block if the badge should sit
                under one specific button instead of the whole payment
                section. Colors match PayPal's own wordmark (dark navy
                "Pay" + light blue "Pal") — see the comment on
                PAYPAL_WORDMARK_COLORS below before changing them. */}
            <div className="flex items-center justify-center gap-1 pt-1 text-center text-xs">
              <span className="italic text-muted-foreground">{t.securedByPrefix}</span>
              <span className="text-sm font-bold italic">
                <span style={{ color: PAYPAL_WORDMARK_COLORS.pay }}>Pay</span>
                <span style={{ color: PAYPAL_WORDMARK_COLORS.pal }}>Pal</span>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t.noGateway}</p>
        )}
      </CardContent>
      </Card>
    </>
  )
}
