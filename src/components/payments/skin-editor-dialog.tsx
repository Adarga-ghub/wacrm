"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Eye, Loader2 } from "lucide-react"

import type {
  PaymentForm,
  PaymentFormDesign,
  PaymentPageBackground,
  PaymentPageTopSection,
  PaymentSkin,
} from "@/types"
import { usePaymentsLocale, type PaymentsT } from "@/hooks/use-payments-locale"
import { buildSkinPreviewUrl } from "@/lib/payments/skin-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ImageUploadField } from "@/components/payments/image-upload-field"
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
  const { locale } = usePaymentsLocale()
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

  function updateBackground(patch: Partial<PaymentPageBackground>) {
    setDesign((d) => ({ ...d, background: { ...d.background, ...patch } }))
  }

  function updateTopSection(patch: Partial<PaymentPageTopSection>) {
    setDesign((d) => ({ ...d, top_section: { ...d.top_section, ...patch } }))
  }

  function toggleForm(formId: string) {
    setSelectedFormIds((current) => {
      const next = new Set(current)
      if (next.has(formId)) next.delete(formId)
      else next.add(formId)
      return next
    })
  }

  function handlePreview() {
    window.open(buildSkinPreviewUrl(design, locale), "_blank", "noopener,noreferrer")
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    // Strips any leftover title/subtitle/product_image_url a skin saved
    // before those moved to the linked Producto (migration 054/056) —
    // the renderer already ignores them, this just keeps the stored
    // jsonb from re-saving stale fields the editor no longer shows.
    const cleanDesign: PaymentFormDesign = {
      ...design,
      top_section: design.top_section?.banner_image_url
        ? { banner_image_url: design.top_section.banner_image_url }
        : undefined,
    }
    const body = JSON.stringify({ name: trimmed, design: cleanDesign, form_ids: [...selectedFormIds] })
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

          <ImageUploadField
            label={t("logoUrlLabel")}
            value={design.logo_url || ""}
            onChange={(url) => setDesign((d) => ({ ...d, logo_url: url || undefined }))}
            maxWidth={200}
            maxHeight={200}
            t={t}
          />

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("backgroundTitle")}</Label>
            <div className="flex gap-2">
              {(["color", "image"] as const).map((tab) => {
                const active = (design.background?.type ?? "color") === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => updateBackground({ type: tab })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab === "color" ? t("backgroundColorTab") : t("backgroundImageTab")}
                  </button>
                )
              })}
            </div>
            {(design.background?.type ?? "color") === "color" ? (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.background?.color || "#f8fafc"}
                  onChange={(e) => updateBackground({ color: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
                />
                <Input
                  value={design.background?.color || ""}
                  onChange={(e) => updateBackground({ color: e.target.value })}
                  placeholder="#f8fafc"
                  className="w-32"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <ImageUploadField
                  label={t("backgroundImageLabel")}
                  value={design.background?.image_url || ""}
                  onChange={(url) => updateBackground({ image_url: url || undefined })}
                  maxWidth={1920}
                  maxHeight={1080}
                  t={t}
                />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Checkbox
                      checked={!!design.background?.fill}
                      onCheckedChange={(v) => updateBackground({ fill: v === true })}
                    />
                    {t("backgroundFillLabel")}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Checkbox
                      checked={!!design.background?.repeat}
                      onCheckedChange={(v) => updateBackground({ repeat: v === true })}
                    />
                    {t("backgroundRepeatLabel")}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Checkbox
                      checked={!!design.background?.fixed}
                      onCheckedChange={(v) => updateBackground({ fixed: v === true })}
                    />
                    {t("backgroundFixedLabel")}
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border border-border p-3">
            <Label className="text-muted-foreground">{t("topSectionTitle")}</Label>
            <p className="-mt-2 text-xs text-muted-foreground">{t("topSectionHint")}</p>

            <ImageUploadField
              label={t("bannerImageLabel")}
              value={design.top_section?.banner_image_url || ""}
              onChange={(url) => updateTopSection({ banner_image_url: url || undefined })}
              maxWidth={1200}
              maxHeight={400}
              t={t}
            />
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
          <Button variant="outline" onClick={handlePreview} className="mr-auto">
            <Eye className="h-4 w-4" />
            {t("preview")}
          </Button>
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
