"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Eye, EyeOff, Loader2, Minus, Plus } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WhopPayButton } from "@/components/payments/whop-pay-button"
import {
  DEFAULT_WHOP_BUTTON_STYLE,
  WHOP_BUTTON_FONTS,
  WHOP_BUTTON_LIMITS,
  normalizeWhopButtonStyle,
  type WhopButtonFont,
  type WhopButtonStyle,
} from "@/lib/payments/whop-button-style"

type SizeKey = keyof typeof WHOP_BUTTON_LIMITS
type ColorKey = "backgroundColor" | "textColor" | "borderColor"

/** "Button appearance" card, under Whop's: edits the design buyers see once saved. */
export function WhopButtonEditor() {
  const { canEditSettings, profileLoading } = useAuth()
  const t = useTranslations("Payments.whopButton")

  const [draft, setDraft] = useState<WhopButtonStyle>(DEFAULT_WHOP_BUTTON_STYLE)
  const [saved, setSaved] = useState<WhopButtonStyle>(DEFAULT_WHOP_BUTTON_STYLE)
  const [connected, setConnected] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/payments/whop/config")
      .then((res) => res.json())
      .then((data) => {
        const style = normalizeWhopButtonStyle(data.button_style)
        setDraft(style)
        setSaved(style)
        setConnected(!!data.connected)
      })
      .catch(() => toast.error(t("loadFailed")))
  }, [t])

  const readOnly = !canEditSettings || profileLoading || !connected
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/payments/whop/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ button_style: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("saveFailed"))
        return
      }
      const style = normalizeWhopButtonStyle(data.button_style)
      setDraft(style)
      setSaved(style)
      toast.success(t("saveSuccess"))
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const sizeField = (key: SizeKey, label: string) => {
    const { min, max } = WHOP_BUTTON_LIMITS[key]
    const set = (value: number) =>
      setDraft((d) => ({ ...d, [key]: Math.min(max, Math.max(min, value)) }))
    return (
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground">{label}</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{draft[key]} px</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={readOnly || draft[key] <= min}
            aria-label={`${label} −`}
            onClick={() => set(draft[key] - 1)}
          >
            <Minus className="size-4" />
          </Button>
          <input
            type="range"
            min={min}
            max={max}
            value={draft[key]}
            disabled={readOnly}
            aria-label={label}
            onChange={(e) => set(Number(e.target.value))}
            className="w-full accent-primary disabled:opacity-50"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={readOnly || draft[key] >= max}
            aria-label={`${label} +`}
            onClick={() => set(draft[key] + 1)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  const colorField = (key: ColorKey, label: string) => (
    <div className="grid gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={draft[key]}
          disabled={readOnly}
          aria-label={label}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent disabled:cursor-not-allowed"
        />
        <Input
          value={draft[key]}
          disabled={readOnly}
          maxLength={7}
          aria-label={`${label} hex`}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          onBlur={() => setDraft((d) => ({ ...d, [key]: normalizeWhopButtonStyle(d)[key] }))}
        />
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">{t("title")}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {connected ? t("description") : t("connectFirst")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {sizeField("iconSize", t("iconSize"))}
          {sizeField("menuSize", t("menuSize"))}
          {sizeField("fontSize", t("fontSize"))}
          {sizeField("borderWidth", t("borderWidth"))}
        </div>

        <div className="grid gap-1.5">
          <Label className="text-muted-foreground" htmlFor="whop-button-font">
            {t("fontFamily")}
          </Label>
          <select
            id="whop-button-font"
            value={draft.fontFamily}
            disabled={readOnly}
            onChange={(e) => setDraft((d) => ({ ...d, fontFamily: e.target.value as WhopButtonFont }))}
            className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
          >
            {Object.entries(WHOP_BUTTON_FONTS).map(([value, font]) => (
              <option key={value} value={value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {colorField("backgroundColor", t("backgroundColor"))}
          {colorField("textColor", t("textColor"))}
          {colorField("borderColor", t("borderColor"))}
        </div>

        {previewOpen && (
          <div className="rounded-lg bg-white p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">{t("previewCaption")}</p>
            {/* Inert here: pressing it must not start a payment. */}
            <div className="pointer-events-none mx-auto max-w-[392px]">
              <WhopPayButton buttonStyle={normalizeWhopButtonStyle(draft)} label={t("buttonLabel")} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && (
            <Button
              onClick={handleSave}
              disabled={saving || readOnly || !dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setPreviewOpen((open) => !open)}>
            {previewOpen ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {previewOpen ? t("hidePreview") : t("preview")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={readOnly}
            onClick={() => setDraft(DEFAULT_WHOP_BUTTON_STYLE)}
          >
            {t("reset")}
          </Button>
          {dirty && <span className="text-xs text-amber-500">{t("unsaved")}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
