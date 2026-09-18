"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Copy, Loader2 } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import type { PaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentSkin } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ImageUploadField } from "@/components/payments/image-upload-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Step = "basics" | "price" | "appearance" | "success"
const STEPS: Step[] = ["basics", "price", "appearance"]

/**
 * "Crear producto" — a 3-step wizard (Datos básicos → Precio →
 * Apariencia) that ends by generating a live payment link, mirroring
 * Hotmart's own product-creation flow with everything not relevant
 * to this CRM stripped out (Club, affiliate marketplace, email
 * marketing, external review). Two API calls do the actual work:
 * `POST /api/payments/products` (basics) then `POST
 * /api/payments/products/[id]/prices` with `publish: true` (price +
 * instant link) — the wizard is purely a guided front end over the
 * same product/price resources the detail page manages.
 */
export function CreateProductWizard({
  open,
  onOpenChange,
  onDone,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: (productId: string) => void
  t: PaymentsT
}) {
  const { defaultCurrency } = useAuth()

  const [step, setStep] = useState<Step>("basics")
  const [name, setName] = useState("")
  const [author, setAuthor] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [priceName, setPriceName] = useState("")
  const [amount, setAmount] = useState("")
  const [skinId, setSkinId] = useState("")
  const [skins, setSkins] = useState<PaymentSkin[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setStep("basics")
    setName("")
    setAuthor("")
    setDescription("")
    setImageUrl("")
    setPriceName("")
    setAmount("")
    setSkinId("")
    setCreatedProductId(null)
    setLink(null)
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return
    fetch("/api/payments/skins")
      .then((r) => r.json())
      .then((d) => setSkins(d.skins ?? []))
      .catch(() => setSkins([]))
  }, [open])

  const stepIndex = step === "success" ? STEPS.length : STEPS.indexOf(step)

  function canAdvance(): boolean {
    if (step === "basics") return name.trim().length > 0
    if (step === "price") return priceName.trim().length > 0 && Number(amount) > 0
    return true
  }

  function goNext() {
    if (!canAdvance()) return
    if (step === "basics") setStep("price")
    else if (step === "price") setStep("appearance")
  }

  function goBack() {
    if (step === "price") setStep("basics")
    else if (step === "appearance") setStep("price")
  }

  async function handleFinish() {
    setSubmitting(true)
    const productRes = await fetch("/api/payments/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        author: author.trim() || null,
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        default_skin_id: skinId || null,
      }),
    })
    const productData = await productRes.json().catch(() => ({}))
    if (!productRes.ok) {
      setSubmitting(false)
      toast.error(productData.error || t("wizard.createFailed"))
      return
    }
    const productId = productData.product.id as string

    const priceRes = await fetch(`/api/payments/products/${productId}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: priceName.trim(), amount: Number(amount), publish: true }),
    })
    const priceData = await priceRes.json().catch(() => ({}))
    setSubmitting(false)
    if (!priceRes.ok) {
      toast.error(priceData.error || t("wizard.priceFailed"))
      // The product itself was created successfully — let the merchant
      // finish setting a price from the detail page rather than
      // stranding them on a dead-end error with no way forward.
      setCreatedProductId(productId)
      onDone(productId)
      return
    }

    setCreatedProductId(productId)
    setLink(`${window.location.origin}${priceData.url}`)
    setStep("success")
  }

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).catch(() => {})
    toast.success(t("wizard.linkCopied"))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("wizard.title")}</DialogTitle>
          {step !== "success" && (
            <DialogDescription>
              <span className="inline-flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    <span
                      className={`flex size-5 items-center justify-center rounded-full text-xs font-medium ${
                        i <= stepIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i < stepIndex ? <Check className="size-3" /> : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
                  </span>
                ))}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "basics" && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("wizard.nameLabel")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("wizard.namePlaceholder")}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("wizard.authorLabel")}</Label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t("wizard.authorPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("wizard.descriptionLabel")}</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("wizard.descriptionPlaceholder")}
              />
            </div>
            <ImageUploadField
              label={t("wizard.imageUrlLabel")}
              value={imageUrl}
              onChange={setImageUrl}
              maxWidth={600}
              maxHeight={600}
              t={t}
            />
          </div>
        )}

        {step === "price" && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("wizard.priceNameLabel")}</Label>
              <Input
                value={priceName}
                onChange={(e) => setPriceName(e.target.value)}
                placeholder={t("wizard.priceNamePlaceholder")}
                autoFocus
              />
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <Label className="text-muted-foreground">{t("wizard.amountLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Badge variant="outline">{defaultCurrency}</Badge>
              </div>
            </div>
          </div>
        )}

        {step === "appearance" && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("wizard.appearanceLabel")}</Label>
              <select
                value={skinId}
                onChange={(e) => setSkinId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">{t("wizard.appearanceNone")}</option>
                {skins.map((skin) => (
                  <option key={skin.id} value={skin.id}>
                    {skin.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("wizard.appearanceHint")}</p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("wizard.successTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("wizard.successDesc")}</p>
            <div className="flex w-full items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-sm">
                {link}
              </code>
              <Button variant="outline" size="icon-sm" onClick={copyLink} aria-label={t("wizard.copyLink")}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "success" ? (
            <Button
              onClick={() => createdProductId && onDone(createdProductId)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("wizard.done")}
            </Button>
          ) : (
            <>
              {step !== "basics" && (
                <Button variant="outline" onClick={goBack} disabled={submitting}>
                  {t("wizard.back")}
                </Button>
              )}
              {step === "appearance" ? (
                <Button
                  onClick={handleFinish}
                  disabled={submitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? t("wizard.finishing") : t("wizard.finish")}
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  disabled={!canAdvance()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t("wizard.next")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
