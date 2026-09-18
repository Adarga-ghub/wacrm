"use client"

import Link from "next/link"
import { CreditCard, Package, Palette, Receipt, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ReorderableHeaderActions,
  type ReorderableAction,
} from "@/components/payments/reorderable-header-actions"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"
import { usePaymentsT } from "@/hooks/use-payments-locale"

export default function PaymentsPage() {
  const t = usePaymentsT("list")

  // Each pill is independently draggable (see
  // `ReorderableHeaderActions`) — order is a per-device preference,
  // not app state, so it's fine to rebuild this array every render.
  // Prices are now created and managed exclusively inside a Product's
  // own "Fijación de precios y ofertas" tab, so this hub no longer
  // lists loose payment forms — it's just direct access to the four
  // sections that make up Billing & Payments.
  const headerActions: ReorderableAction[] = [
    {
      id: "products",
      content: (
        <Button variant="outline" render={<Link href="/payments/products" />}>
          <Package className="h-4 w-4" />
          {t("products")}
        </Button>
      ),
    },
    {
      id: "skins",
      content: (
        <Button variant="outline" render={<Link href="/payments/skins" />}>
          <Palette className="h-4 w-4" />
          {t("skins")}
        </Button>
      ),
    },
    {
      id: "gateway",
      content: (
        <Button variant="outline" render={<Link href="/payments/settings" />}>
          <Settings className="h-4 w-4" />
          {t("configureGateway")}
        </Button>
      ),
    },
    {
      id: "transactions",
      content: (
        <Button variant="outline" render={<Link href="/payments/transactions" />}>
          <Receipt className="h-4 w-4" />
          {t("transactions")}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentsLanguageToggle />
          <ReorderableHeaderActions storageKey="wacrm:payments-header-order" actions={headerActions} />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("hubTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("hubDesc")}</p>
      </div>
    </div>
  )
}
