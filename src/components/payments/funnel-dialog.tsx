"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowRight, CornerDownRight, ExternalLink, Loader2, Trash2 } from "lucide-react"

import { usePaymentsT, type PaymentsT } from "@/hooks/use-payments-locale"
import type {
  FunnelPageContent,
  PaymentForm,
  PaymentFunnelStep,
  PaymentFunnelStepKind,
  PaymentProduct,
} from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImageUploadField } from "@/components/payments/image-upload-field"

/**
 * "Upsell y Downsell" manager for one offer (`mainOffer`, a
 * `payment_forms` row) — migration 063. One editor per step; each
 * step sells one or more OTHER offers of the account (price, currency
 * and delivery automation come from those offers, like order bumps)
 * plus the sales page's own copy.
 */
export function FunnelDialog({
  mainOffer,
  onOpenChange,
}: {
  mainOffer: PaymentForm | null
  onOpenChange: (open: boolean) => void
}) {
  const t = usePaymentsT("products")
  const [steps, setSteps] = useState<PaymentFunnelStep[] | null>(null)
  const [offers, setOffers] = useState<PaymentForm[]>([])
  const [products, setProducts] = useState<PaymentProduct[]>([])
  const formId = mainOffer?.id

  async function loadSteps(id: string) {
    const res = await fetch(`/api/payments/forms/${id}/funnel`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || t("funnel.loadFailed"))
      setSteps([])
      return
    }
    setSteps(data.steps ?? [])
  }

  useEffect(() => {
    if (!formId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSteps(null)
    loadSteps(formId)
    Promise.all([
      fetch("/api/payments/forms").then((r) => r.json()),
      fetch("/api/payments/products").then((r) => r.json()),
    ])
      .then(([formsData, productsData]) => {
        setOffers(formsData.forms ?? [])
        setProducts(productsData.products ?? [])
      })
      .catch(() => {})
    // Reload only when a different offer's dialog is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  const stepOf = (kind: PaymentFunnelStepKind) => steps?.find((s) => s.kind === kind) ?? null
  const upsell = stepOf("upsell")
  const downsell = stepOf("downsell")

  // Same eligibility rule as the API: fixed price, same currency, not this offer.
  const candidates = mainOffer
    ? offers.filter(
        (o) =>
          o.id !== mainOffer.id &&
          o.status !== "archived" &&
          o.currency === mainOffer.currency &&
          o.amount_type === "fixed" &&
          Number(o.amount) > 0,
      )
    : []

  return (
    <Dialog open={!!mainOffer} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("funnel.title")}</DialogTitle>
          <DialogDescription>{t("funnel.hint")}</DialogDescription>
        </DialogHeader>

        <FlowDiagram t={t} upsell={upsell} downsell={downsell} />

        {steps === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="upsell" className="min-w-0">
            <TabsList>
              <TabsTrigger value="upsell">{t("funnel.tabUpsell")}</TabsTrigger>
              <TabsTrigger value="downsell">{t("funnel.tabDownsell")}</TabsTrigger>
            </TabsList>
            {(["upsell", "downsell"] as const).map((kind) => (
              <TabsContent key={kind} value={kind} className="mt-4 min-w-0">
                {mainOffer && (
                  <StepEditor
                    key={`${formId}:${kind}:${stepOf(kind)?.updated_at ?? "new"}`}
                    t={t}
                    kind={kind}
                    mainOffer={mainOffer}
                    step={stepOf(kind)}
                    candidates={candidates}
                    products={products}
                    onSaved={() => formId && loadSteps(formId)}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FlowDiagram({
  t,
  upsell,
  downsell,
}: {
  t: PaymentsT
  upsell: PaymentFunnelStep | null
  downsell: PaymentFunnelStep | null
}) {
  const node = (label: string, step: PaymentFunnelStep | null | "fixed") => (
    <span
      className={cn(
        "rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap",
        step === "fixed"
          ? "border-border bg-muted text-foreground"
          : step?.active
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            : "border-dashed border-border text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {node(t("funnel.flowCheckout"), "fixed")}
        <ArrowRight className="size-3.5 text-muted-foreground" />
        {node(t("funnel.flowUpsell"), upsell)}
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{t("funnel.flowYes")}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        {node(t("funnel.flowThankYou"), "fixed")}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-24">
        <CornerDownRight className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{t("funnel.flowNo")}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        {node(t("funnel.flowDownsell"), downsell)}
        <ArrowRight className="size-3.5 text-muted-foreground" />
        {node(t("funnel.flowThankYou"), "fixed")}
      </div>
    </div>
  )
}

function StepEditor({
  t,
  kind,
  mainOffer,
  step,
  candidates,
  products,
  onSaved,
}: {
  t: PaymentsT
  kind: PaymentFunnelStepKind
  mainOffer: PaymentForm
  step: PaymentFunnelStep | null
  candidates: PaymentForm[]
  products: PaymentProduct[]
  onSaved: () => void
}) {
  const page: FunnelPageContent = step?.page ?? {}
  const [active, setActive] = useState(step?.active ?? true)
  const [offerIds, setOfferIds] = useState<string[]>(step?.offer_form_ids ?? [])
  const [price, setPrice] = useState(step?.price != null ? String(step.price) : "")
  const [compareAt, setCompareAt] = useState(step?.compare_at_price != null ? String(step.compare_at_price) : "")
  const [banner, setBanner] = useState(page.banner ?? "")
  const [headline, setHeadline] = useState(page.headline ?? "")
  const [subheadline, setSubheadline] = useState(page.subheadline ?? "")
  const [imageUrl, setImageUrl] = useState(page.image_url ?? "")
  const [bullets, setBullets] = useState((page.bullets ?? []).join("\n"))
  const [body, setBody] = useState(page.body ?? "")
  const [acceptLabel, setAcceptLabel] = useState(page.accept_label ?? "")
  const [declineLabel, setDeclineLabel] = useState(page.decline_label ?? "")
  const [timer, setTimer] = useState(page.timer_minutes != null ? String(page.timer_minutes) : "")
  const [guarantee, setGuarantee] = useState(page.guarantee ?? "")
  const [saving, setSaving] = useState(false)

  const productName = (offer: PaymentForm) => products.find((p) => p.id === offer.product_id)?.name ?? null
  const offerLabel = (offer: PaymentForm) => {
    const product = productName(offer)
    return product && product !== offer.name ? `${product} · ${offer.name}` : offer.name
  }

  // Selected offers that are no longer eligible stay listed (so they can
  // be unticked) — the public page skips them anyway.
  const listed = [
    ...candidates,
    ...offerIds
      .filter((id) => !candidates.some((c) => c.id === id))
      .map((id) => ({ id, name: "—", amount: 0, currency: mainOffer.currency }) as PaymentForm),
  ]
  const sumOfOffers = candidates
    .filter((o) => offerIds.includes(o.id))
    .reduce((sum, o) => sum + Math.round(Number(o.amount) * 100), 0) / 100
  const effectivePrice = Number(price) > 0 ? Number(price) : sumOfOffers

  function toggleOffer(id: string, checked: boolean) {
    setOfferIds((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)))
  }

  async function handleSave() {
    if (offerIds.length === 0) {
      toast.error(t("funnel.chooseOffer"))
      return
    }
    if (price.trim() && !(Number(price) > 0)) {
      toast.error(t("funnel.priceInvalid"))
      return
    }
    if (compareAt.trim() && !(Number(compareAt) > effectivePrice)) {
      toast.error(t("funnel.compareAtTooLow"))
      return
    }
    setSaving(true)
    const res = await fetch(`/api/payments/forms/${mainOffer.id}/funnel/${kind}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active,
        offer_form_ids: offerIds,
        price: price.trim() ? Number(price) : null,
        compare_at_price: compareAt.trim() ? Number(compareAt) : null,
        page: {
          banner,
          headline,
          subheadline,
          image_url: imageUrl,
          bullets: bullets.split("\n"),
          body,
          accept_label: acceptLabel,
          decline_label: declineLabel,
          timer_minutes: Number(timer) || 0,
          guarantee,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || t("funnel.saveFailed"))
      return
    }
    toast.success(t("funnel.saved"))
    onSaved()
  }

  async function toggleActive(next: boolean) {
    setActive(next)
    if (!step) return
    const res = await fetch(`/api/payments/forms/${mainOffer.id}/funnel/${kind}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    })
    if (!res.ok) {
      setActive(!next)
      toast.error(t("funnel.saveFailed"))
    }
  }

  async function handleRemove() {
    const res = await fetch(`/api/payments/forms/${mainOffer.id}/funnel/${kind}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error(t("funnel.removeFailed"))
      return
    }
    toast.success(t("funnel.removed"))
    onSaved()
  }

  const field = "flex min-w-0 flex-col gap-1.5"
  const label = "text-muted-foreground"

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">
        {kind === "upsell" ? t("funnel.upsellHint") : t("funnel.downsellHint")}
      </p>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">{t("funnel.active")}</p>
          <p className="text-xs text-muted-foreground">
            {step ? t("funnel.activeHint") : t("funnel.notConfigured")}
          </p>
        </div>
        <Switch checked={active} onCheckedChange={(v) => toggleActive(!!v)} aria-label={t("funnel.active")} />
      </div>

      <div className={field}>
        <Label className={label}>{t("funnel.offersLabel")}</Label>
        <p className="text-xs text-muted-foreground">{t("funnel.offersHint")}</p>
        {listed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {t("funnel.noCandidates")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {listed.map((offer) => (
              <label
                key={offer.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                  offerIds.includes(offer.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <input
                  type="checkbox"
                  checked={offerIds.includes(offer.id)}
                  onChange={(e) => toggleOffer(offer.id, e.target.checked)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{offerLabel(offer)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPaymentAmount(offer.amount ?? 0, offer.currency)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <Label className={label}>{t("funnel.compareAtLabel")}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            placeholder={t("funnel.compareAtPlaceholder")}
          />
        </div>
        <div className={field}>
          <Label className={label}>{t("funnel.priceLabel")}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("funnel.pricePlaceholder")}
          />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">
          {t("funnel.priceHint", { price: formatPaymentAmount(sumOfOffers, mainOffer.currency) })}
        </p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-semibold text-foreground">{t("funnel.pageSection")}</p>
        <div className={field}>
          <Label className={label}>{t("funnel.bannerLabel")}</Label>
          <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder={t("funnel.bannerPlaceholder")} />
        </div>
        <div className={field}>
          <Label className={label}>{t("funnel.headlineLabel")}</Label>
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={t("funnel.headlinePlaceholder")}
          />
        </div>
        <div className={field}>
          <Label className={label}>{t("funnel.subheadlineLabel")}</Label>
          <Textarea
            rows={2}
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            placeholder={t("funnel.subheadlinePlaceholder")}
          />
        </div>
        <div className={field}>
          <ImageUploadField
            label={t("funnel.imageLabel")}
            value={imageUrl}
            onChange={setImageUrl}
            maxWidth={1600}
            maxHeight={1600}
            t={t}
          />
          <p className="text-xs text-muted-foreground">{t("funnel.imageHint")}</p>
        </div>
        <div className={field}>
          <Label className={label}>{t("funnel.bulletsLabel")}</Label>
          <Textarea
            rows={5}
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            placeholder={t("funnel.bulletsPlaceholder")}
          />
        </div>
        <div className={field}>
          <Label className={label}>{t("funnel.bodyLabel")}</Label>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("funnel.bodyPlaceholder")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={field}>
            <Label className={label}>{t("funnel.acceptLabel")}</Label>
            <Input
              value={acceptLabel}
              onChange={(e) => setAcceptLabel(e.target.value)}
              placeholder={t("funnel.acceptPlaceholder")}
            />
          </div>
          <div className={field}>
            <Label className={label}>{t("funnel.declineLabel")}</Label>
            <Input
              value={declineLabel}
              onChange={(e) => setDeclineLabel(e.target.value)}
              placeholder={t("funnel.declinePlaceholder")}
            />
          </div>
          <div className={field}>
            <Label className={label}>{t("funnel.timerLabel")}</Label>
            <Input type="number" min="0" max="120" value={timer} onChange={(e) => setTimer(e.target.value)} placeholder="10" />
            <p className="text-xs text-muted-foreground">{t("funnel.timerHint")}</p>
          </div>
          <div className={field}>
            <Label className={label}>{t("funnel.guaranteeLabel")}</Label>
            <Input
              value={guarantee}
              onChange={(e) => setGuarantee(e.target.value)}
              placeholder={t("funnel.guaranteePlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {step && (
            <Button variant="outline" onClick={handleRemove} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              {t("funnel.remove")}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!step}
            title={step ? undefined : t("funnel.previewSaveFirst")}
            onClick={() => window.open(`/pay/offer/preview?form=${mainOffer.id}&kind=${kind}`, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
            {t("funnel.preview")}
          </Button>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("funnel.save")}
        </Button>
      </div>
    </div>
  )
}
