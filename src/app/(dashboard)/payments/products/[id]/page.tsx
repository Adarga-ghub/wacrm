"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Copy, ExternalLink, Loader2, Plus } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentForm, PaymentProduct, PaymentSkin } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"

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
  const [publishNow, setPublishNow] = useState(true)
  const [creatingPrice, setCreatingPrice] = useState(false)

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

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("detail.pricesTitle")}</h2>
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
        <div className="space-y-2">
          {prices.map((price) => (
            <div
              key={price.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
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
                <p className="text-sm text-muted-foreground">
                  {price.amount} {price.currency}
                </p>
              </div>
              {price.status === "published" && (
                <div className="flex items-center gap-1">
                  <code className="hidden truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs sm:block">
                    /pay/{price.slug}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyPriceLink(price.slug)}
                    aria-label={t("detail.copyLink")}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={<a href={`/pay/${price.slug}`} target="_blank" rel="noreferrer" />}
                    aria-label={t("detail.viewLink")}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
            <div className="grid gap-2 sm:max-w-xs">
              <Label className="text-muted-foreground">{t("detail.amountLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
                <Badge variant="outline">{defaultCurrency}</Badge>
              </div>
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
    </div>
  )
}
