"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import type {
  PaymentForm,
  PaymentFormDesign,
  PaymentPageBackground,
  PaymentPageTopSection,
  PaymentSkin,
} from "@/types"
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
                <Input
                  type="url"
                  value={design.background?.image_url || ""}
                  onChange={(e) => updateBackground({ image_url: e.target.value || undefined })}
                  placeholder="https://…/fondo.jpg"
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

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">{t("bannerImageLabel")}</Label>
              <Input
                type="url"
                value={design.top_section?.banner_image_url || ""}
                onChange={(e) =>
                  updateTopSection({ banner_image_url: e.target.value || undefined })
                }
                placeholder="https://…/banner.jpg"
              />
              {design.top_section?.banner_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={design.top_section.banner_image_url}
                  alt=""
                  className="h-20 w-full rounded border border-border object-cover"
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">{t("productImageLabel")}</Label>
              <Input
                type="url"
                value={design.top_section?.product_image_url || ""}
                onChange={(e) =>
                  updateTopSection({ product_image_url: e.target.value || undefined })
                }
                placeholder="https://…/producto.png"
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">{t("titleLabel")}</Label>
                <Input
                  value={design.top_section?.title || ""}
                  onChange={(e) => updateTopSection({ title: e.target.value || undefined })}
                  placeholder={t("titlePlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">{t("titleSizeLabel")}</Label>
                <select
                  value={design.top_section?.title_size ?? 36}
                  onChange={(e) => updateTopSection({ title_size: Number(e.target.value) })}
                  className="h-9 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none"
                >
                  {[20, 24, 28, 32, 36, 40, 48].map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">{t("subtitleLabel")}</Label>
                <Input
                  value={design.top_section?.subtitle || ""}
                  onChange={(e) => updateTopSection({ subtitle: e.target.value || undefined })}
                  placeholder={t("subtitlePlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">{t("subtitleSizeLabel")}</Label>
                <select
                  value={design.top_section?.subtitle_size ?? 24}
                  onChange={(e) => updateTopSection({ subtitle_size: Number(e.target.value) })}
                  className="h-9 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none"
                >
                  {[14, 16, 18, 20, 24, 28, 32].map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
