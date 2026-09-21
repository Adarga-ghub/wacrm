"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Copy, ExternalLink, Loader2, MoreVertical, Pencil, Plus } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentForm, PaymentProduct, PaymentSkin } from "@/types"
import { PAYMENT_CURRENCY_CODES, formatPaymentAmount } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"
import { PaymentCurrencySelect } from "@/components/payments/payment-currency-select"

const STATUS_BADGE: Record<PaymentProduct["status"], string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = usePaymentsT("products")
  const { defaultCurrency } = useAuth()

  const [product, setProduct] = useState<PaymentProduct | null>(null)
  const [prices, setPrices] = useState<PaymentForm[]>([])
  const [skins, setSkins] = useState<PaymentSkin[]>([])
  const [saving, setSaving] = useState(false)

  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [priceName, setPriceName] = useState("")
  const [priceAmount, setPriceAmount] = useState("")
  const [priceCurrency, setPriceCurrency] = useState("USD")
  const [priceCheckoutDescription, setPriceCheckoutDescription] = useState("")
  const [publishNow, setPublishNow] = useState(true)
  const [creatingPrice, setCreatingPrice] = useState(false)

  // "Editar precio" — the Products-panel side of bidirectional price
  // editing (the other side is the Payment tab in the full form
  // editor, `/payments/forms/[id]/edit`). Both write the same
  // `payment_forms` row via the same PUT endpoint, so there's no
  // separate "sync" step — whichever one saves last is simply what
  // `/pay/[slug]` reads next.
  const [editingPrice, setEditingPrice] = useState<PaymentForm | null>(null)
  const [editPriceName, setEditPriceName] = useState("")
  const [editPriceAmount, setEditPriceAmount] = useState("")
  const [editPriceCurrency, setEditPriceCurrency] = useState("USD")
  const [editPriceCheckoutDescription, setEditPriceCheckoutDescription] = useState("")
  const [savingPrice, setSavingPrice] = useState(false)

  async function load() {
    const res = await fetch(`/api/payments/products/${id}`)
    if (!res.ok) {
      toast.error(t("detail.loadFailed"))
      return
    }
    const data = await res.json()
    setProduct(data.product)
    setPrices(data.prices ?? [])
  }

  useEffect(() => {
    // Same "fetch on mount" shape as the rest of this module — see
    // the matching comment in `payments/page.tsx`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetch("/api/payments/skins")
      .then((r) => r.json())
      .then((d) => setSkins(d.skins ?? []))
      .catch(() => setSkins([]))
  }, [])

  function update<K extends keyof PaymentProduct>(key: K, value: PaymentProduct[K]) {
    setProduct((p) => (p ? { ...p, [key]: value } : p))
  }

  async function handleSave() {
    if (!product) return
    setSaving(true)
    const res = await fetch(`/api/payments/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name,
        author: product.author,
        description: product.description,
        image_url: product.image_url,
        default_skin_id: product.default_skin_id,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || t("detail.saveFailed"))
      return
    }
    setProduct(data.product)
    toast.success(t("detail.saveSuccess"))
  }

  function resetPriceDialog() {
    setPriceName("")
    setPriceAmount("")
    setPriceCurrency(PAYMENT_CURRENCY_CODES.includes(defaultCurrency) ? defaultCurrency : "USD")
    setPriceCheckoutDescription("")
    setPublishNow(true)
  }

  async function handleCreatePrice() {
    if (!product) return
    setCreatingPrice(true)
    const res = await fetch(`/api/payments/products/${product.id}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: priceName.trim(),
        amount: Number(priceAmount),
        currency: priceCurrency,
        checkout_description: priceCheckoutDescription.trim() || undefined,
        publish: publishNow,
      }),
    })
    const data = await res.json()
    setCreatingPrice(false)
    if (!res.ok) {
      toast.error(data.error || t("detail.createFailed"))
      return
    }
    if (data.url) {
      const fullUrl = `${window.location.origin}${data.url}`
      await navigator.clipboard.writeText(fullUrl).catch(() => {})
      toast.success(t("detail.linkCopied"))
    }
    setPriceDialogOpen(false)
    resetPriceDialog()
    load()
  }

  function copyPriceLink(slug: string) {
    const url = `${window.location.origin}/pay/${slug}`
    navigator.clipboard.writeText(url).catch(() => {})
    toast.success(t("detail.linkCopied"))
  }

  function openEditPrice(price: PaymentForm) {
    setEditingPrice(price)
    setEditPriceName(price.name)
    setEditPriceAmount(String(price.amount ?? ""))
    setEditPriceCurrency(price.currency)
    setEditPriceCheckoutDescription(price.checkout_description ?? "")
  }

  async function handleSavePrice() {
    if (!editingPrice) return
    setSavingPrice(true)
    const res = await fetch(`/api/payments/forms/${editingPrice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editPriceName.trim(),
        amount: Number(editPriceAmount),
        currency: editPriceCurrency,
        checkout_description: editPriceCheckoutDescription.trim() || null,
      }),
    })
    const data = await res.json()
    setSavingPrice(false)
    if (!res.ok) {
      toast.error(data.error || t("detail.editFailed"))
      return
    }
    toast.success(t("detail.editSuccess"))
    setEditingPrice(null)
    load()
  }

  if (!product) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/payments/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={product.name}
            onChange={(e) => update("name", e.target.value)}
            className="h-auto border-none bg-transparent px-0 text-2xl font-bold text-foreground shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className={STATUS_BADGE[product.status]}>
              {t(`status.${product.status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PaymentsLanguageToggle />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("detail.save")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("detail.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("detail.tabPricing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("wizard.authorLabel")}</Label>
                <Input
                  value={product.author ?? ""}
                  onChange={(e) => update("author", e.target.value || null)}
                  placeholder={t("wizard.authorPlaceholder")}
                  className="sm:max-w-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.descriptionLabel")}</Label>
                <Textarea
                  rows={3}
                  value={product.description ?? ""}
                  onChange={(e) => update("description", e.target.value || null)}
                  placeholder={t("detail.descriptionPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.imageUrlLabel")}</Label>
                <Input
                  type="url"
                  value={product.image_url ?? ""}
                  onChange={(e) => update("image_url", e.target.value || null)}
                  placeholder="https://…/portada.png"
                />
                {product.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt=""
                    className="mt-1 h-20 w-auto rounded border border-border object-cover"
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.appearanceLabel")}</Label>
                <select
                  value={product.default_skin_id ?? ""}
                  onChange={(e) => update("default_skin_id", e.target.value || null)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:max-w-xs"
                >
                  <option value="">{t("detail.appearanceNone")}</option>
                  {skins.map((skin) => (
                    <option key={skin.id} value={skin.id}>
                      {skin.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 space-y-4">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              onClick={() => {
                resetPriceDialog()
                setPriceDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {t("detail.addPrice")}
            </Button>
          </div>

          {prices.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
              {t("detail.noPrices")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">{t("detail.table.name")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("detail.table.value")}</TableHead>
                    <TableHead className="hidden text-muted-foreground sm:table-cell">
                      {t("detail.table.code")}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((price) => (
                    <TableRow key={price.id} className="border-border hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/payments/forms/${price.id}/edit`}
                            className="truncate font-medium text-foreground hover:underline"
                          >
                            {price.name}
                          </Link>
                          <Badge
                            variant="outline"
                            className={
                              price.status === "published"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-500/30 bg-slate-500/10 text-muted-foreground"
                            }
                          >
                            {price.status === "published"
                              ? t("detail.priceStatus.published")
                              : t("detail.priceStatus.draft")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPaymentAmount(price.amount ?? 0, price.currency)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <code className="truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs">
                          /pay/{price.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={t("detail.actions.menu")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPrice(price)}>
                              <Pencil className="h-4 w-4" />
                              {t("detail.actions.edit")}
                            </DropdownMenuItem>
                            {price.status === "published" && (
                              <>
                                <DropdownMenuItem onClick={() => copyPriceLink(price.slug)}>
                                  <Copy className="h-4 w-4" />
                                  {t("detail.actions.copyLink")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  render={
                                    <a href={`/pay/${price.slug}`} target="_blank" rel="noreferrer" />
                                  }
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  {t("detail.actions.viewLink")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.addPrice")}</DialogTitle>
            <DialogDescription>{t("detail.publishHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("detail.priceNameLabel")}</Label>
              <Input
                value={priceName}
                onChange={(e) => setPriceName(e.target.value)}
                placeholder={t("detail.priceNamePlaceholder")}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.amountLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.currencyLabel")}</Label>
                <PaymentCurrencySelect
                  value={priceCurrency}
                  onChange={setPriceCurrency}
                  warningText={t("detail.currencyWarning")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("detail.checkoutDescriptionLabel")}</Label>
              <Textarea
                rows={2}
                value={priceCheckoutDescription}
                onChange={(e) => setPriceCheckoutDescription(e.target.value)}
                placeholder={t("detail.checkoutDescriptionPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("detail.checkoutDescriptionHint")}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{t("detail.publishNow")}</p>
              <Switch checked={publishNow} onCheckedChange={(v) => setPublishNow(!!v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreatePrice}
              disabled={creatingPrice || !priceName.trim() || !(Number(priceAmount) > 0)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creatingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {creatingPrice ? t("detail.creating") : t("detail.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPrice} onOpenChange={(v) => !v && setEditingPrice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.editPrice")}</DialogTitle>
            <DialogDescription>{t("detail.editPriceHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("detail.priceNameLabel")}</Label>
              <Input
                value={editPriceName}
                onChange={(e) => setEditPriceName(e.target.value)}
                placeholder={t("detail.priceNamePlaceholder")}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.amountLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPriceAmount}
                  onChange={(e) => setEditPriceAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("detail.currencyLabel")}</Label>
                <PaymentCurrencySelect
                  value={editPriceCurrency}
                  onChange={setEditPriceCurrency}
                  warningText={t("detail.currencyWarning")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("detail.checkoutDescriptionLabel")}</Label>
              <Textarea
                rows={2}
                value={editPriceCheckoutDescription}
                onChange={(e) => setEditPriceCheckoutDescription(e.target.value)}
                placeholder={t("detail.checkoutDescriptionPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("detail.checkoutDescriptionHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPrice(null)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSavePrice}
              disabled={savingPrice || !editPriceName.trim() || !(Number(editPriceAmount) > 0)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingPrice ? t("detail.saving") : t("detail.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
