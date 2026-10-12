"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Pencil, Trash2 } from "lucide-react"

import { usePaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentForm, PaymentOrderBump, PaymentProduct } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * "Order Bumps" manager for one offer (`mainOffer`, a `payment_forms`
 * row). Each bump points at ANOTHER offer of the account — its price,
 * currency and delivery automation come from that offer — plus its own
 * checkout copy (title/description). See migration 061.
 */
export function OrderBumpsDialog({
  mainOffer,
  onOpenChange,
}: {
  mainOffer: PaymentForm | null
  onOpenChange: (open: boolean) => void
}) {
  const t = usePaymentsT("products")
  const [bumps, setBumps] = useState<PaymentOrderBump[] | null>(null)
  const [offers, setOffers] = useState<PaymentForm[]>([])
  const [products, setProducts] = useState<PaymentProduct[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [offerId, setOfferId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  // Both optional, kept as typed strings — `price` empty = the bump
  // offer's own price; `compareAt` empty = no struck-through price.
  const [price, setPrice] = useState("")
  const [compareAt, setCompareAt] = useState("")
  const [saving, setSaving] = useState(false)

  const formId = mainOffer?.id

  async function loadBumps(id: string) {
    const res = await fetch(`/api/payments/forms/${id}/bumps`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || t("bumps.loadFailed"))
      setBumps([])
      return
    }
    setBumps(data.bumps ?? [])
  }

  useEffect(() => {
    if (!formId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBumps(null)
    resetEditor()
    loadBumps(formId)
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

  function resetEditor() {
    setEditingId(null)
    setOfferId("")
    setTitle("")
    setDescription("")
    setPrice("")
    setCompareAt("")
  }

  const productName = (offer: PaymentForm) =>
    products.find((p) => p.id === offer.product_id)?.name ?? null

  function offerLabel(offer: PaymentForm) {
    const product = productName(offer)
    const name = product && product !== offer.name ? `${product} · ${offer.name}` : offer.name
    return `${name} — ${formatPaymentAmount(offer.amount ?? 0, offer.currency)}`
  }

  // Only offers that could actually be charged in the same PayPal
  // order — same currency, fixed price — and aren't already bumps here.
  const usedOfferIds = new Set((bumps ?? []).map((b) => b.bump_form_id))
  const candidateOffers = mainOffer
    ? offers.filter(
        (o) =>
          o.id !== mainOffer.id &&
          o.currency === mainOffer.currency &&
          o.amount_type === "fixed" &&
          Number(o.amount) > 0 &&
          !usedOfferIds.has(o.id),
      )
    : []

  // The price that will actually be charged: the bump's own, else the
  // selected offer's — the struck-through price must be above it, or
  // the "offer" would read as a price increase.
  const selectedOffer = offers.find((o) => o.id === offerId)
  const effectivePrice = Number(price) > 0 ? Number(price) : Number(selectedOffer?.amount ?? 0)

  async function handleSubmit() {
    if (!formId) return
    if (price.trim() && !(Number(price) > 0)) {
      toast.error(t("bumps.priceInvalid"))
      return
    }
    if (compareAt.trim() && !(Number(compareAt) > effectivePrice)) {
      toast.error(t("bumps.compareAtTooLow"))
      return
    }
    const prices = {
      price: price.trim() ? Number(price) : null,
      compare_at_price: compareAt.trim() ? Number(compareAt) : null,
    }
    setSaving(true)
    const res = editingId
      ? await fetch(`/api/payments/forms/${formId}/bumps/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, ...prices }),
        })
      : await fetch(`/api/payments/forms/${formId}/bumps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bump_form_id: offerId, title, description, ...prices }),
        })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || t("bumps.saveFailed"))
      return
    }
    toast.success(editingId ? t("bumps.updated") : t("bumps.added"))
    resetEditor()
    loadBumps(formId)
  }

  async function toggleActive(bump: PaymentOrderBump, active: boolean) {
    if (!formId) return
    setBumps((prev) => prev?.map((b) => (b.id === bump.id ? { ...b, active } : b)) ?? prev)
    const res = await fetch(`/api/payments/forms/${formId}/bumps/${bump.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) {
      toast.error(t("bumps.saveFailed"))
      loadBumps(formId)
    }
  }

  async function removeBump(bump: PaymentOrderBump) {
    if (!formId) return
    const res = await fetch(`/api/payments/forms/${formId}/bumps/${bump.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error(t("bumps.removeFailed"))
      return
    }
    if (editingId === bump.id) resetEditor()
    setBumps((prev) => prev?.filter((b) => b.id !== bump.id) ?? prev)
  }

  function startEdit(bump: PaymentOrderBump) {
    setEditingId(bump.id)
    setOfferId(bump.bump_form_id)
    setTitle(bump.title ?? "")
    setDescription(bump.description ?? "")
    setPrice(bump.price != null ? String(bump.price) : "")
    setCompareAt(bump.compare_at_price != null ? String(bump.compare_at_price) : "")
  }

  return (
    <Dialog open={!!mainOffer} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bumps.title")}</DialogTitle>
          <DialogDescription>{t("bumps.hint")}</DialogDescription>
        </DialogHeader>

        {/* `min-w-0` on both sections: DialogContent is a CSS grid, and a
            grid item won't shrink below its longest unbreakable text by
            default — a long offer name pushed the list past the dialog's
            edge, `truncate` never kicked in. */}
        <div className="min-w-0 space-y-3">
          {bumps === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : bumps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              {t("bumps.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {bumps.map((bump) => {
                const offer = offers.find((o) => o.id === bump.bump_form_id)
                return (
                  <li
                    key={bump.id}
                    className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {bump.title || (offer ? productName(offer) ?? offer.name : "—")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {offer ? offerLabel(offer) : t("bumps.offerUnavailable")}
                      </p>
                      {offer && (
                        <p className="text-xs text-foreground">
                          {bump.compare_at_price != null && (
                            <span className="mr-1.5 text-muted-foreground line-through">
                              {formatPaymentAmount(bump.compare_at_price, offer.currency)}
                            </span>
                          )}
                          <span className="font-semibold">
                            {formatPaymentAmount(bump.price ?? offer.amount ?? 0, offer.currency)}
                          </span>
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={bump.active}
                      onCheckedChange={(v) => toggleActive(bump, !!v)}
                      aria-label={t("bumps.active")}
                    />
                    <button
                      type="button"
                      onClick={() => startEdit(bump)}
                      aria-label={t("bumps.edit")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBump(bump)}
                      aria-label={t("bumps.remove")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">
            {editingId ? t("bumps.editTitle") : t("bumps.addTitle")}
          </p>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("bumps.offerLabel")}</Label>
            {editingId ? (
              <p className="break-words text-sm text-foreground">
                {(() => {
                  const offer = offers.find((o) => o.id === offerId)
                  return offer ? offerLabel(offer) : "—"
                })()}
              </p>
            ) : (
              <select
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">{t("bumps.offerPlaceholder")}</option>
                {candidateOffers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offerLabel(offer)}
                  </option>
                ))}
              </select>
            )}
            {!editingId && candidateOffers.length === 0 && offers.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("bumps.noCandidates")}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("bumps.titleLabel")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("bumps.titlePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("bumps.compareAtLabel")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder={t("bumps.compareAtPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("bumps.priceLabel")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("bumps.pricePlaceholder")}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              {t("bumps.priceHint", {
                price: selectedOffer ? formatPaymentAmount(selectedOffer.amount ?? 0, selectedOffer.currency) : "—",
              })}
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("bumps.descriptionLabel")}</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("bumps.descriptionPlaceholder")}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="outline" onClick={resetEditor}>
                {t("cancel")}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={saving || (!editingId && !offerId)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? t("bumps.save") : t("bumps.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
