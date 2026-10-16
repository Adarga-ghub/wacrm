"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Star, Trash2, X } from "lucide-react"

import { usePaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentForm, PaymentOrderBump, PaymentProduct, PublicOrderBump } from "@/types"
import { formatPaymentAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { payPageStrings } from "@/lib/payments/pay-page-i18n"
import { OrderBumpBox } from "@/components/payments/order-bump-box"
import { BumpPreviewContent } from "@/components/payments/bump-preview"
import {
  BUMP_GALLERY_IMAGE,
  BUMP_GALLERY_MAX_IMAGES,
  CHECKOUT_TEXT_LIMITS,
  isValidBumpGalleryImageSize,
} from "@/lib/payments/checkout-limits"
import { MEDIA_MAX_BYTES_BY_KIND, uploadAccountMedia } from "@/lib/storage/upload-media"
import { CharCounter } from "@/components/payments/checkout-header-settings"
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

/** A picked file's pixel size, read in the browser — null when it can't be decoded. */
function readImageSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

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
  const tSkins = usePaymentsT("skins")
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
  // Preview pop-up images (migration 064) — first = main/mockup.
  const [gallery, setGallery] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  // Which image the next file pick replaces — null = append a new one.
  const replaceIndexRef = useRef<number | null>(null)

  /** Opens the file picker; with `index`, the chosen file replaces that image. */
  function pickGalleryImage(index: number | null) {
    replaceIndexRef.current = index
    galleryInputRef.current?.click()
  }
  const [saving, setSaving] = useState(false)
  // Section heading above all of this offer's bumps (migration 064) —
  // saved on the main offer itself, separately from any one bump.
  const [heading, setHeading] = useState("")
  const [savedHeading, setSavedHeading] = useState("")
  const [savingHeading, setSavingHeading] = useState(false)
  // "Vista previa" — renders the bump being edited (unsaved values
  // included) with the checkout's own components.
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewChecked, setPreviewChecked] = useState(false)

  const formId = mainOffer?.id

  /**
   * `select` opens a bump in the editor once loaded: "first" when the
   * dialog opens (so an existing bump's images and copy are on screen
   * right away — the empty "add" form looked like they were missing),
   * or the id of the bump that was just saved, so it stays open.
   */
  async function loadBumps(id: string, select?: "first" | string) {
    const res = await fetch(`/api/payments/forms/${id}/bumps`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || t("bumps.loadFailed"))
      setBumps([])
      return
    }
    const list: PaymentOrderBump[] = data.bumps ?? []
    setBumps(list)
    const toOpen = select === "first" ? list[0] : list.find((b) => b.id === select)
    if (toOpen) startEdit(toOpen)
  }

  useEffect(() => {
    if (!formId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBumps(null)
    resetEditor()
    setHeading(mainOffer?.bump_heading ?? "")
    setSavedHeading(mainOffer?.bump_heading ?? "")
    loadBumps(formId, "first")
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
    setGallery([])
  }

  async function saveHeading() {
    if (!formId) return
    setSavingHeading(true)
    const res = await fetch(`/api/payments/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bump_heading: heading }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingHeading(false)
    if (!res.ok) {
      toast.error(data.error || t("bumps.headingSaveFailed"))
      return
    }
    setSavedHeading(heading)
    toast.success(t("bumps.headingSaved"))
  }

  async function addGalleryImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    // Set by "Cambiar" on an image card: the upload takes that image's
    // place instead of being appended, so the order stays the same.
    // Read (and cleared) up front so a rejected file can't leave it set.
    const replaceIndex = replaceIndexRef.current
    replaceIndexRef.current = null
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error(tSkins("imageInvalidType"))
      return
    }
    if (file.size > MEDIA_MAX_BYTES_BY_KIND.image) {
      toast.error(tSkins("imageTooLarge"))
      return
    }
    // Size rule (BUMP_GALLERY_IMAGE): checked from the file itself,
    // before anything is uploaded — a wrong-size image never reaches
    // storage or the gallery.
    const size = await readImageSize(file)
    if (!size || !isValidBumpGalleryImageSize(size.w, size.h)) {
      toast.error(
        t("bumps.gallerySizeRejected", {
          size: size ? `${size.w} × ${size.h} px` : "?",
          required: `${BUMP_GALLERY_IMAGE.width} × ${BUMP_GALLERY_IMAGE.height} px`,
        }),
        { duration: 8000 },
      )
      return
    }
    setUploadingImage(true)
    try {
      const { publicUrl } = await uploadAccountMedia("payment-media", file)
      setGallery((g) => {
        if (replaceIndex != null && replaceIndex < g.length) {
          return g.map((src, j) => (j === replaceIndex ? publicUrl : src))
        }
        return g.length >= BUMP_GALLERY_MAX_IMAGES ? g : [...g, publicUrl]
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSkins("imageUploadFailed"))
    } finally {
      setUploadingImage(false)
    }
  }

  /** Swaps an image with its neighbour (`delta` -1 = earlier, +1 = later) — position 1 is the main image. */
  function moveImage(index: number, delta: -1 | 1) {
    setGallery((g) => {
      const target = index + delta
      if (target < 0 || target >= g.length) return g
      const next = [...g]
      ;[next[target], next[index]] = [next[index], next[target]]
      return next
    })
  }

  /** Makes an image the pop-up's main one, keeping the others in order. */
  function makeMainImage(index: number) {
    setGallery((g) => (index <= 0 ? g : [g[index], ...g.filter((_, j) => j !== index)]))
  }

  // Each image's real pixel size, read once it loads — shown under the
  // thumbnail so the merchant can tell a proper mockup from a tiny one.
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>({})
  const recommendedSize = `${BUMP_GALLERY_IMAGE.width} × ${BUMP_GALLERY_IMAGE.height} px`

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

  // What the checkout would render for the form as it is right now —
  // same fallbacks as `loadOrderBumps` (title → product/offer name,
  // cover → product image, compare-at only when above the price).
  const selectedProduct = selectedOffer ? products.find((p) => p.id === selectedOffer.product_id) : undefined
  const previewBump: PublicOrderBump = {
    id: editingId ?? "preview",
    title: title.trim() || selectedProduct?.name || selectedOffer?.name || t("bumps.previewEmptyTitle"),
    description: description.trim() || null,
    price: effectivePrice,
    compare_at_price: Number(compareAt) > effectivePrice ? Number(compareAt) : null,
    image_url: selectedProduct?.image_url ?? null,
    gallery_images: gallery,
  }
  const previewCurrency = selectedOffer?.currency ?? mainOffer?.currency ?? "USD"

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
          body: JSON.stringify({ title, description, gallery_images: gallery, ...prices }),
        })
      : await fetch(`/api/payments/forms/${formId}/bumps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bump_form_id: offerId, title, description, gallery_images: gallery, ...prices }),
        })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || t("bumps.saveFailed"))
      return
    }
    toast.success(editingId ? t("bumps.updated") : t("bumps.added"))
    const savedId: string | undefined = data.bump?.id ?? editingId ?? undefined
    resetEditor()
    // Keep the bump that was just saved open, so its images can keep
    // being adjusted without hunting for its pencil again.
    loadBumps(formId, savedId)
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
    setGallery(bump.gallery_images ?? [])
  }

  return (
    <Dialog open={!!mainOffer} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bumps.title")}</DialogTitle>
          <DialogDescription>{t("bumps.hint")}</DialogDescription>
        </DialogHeader>

        {/* `min-w-0` on both sections: DialogContent is a CSS grid, and a
            grid item won't shrink below its longest unbreakable text by
            default — a long offer name pushed the list past the dialog's
            edge, `truncate` never kicked in. */}
        <div className="grid min-w-0 gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">{t("bumps.headingLabel")}</Label>
            <CharCounter value={heading} max={CHECKOUT_TEXT_LIMITS.bumpHeading} />
          </div>
          <div className="flex gap-2">
            <Input
              value={heading}
              maxLength={CHECKOUT_TEXT_LIMITS.bumpHeading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder={t("bumps.headingPlaceholder")}
            />
            <Button
              variant="outline"
              onClick={saveHeading}
              disabled={savingHeading || heading.trim() === savedHeading.trim()}
            >
              {savingHeading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("bumps.headingSave")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("bumps.maxChars", { max: CHECKOUT_TEXT_LIMITS.bumpHeading })} · {t("bumps.headingHint")}
          </p>
        </div>

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
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                      editingId === bump.id ? "border-primary bg-primary/5" : "border-border",
                    )}
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
          {!!bumps?.length && !editingId && (
            <p className="text-xs text-muted-foreground">{t("bumps.editExistingHint")}</p>
          )}
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetEditor} className="w-full border-dashed">
              <Plus className="h-4 w-4" />
              {t("bumps.addAnother")}
            </Button>
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
          <p className="text-xs text-muted-foreground">{t("bumps.boxHint")}</p>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">{t("bumps.titleLabel")}</Label>
              <CharCounter value={title} max={CHECKOUT_TEXT_LIMITS.bumpTitle} />
            </div>
            <Input
              value={title}
              maxLength={CHECKOUT_TEXT_LIMITS.bumpTitle}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("bumps.titlePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("bumps.maxChars", { max: CHECKOUT_TEXT_LIMITS.bumpTitle })}
            </p>
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
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">{t("bumps.descriptionLabel")}</Label>
              <CharCounter value={description} max={CHECKOUT_TEXT_LIMITS.bumpDescription} />
            </div>
            <Textarea
              rows={3}
              value={description}
              maxLength={CHECKOUT_TEXT_LIMITS.bumpDescription}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("bumps.descriptionPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("bumps.maxChars", { max: CHECKOUT_TEXT_LIMITS.bumpDescription })}
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("bumps.galleryLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("bumps.galleryHint", { max: BUMP_GALLERY_MAX_IMAGES })}
            </p>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={addGalleryImage}
            />
            {/* Big enough to judge each image: shown whole (object-contain
                on white, like the pop-up) with its real pixel size, its
                position number and plain controls under it. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((src, i) => {
                const size = imageSizes[src]
                return (
                  <div
                    key={src + i}
                    className={cn(
                      "flex min-w-0 flex-col overflow-hidden rounded-lg border",
                      i === 0 ? "border-amber-400 ring-2 ring-amber-400/50" : "border-border",
                    )}
                  >
                    {/* Clicking the image itself replaces it (same position). */}
                    <button
                      type="button"
                      onClick={() => pickGalleryImage(i)}
                      disabled={uploadingImage}
                      title={t("bumps.galleryReplace")}
                      className="group relative flex aspect-[4/5] items-center justify-center bg-white p-1.5 disabled:cursor-wait"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        onLoad={(e) => {
                          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                          setImageSizes((s) => (s[src] ? s : { ...s, [src]: { w, h } }))
                        }}
                        className="max-h-full max-w-full object-contain"
                      />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <RefreshCw className="h-3 w-3" />
                        {t("bumps.galleryReplace")}
                      </span>
                      <span
                        className={cn(
                          "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          i === 0 ? "bg-amber-400 text-black" : "bg-black/70 text-white",
                        )}
                      >
                        {i === 0 ? `1 · ${t("bumps.galleryMain")}` : i + 1}
                      </span>
                    </button>
                    <div className="space-y-1.5 border-t border-border p-1.5">
                      {/* Images saved before the size rule are kept, just
                          flagged — only new uploads are blocked. */}
                      {size && !isValidBumpGalleryImageSize(size.w, size.h) ? (
                        <div className="space-y-0.5 text-center">
                          <p className="text-[11px] font-semibold text-red-500">
                            {size.w} × {size.h} px
                          </p>
                          <p className="rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium leading-tight text-red-500">
                            {t("bumps.gallerySizeInvalid", { required: recommendedSize })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-center text-[11px] text-emerald-500">
                          {size ? `${size.w} × ${size.h} px ✓` : "…"}
                        </p>
                      )}
                      <p className="text-center text-[10px] text-muted-foreground">
                        {t("bumps.galleryRecommended", { size: recommendedSize })}
                      </p>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          aria-label={t("bumps.galleryMoveEarlier")}
                          title={t("bumps.galleryMoveEarlier")}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => makeMainImage(i)}
                          disabled={i === 0}
                          aria-label={t("bumps.galleryMakeMain")}
                          title={t("bumps.galleryMakeMain")}
                          className="rounded p-1 text-amber-500 hover:bg-muted disabled:opacity-30"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === gallery.length - 1}
                          aria-label={t("bumps.galleryMoveLater")}
                          title={t("bumps.galleryMoveLater")}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pickGalleryImage(i)}
                          disabled={uploadingImage}
                          aria-label={t("bumps.galleryReplace")}
                          title={t("bumps.galleryReplace")}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGallery((g) => g.filter((_, j) => j !== i))}
                          aria-label={t("bumps.galleryRemove")}
                          title={t("bumps.galleryRemove")}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {gallery.length < BUMP_GALLERY_MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => pickGalleryImage(null)}
                  disabled={uploadingImage}
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
                >
                  {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {t("bumps.galleryAdd")}
                  <span className="text-[10px]">
                    {gallery.length}/{BUMP_GALLERY_MAX_IMAGES}
                  </span>
                  <span className="px-2 text-center text-[10px] leading-tight">
                    {t("bumps.galleryRecommended", { size: recommendedSize })}
                  </span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("bumps.gallerySizeHint")}</p>
          </div>
        </div>

        {/* Footer pinned to the bottom of the (scrolling) dialog, so
            "Guardar" and "Vista previa" are always on screen — the form
            above is long enough (gallery, copy) that a button at its very
            end was easy to miss. `-mx-4 -mb-4` cancels DialogContent's
            own p-4 so the bar spans edge to edge. */}
        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 space-y-1.5 border-t border-border bg-popover px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewChecked(false)
                setPreviewOpen(true)
              }}
              disabled={!editingId && !offerId}
            >
              <Eye className="h-4 w-4" />
              {t("bumps.preview")}
            </Button>
            <div className="flex gap-2">
              {editingId && (
                <Button variant="outline" onClick={resetEditor}>
                  {t("cancel")}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={saving || uploadingImage || (!editingId && !offerId)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingId ? t("bumps.save") : t("bumps.saveNew")}
              </Button>
            </div>
          </div>
          {!editingId && !offerId && (
            <p className="text-right text-xs text-muted-foreground">{t("bumps.chooseOfferFirst")}</p>
          )}
        </div>

        {/* Nested inside the parent's content so a click in the preview
            doesn't count as an "outside click" that closes the parent. */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("bumps.previewTitle")}</DialogTitle>
              <DialogDescription>{t("bumps.previewHint")}</DialogDescription>
            </DialogHeader>
            {/* `pay-page-surface` forces the checkout's light palette, so
                the preview looks like the real checkout even when the
                dashboard is in dark mode. */}
            <div className="pay-page-surface min-w-0 space-y-4 rounded-xl bg-white p-4 text-slate-900">
              <div className="space-y-3">
                <p className="text-center text-[17px] font-extrabold leading-snug text-red-700">
                  {heading.trim() || payPageStrings.es.bumpsHeadingDefault}
                </p>
                <OrderBumpBox
                  bump={previewBump}
                  currency={previewCurrency}
                  checked={previewChecked}
                  onCheckedChange={setPreviewChecked}
                  onPreview={() => {}}
                  t={payPageStrings.es}
                />
              </div>
              {(previewBump.gallery_images.length > 0 || previewBump.image_url) && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-500">{t("bumps.previewPopup")}</p>
                  <div className="rounded-2xl p-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
                    <BumpPreviewContent
                      key={previewBump.gallery_images.join("|")}
                      bump={previewBump}
                      currency={previewCurrency}
                      locale="es"
                      checked={previewChecked}
                      onToggle={() => setPreviewChecked((c) => !c)}
                    />
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
