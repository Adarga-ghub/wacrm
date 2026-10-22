"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Info, Loader2, Wand2, X } from "lucide-react"

import { usePaymentsT } from "@/hooks/use-payments-locale"
import type { PaymentForm } from "@/types"
import { isValidSlug, slugify } from "@/lib/payments/slug"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SLUG_MAX = 80

/**
 * What the merchant types, turned into a valid slug as they go:
 * lowercase, no accents, anything else becomes one hyphen. A trailing
 * hyphen is kept while typing (the next word follows it) and trimmed
 * on save.
 */
function toSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
}

type Availability = "idle" | "checking" | "available" | "taken" | "invalid"

/**
 * "Editar enlace" — edits the last part of an offer's checkout link
 * (`/pay/[slug]`). The old link keeps working: it redirects to the new
 * one (migration 068, recorded by the PUT route).
 */
export function EditLinkDialog({
  offer,
  onOpenChange,
  onSaved,
}: {
  offer: PaymentForm | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = usePaymentsT("products")
  const [slug, setSlug] = useState("")
  const [availability, setAvailability] = useState<Availability>("idle")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!offer) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlug(offer.slug)
    setAvailability("idle")
  }, [offer])

  const finalSlug = slug.replace(/-+$/, "")
  const unchanged = !!offer && finalSlug === offer.slug

  // Debounced availability check while typing.
  useEffect(() => {
    if (!offer || unchanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailability("idle")
      return
    }
    if (!isValidSlug(finalSlug)) {
      setAvailability("invalid")
      return
    }
    setAvailability("checking")
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/payments/forms/slug-available?slug=${encodeURIComponent(finalSlug)}&form_id=${offer.id}`,
      ).catch(() => null)
      const data = res?.ok ? await res.json() : null
      if (cancelled) return
      if (!data) setAvailability("idle")
      else if (!data.valid) setAvailability("invalid")
      else setAvailability(data.available ? "available" : "taken")
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [offer, finalSlug, unchanged])

  async function handleSave() {
    if (!offer) return
    setSaving(true)
    const res = await fetch(`/api/payments/forms/${offer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: finalSlug }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      if (res.status === 409) setAvailability("taken")
      toast.error(res.status === 409 ? t("detail.link.taken") : data.error || t("detail.link.saveFailed"))
      return
    }
    toast.success(t("detail.link.saved"))
    onOpenChange(false)
    onSaved()
  }

  const origin = typeof window !== "undefined" ? window.location.host : ""
  // A failed live check ("idle") doesn't block saving — the PUT re-checks.
  const canSave =
    !!offer &&
    !unchanged &&
    !saving &&
    isValidSlug(finalSlug) &&
    availability !== "taken" &&
    availability !== "checking"

  return (
    <Dialog open={!!offer} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("detail.link.title")}</DialogTitle>
          <DialogDescription>{offer?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("detail.link.label")}</Label>
            <div className="flex min-w-0 items-center rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="shrink-0 border-r border-input py-2 pr-2 pl-3 font-mono text-xs text-muted-foreground">
                {origin}/pay/
              </span>
              <input
                value={slug}
                maxLength={SLUG_MAX}
                onChange={(e) => setSlug(toSlugInput(e.target.value))}
                onBlur={() => setSlug(finalSlug)}
                spellCheck={false}
                autoFocus
                className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-xs outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-h-4 text-xs">
                {availability === "checking" && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {t("detail.link.checking")}
                  </span>
                )}
                {availability === "available" && (
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <Check className="size-3" />
                    {t("detail.link.available")}
                  </span>
                )}
                {availability === "taken" && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <X className="size-3" />
                    {t("detail.link.taken")}
                  </span>
                )}
                {availability === "invalid" && (
                  <span className="text-destructive">{t("detail.link.invalid")}</span>
                )}
              </p>
              {offer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSlug(slugify(offer.name))}
                >
                  <Wand2 className="size-3.5" />
                  {t("detail.link.useName")}
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <p>{t("detail.link.redirectNote", { old: offer ? `/pay/${offer.slug}` : "" })}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("detail.link.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("detail.link.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
