"use client"

import { Plus, Trash2 } from "lucide-react"
import type { useTranslations } from "next-intl"

import type { PaymentFormProduct } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Repeatable name+price rows for `amount_type: 'product_list'` — the
 * payer picks one on the public checkout page
 * (`src/app/pay/[slug]/page.tsx`), and its price is what
 * `POST /api/public/payments/orders` resolves server-side (never a
 * client-supplied amount, same rule as fixed/variable).
 */
export function ProductListEditor({
  products,
  currency,
  onChange,
  t,
}: {
  products: PaymentFormProduct[]
  currency: string
  onChange: (products: PaymentFormProduct[]) => void
  t: ReturnType<typeof useTranslations>
}) {
  function updateProduct(id: string, patch: Partial<PaymentFormProduct>) {
    onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function removeProduct(id: string) {
    onChange(products.filter((p) => p.id !== id))
  }

  function addProduct() {
    onChange([...products, { id: `product_${Date.now()}`, name: "", price: 0 }])
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
        >
          <Input
            value={product.name}
            onChange={(e) => updateProduct(product.id, { name: e.target.value })}
            placeholder={t("productNamePlaceholder")}
            className="min-w-40 flex-1"
          />
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={product.price}
              onChange={(e) => updateProduct(product.id, { price: Number(e.target.value) })}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">{currency}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => removeProduct(product.id)}
            aria-label={t("fieldRemove")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" onClick={addProduct}>
        <Plus className="h-4 w-4" />
        {t("productAdd")}
      </Button>
    </div>
  )
}
