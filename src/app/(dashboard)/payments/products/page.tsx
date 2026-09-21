"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ImageOff, Loader2, MoreVertical, Package, Pencil, Trash2 } from "lucide-react"

import { useCan } from "@/hooks/use-can"
import { BackLink } from "@/components/layout/back-link"
import type { PaymentForm, PaymentProduct } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Badge } from "@/components/ui/badge"
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
import { CreateProductWizard } from "@/components/payments/create-product-wizard"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"
import { usePaymentsT } from "@/hooks/use-payments-locale"

const STATUS_BADGE: Record<PaymentProduct["status"], string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
}

export default function PaymentProductsPage() {
  const router = useRouter()
  const t = usePaymentsT("products")
  const canManage = useCan("send-messages")

  const [products, setProducts] = useState<PaymentProduct[] | null>(null)
  const [forms, setForms] = useState<PaymentForm[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pendingArchive, setPendingArchive] = useState<PaymentProduct | null>(null)
  const [archiving, setArchiving] = useState(false)

  async function load() {
    const [productsRes, formsRes] = await Promise.all([
      fetch("/api/payments/products"),
      fetch("/api/payments/forms"),
    ])
    if (!productsRes.ok) {
      toast.error(t("loadFailed"))
      setProducts([])
    } else {
      const data = await productsRes.json()
      setProducts(data.products ?? [])
    }
    if (formsRes.ok) {
      const data = await formsRes.json()
      setForms(data.forms ?? [])
    }
  }

  // Same "fetch on mount" shape as the rest of this module's list
  // pages (see the matching comment in `payments/page.tsx`).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  async function handleArchive() {
    if (!pendingArchive) return
    setArchiving(true)
    const res = await fetch(`/api/payments/products/${pendingArchive.id}`, { method: "DELETE" })
    setArchiving(false)
    setPendingArchive(null)
    if (!res.ok) {
      toast.error(t("archiveFailed"))
      return
    }
    toast.success(t("archiveSuccess"))
    load()
  }

  function handleWizardDone(productId: string) {
    setWizardOpen(false)
    load()
    router.push(`/payments/products/${productId}`)
  }

  const priceCountByProduct = new Map<string, number>()
  for (const form of forms) {
    if (!form.product_id) continue
    priceCountByProduct.set(form.product_id, (priceCountByProduct.get(form.product_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <BackLink
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </BackLink>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentsLanguageToggle />
          <GatedButton
            canAct={canManage}
            gateReason="create products"
            onClick={() => setWizardOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Package className="h-4 w-4" />
            {t("newProduct")}
          </GatedButton>
        </div>
      </div>

      {products === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t("table.name")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.status")}</TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">
                  {t("table.prices")}
                </TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">
                  {t("table.created")}
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer border-border hover:bg-muted/50"
                  onClick={() => router.push(`/payments/products/${product.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageOff className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      {product.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[product.status]}>
                      {t(`status.${product.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {t("table.pricesCount", { count: priceCountByProduct.get(product.id) ?? 0 })}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(product.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={t("actions.menu")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/payments/products/${product.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingArchive(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("actions.archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProductWizard open={wizardOpen} onOpenChange={setWizardOpen} onDone={handleWizardDone} t={t} />

      <Dialog open={!!pendingArchive} onOpenChange={(v) => !v && setPendingArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveTitle")}</DialogTitle>
            <DialogDescription>
              {t("archiveDesc", { name: pendingArchive?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={archiving} onClick={handleArchive}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("actions.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
