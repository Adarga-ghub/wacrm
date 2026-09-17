"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react"

import type { Automation, PaymentForm, PaymentFormField } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { ShareTab } from "@/components/payments/share-tab"
import { ProductListEditor } from "@/components/payments/product-list-editor"
import { DesignTab } from "@/components/payments/design-tab"

const FIELD_TYPES: PaymentFormField["type"][] = ["text", "email", "textarea"]

export default function EditPaymentFormPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations("Payments.editor")

  const [form, setForm] = useState<PaymentForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [automations, setAutomations] = useState<Automation[] | null>(null)

  async function load() {
    const res = await fetch(`/api/payments/forms/${id}`)
    if (!res.ok) {
      toast.error(t("loadFailed"))
      return
    }
    const data = await res.json()
    setForm(data.form)
  }

  useEffect(() => {
    // `load` fetches then setState-s — the standard "fetch on mount"
    // shape used across this codebase's list/detail pages (e.g.
    // `src/app/(dashboard)/automations/page.tsx`); the stricter
    // set-state-in-effect check flags it here over `load`'s
    // early-return branch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [id])

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((d) => setAutomations(d.automations ?? []))
      .catch(() => setAutomations([]))
  }, [])

  function update<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    const res = await fetch(`/api/payments/forms/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        fields: form.fields,
        amount_type: form.amount_type,
        amount: form.amount,
        min_amount: form.min_amount,
        products: form.products,
        automation_id: form.automation_id,
        send_automation_default: form.send_automation_default,
        redirect_url: form.redirect_url,
        inline_success_message: form.inline_success_message,
        submission_limit: form.submission_limit,
        design: form.design,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error || t("saveFailed"))
      return
    }
    setForm(data.form)
    toast.success(t("saveSuccess"))
  }

  async function togglePublish() {
    if (!form) return
    const nextStatus = form.status === "published" ? "draft" : "published"
    const res = await fetch(`/api/payments/forms/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || t("saveFailed"))
      return
    }
    setForm(data.form)
    toast.success(nextStatus === "published" ? t("publishSuccess") : t("unpublishSuccess"))
  }

  if (!form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const paymentAutomations = (automations ?? []).filter(
    (a) => a.trigger_type === "payment_received",
  )

  return (
    <div className="space-y-6">
      <Link
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="h-auto border-none bg-transparent px-0 text-2xl font-bold text-foreground shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge
              variant="outline"
              className={
                form.status === "published"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-500/30 bg-slate-500/10 text-muted-foreground"
              }
            >
              {t(`status.${form.status}`)}
            </Badge>
            {form.status === "published" && (
              <a
                href={`/pay/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                /pay/{form.slug}
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={togglePublish}>
            {form.status === "published" ? t("unpublish") : t("publish")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">{t("tabs.fields")}</TabsTrigger>
          <TabsTrigger value="payment">{t("tabs.payment")}</TabsTrigger>
          <TabsTrigger value="automation">{t("tabs.automation")}</TabsTrigger>
          <TabsTrigger value="behaviour">{t("tabs.behaviour")}</TabsTrigger>
          <TabsTrigger value="share">{t("tabs.share")}</TabsTrigger>
          <TabsTrigger value="design">{t("tabs.design")}</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4">
          <FieldsTab
            fields={form.fields}
            onChange={(fields) => update("fields", fields)}
            t={t}
          />
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                {(["fixed", "variable", "product_list"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update("amount_type", type)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.amount_type === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(`amountType.${type}`)}
                  </button>
                ))}
              </div>

              {form.amount_type === "fixed" && (
                <div className="grid gap-2 sm:max-w-xs">
                  <Label className="text-muted-foreground">{t("amountLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount ?? ""}
                      onChange={(e) =>
                        update("amount", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                    <Badge variant="outline">{form.currency}</Badge>
                  </div>
                </div>
              )}

              {form.amount_type === "variable" && (
                <div className="grid gap-2 sm:max-w-xs">
                  <Label className="text-muted-foreground">{t("minAmountLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.min_amount ?? ""}
                      onChange={(e) =>
                        update("min_amount", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                    <Badge variant="outline">{form.currency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("minAmountHint")}</p>
                </div>
              )}

              {form.amount_type === "product_list" && (
                <ProductListEditor
                  products={form.products ?? []}
                  currency={form.currency}
                  onChange={(products) => update("products", products)}
                  t={t}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-4">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("automationLabel")}</Label>
                <select
                  value={form.automation_id ?? ""}
                  onChange={(e) => update("automation_id", e.target.value || null)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t("automationNone")}</option>
                  {paymentAutomations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {automations !== null && paymentAutomations.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("automationEmptyHint")}{" "}
                    <Link
                      href="/automations/new?trigger=payment_received"
                      className="text-primary hover:underline"
                    >
                      {t("automationCreate")}
                    </Link>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("sendAutomationDefaultLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("sendAutomationDefaultHint")}
                  </p>
                </div>
                <Switch
                  checked={form.send_automation_default}
                  onCheckedChange={(v) => update("send_automation_default", !!v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behaviour" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("redirectLabel")}</Label>
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.redirect_url ?? ""}
                  onChange={(e) => update("redirect_url", e.target.value || null)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("inlineMessageLabel")}</Label>
                <Textarea
                  rows={3}
                  placeholder={t("inlineMessagePlaceholder")}
                  value={form.inline_success_message ?? ""}
                  onChange={(e) => update("inline_success_message", e.target.value || null)}
                />
                <p className="text-xs text-muted-foreground">{t("inlineMessageHint")}</p>
              </div>
              <div className="grid gap-2 sm:max-w-xs">
                <Label className="text-muted-foreground">{t("limitLabel")}</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder={t("limitPlaceholder")}
                  value={form.submission_limit ?? ""}
                  onChange={(e) =>
                    update("submission_limit", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="share" className="mt-4">
          <ShareTab
            formId={form.id}
            formSlug={form.slug}
            sendAutomationDefault={form.send_automation_default}
          />
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <DesignTab design={form.design} onChange={(design) => update("design", design)} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FieldsTab({
  fields,
  onChange,
  t,
}: {
  fields: PaymentFormField[]
  onChange: (fields: PaymentFormField[]) => void
  t: ReturnType<typeof useTranslations>
}) {
  function updateField(id: string, patch: Partial<PaymentFormField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id))
  }

  function addField() {
    onChange([
      ...fields,
      { id: `custom_${Date.now()}`, type: "text", label: "", required: false },
    ])
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
          >
            <Input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              placeholder={t("fieldLabelPlaceholder")}
              disabled={field.locked}
              className="min-w-40 flex-1"
            />
            {field.locked ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" />
                WhatsApp
              </Badge>
            ) : (
              <select
                value={field.type}
                onChange={(e) =>
                  updateField(field.id, { type: e.target.value as PaymentFormField["type"] })
                }
                className="h-8 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none"
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`fieldType.${type}`)}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={field.required}
                disabled={field.locked}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                className="size-4 rounded border-border"
              />
              {t("fieldRequired")}
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={field.locked}
              onClick={() => removeField(field.id)}
              aria-label={t("fieldRemove")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button variant="outline" onClick={addField}>
          <Plus className="h-4 w-4" />
          {t("fieldAdd")}
        </Button>
      </CardContent>
    </Card>
  )
}
