"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import type { PaymentForm, PaymentFormDesign, PaymentSkin } from "@/types"
import type { PaymentsT } from "@/hooks/use-payments-locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DEFAULT_ACCENT = "#16a34a"

/**
 * Create/edit dialog for a "Payment Skin" (migration 053) — a
 * reusable checkout design, plus the checklist of payment forms it
 * should apply to. Saving does both in one round trip: `POST
 * /api/payments/skins` (create) or `PUT /api/payments/skins/[id]`
 * (edit), each accepting `{ name, design, form_ids }`.
 */
export function SkinEditorDialog({
  open,
  onOpenChange,
  skin,
  forms,
  onSaved,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null = create mode. */
  skin: PaymentSkin | null
  /** Every non-archived payment form for this account. */
  forms: PaymentForm[]
  onSaved: () => void
  t: PaymentsT
}) {
  const [name, setName] = useState("")
  const [design, setDesign] = useState<PaymentFormDesign>({})
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Reset local state from the skin/forms props whenever the dialog
  // opens — legitimate prop-driven sync (same pattern as
  // `src/components/pipelines/pipeline-settings.tsx`).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setName(skin?.name ?? "")
    setDesign(skin?.design ?? {})
    setSelectedFormIds(
      new Set(skin ? forms.filter((f) => f.skin_id === skin.id).map((f) => f.id) : []),
    )
  }, [open, skin, forms])
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleForm(formId: string) {
    setSelectedFormIds((current) => {
      const next = new Set(current)
      if (next.has(formId)) next.delete(formId)
      else next.add(formId)
      return next
    })
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    const body = JSON.stringify({ name: trimmed, design, form_ids: [...selectedFormIds] })
    const res = skin
      ? await fetch(`/api/payments/skins/${skin.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
      : await fetch("/api/payments/skins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || (skin ? t("saveFailed") : t("createFailed")))
      return
    }
    toast.success(skin ? t("saveSuccess") : t("createSuccess"))
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{skin ? t("editTitle") : t("newSkin")}</DialogTitle>
          <DialogDescription>{t("dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("nameLabel")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("accentColorLabel")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={design.accent_color || DEFAULT_ACCENT}
                onChange={(e) => setDesign((d) => ({ ...d, accent_color: e.target.value }))}
                className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input
                value={design.accent_color || ""}
                onChange={(e) => setDesign((d) => ({ ...d, accent_color: e.target.value }))}
                placeholder={DEFAULT_ACCENT}
                className="w-32"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("logoUrlLabel")}</Label>
            <Input
              type="url"
              value={design.logo_url || ""}
              onChange={(e) =>
                setDesign((d) => ({ ...d, logo_url: e.target.value || undefined }))
              }
              placeholder="https://…/logo.png"
            />
            {design.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.logo_url}
                alt=""
                className="mt-1 h-10 w-auto rounded border border-border object-contain p-1"
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("formsLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("formsHint")}</p>
            {forms.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {t("formsEmpty")}
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {forms.map((form) => {
                  const usedByOther = !!form.skin_id && form.skin_id !== skin?.id
                  return (
                    <label
                      key={form.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 text-foreground">
                        <Checkbox
                          checked={selectedFormIds.has(form.id)}
                          onCheckedChange={() => toggleForm(form.id)}
                          aria-label={form.name}
                        />
                        {form.name}
                      </span>
                      {usedByOther && (
                        <span className="text-xs text-muted-foreground">{t("formsReassignHint")}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {skin ? t("save") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
