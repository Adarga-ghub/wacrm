"use client"

import type { PaymentFormDesign, PaymentPageUrgency } from "@/types"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import { CHECKOUT_TEXT_LIMITS, URGENCY_MAX_HOURS, urgencyDurationSeconds } from "@/lib/payments/checkout-limits"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/** "12/60" under a limited text input — turns amber near the limit. */
export function CharCounter({ value, max }: { value: string; max: number }) {
  const length = value.length
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        length >= max ? "font-medium text-amber-600" : "text-muted-foreground",
      )}
    >
      {length}/{max}
    </span>
  )
}

/**
 * Checkout header knobs shared by the skin editor and the form's
 * "Diseño" tab: logo on/off, and the urgency line + countdown (one
 * switch for both — they're one unit on the checkout). Works on the
 * `PaymentFormDesign` jsonb, so no save logic of its own.
 */
export function CheckoutHeaderSettings({
  design,
  onChange,
}: {
  design: PaymentFormDesign
  onChange: (design: PaymentFormDesign) => void
}) {
  const t = usePaymentsT("skins")
  const urgency = design.urgency ?? {}
  const setUrgency = (patch: Partial<PaymentPageUrgency>) =>
    onChange({ ...design, urgency: { ...urgency, ...patch } })
  const text = urgency.text ?? ""

  const numberField = (key: "hours" | "minutes" | "seconds", label: string, max: number) => (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={urgency[key] ?? ""}
        onChange={(e) => {
          const raw = e.target.value
          setUrgency({ [key]: raw === "" ? undefined : Math.min(max, Math.max(0, Math.floor(Number(raw) || 0))) })
        }}
        placeholder="0"
        className="w-20"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-sm text-foreground">
        <span>
          {t("logoEnabledLabel")}
          {!design.logo_url && <span className="block text-xs text-muted-foreground">{t("logoEnabledHint")}</span>}
        </span>
        <Switch
          checked={design.logo_enabled !== false}
          onCheckedChange={(v) => onChange({ ...design, logo_enabled: !!v })}
        />
      </label>

      <div className="grid gap-3 rounded-lg border border-border p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-foreground">{t("urgencyTitle")}</span>
            <span className="text-xs text-muted-foreground">{t("urgencyHint")}</span>
          </span>
          <Switch checked={!!urgency.enabled} onCheckedChange={(v) => setUrgency({ enabled: !!v })} />
        </label>

        {urgency.enabled && (
          <>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">{t("urgencyTextLabel")}</Label>
                <CharCounter value={text} max={CHECKOUT_TEXT_LIMITS.urgencyText} />
              </div>
              <Input
                value={text}
                maxLength={CHECKOUT_TEXT_LIMITS.urgencyText}
                onChange={(e) => setUrgency({ text: e.target.value })}
                placeholder={t("urgencyTextPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("maxChars", { max: CHECKOUT_TEXT_LIMITS.urgencyText })} · {t("urgencyTextHint")}
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">{t("urgencyDurationLabel")}</Label>
              <div className="flex flex-wrap gap-3">
                {numberField("hours", t("hoursLabel"), URGENCY_MAX_HOURS)}
                {numberField("minutes", t("minutesLabel"), 59)}
                {numberField("seconds", t("secondsLabel"), 59)}
              </div>
              <p
                className={cn(
                  "text-xs",
                  urgencyDurationSeconds(urgency) > 0 ? "text-muted-foreground" : "text-amber-600",
                )}
              >
                {urgencyDurationSeconds(urgency) > 0 ? t("urgencyDurationHint") : t("urgencyNeedsDuration")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
