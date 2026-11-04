"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { GatewayLogo } from "@/components/payments/gateway-logo"
import { GatewayToggle } from "@/components/payments/gateway-toggle"
import { NotificationEmailsField } from "@/components/payments/notification-emails-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type Environment = "sandbox" | "live"

interface EnvStatus {
  configured: boolean
  company_id: string | null
  webhook_registered: boolean
}

interface ConfigResponse {
  connected: boolean
  enabled: boolean
  environment: Environment
  notification_emails: string[]
  sandbox: EnvStatus
  live: EnvStatus
}

/** Whop's card in "Configuración de Pasarela": business ID and API key per environment, independent of PayPal's. */
export function WhopGatewayConfig() {
  const { canEditSettings, profileLoading } = useAuth()
  const t = useTranslations("Payments.whop")

  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [environment, setEnvironment] = useState<Environment>("live")
  const [companyId, setCompanyId] = useState("")
  const [apiKey, setApiKey] = useState("")
  // Always at least one row, so there's a field to type in.
  const [emails, setEmails] = useState<string[]>([""])
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function load() {
    try {
      const res = await fetch("/api/payments/whop/config")
      const data: ConfigResponse = await res.json()
      setConfig(data)
      setEnvironment(data.environment)
      setCompanyId(data[data.environment].company_id ?? "")
      setEmails(data.notification_emails.length > 0 ? data.notification_emails : [""])
    } catch {
      toast.error(t("loadFailed"))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectEnvironment(env: Environment) {
    setEnvironment(env)
    setCompanyId(config?.[env].company_id ?? "")
    setApiKey("")
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/payments/whop/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment,
          company_id: companyId.trim(),
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
          notification_emails: emails,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("saveFailed"))
        return
      }
      toast.success(t("saveSuccess"))
      setApiKey("")
      await load()
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(enabled: boolean) {
    setToggling(true)
    try {
      const res = await fetch("/api/payments/whop/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("saveFailed"))
        return
      }
      toast.success(enabled ? t("toggledOn") : t("toggledOff"))
      setConfig((prev) => (prev ? { ...prev, enabled } : prev))
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setToggling(false)
    }
  }

  async function handleDisconnect() {
    setSaving(true)
    try {
      const res = await fetch("/api/payments/whop/config", { method: "DELETE" })
      if (!res.ok) {
        toast.error(t("disconnectFailed"))
        return
      }
      toast.success(t("disconnectSuccess"))
      setCompanyId("")
      setApiKey("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const envStatus = config[environment]
  const readOnly = !canEditSettings || profileLoading

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-foreground">
          <GatewayLogo src="/logos/whop.svg" alt="Whop" />
          <GatewayToggle
            enabled={config.connected && config.enabled}
            disabled={readOnly || toggling || !config.connected}
            onChange={handleToggle}
            label={config.connected && config.enabled ? t("toggleOn") : t("toggleOff")}
          />
        </CardTitle>
        <CardDescription className="text-muted-foreground">{t("cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          {(["sandbox", "live"] as const).map((env) => (
            <button
              key={env}
              type="button"
              disabled={readOnly}
              onClick={() => selectEnvironment(env)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                environment === env
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {env === "sandbox" ? t("sandbox") : t("live")}
              {config[env].configured && <CheckCircle2 className="size-3.5 text-emerald-500" />}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <Label className="text-muted-foreground">{t("companyId")}</Label>
          <Input
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={readOnly}
            placeholder="biz_..."
          />
        </div>

        <div className="grid gap-2">
          <Label className="text-muted-foreground">{t("apiKey")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={readOnly}
            placeholder={envStatus.configured ? t("keySavedPlaceholder") : ""}
          />
          {envStatus.configured && <p className="text-xs text-muted-foreground">{t("keyKeepHint")}</p>}
        </div>

        <NotificationEmailsField
          emails={emails}
          onChange={setEmails}
          disabled={readOnly}
          label={t("notificationEmailLabel")}
          hint={t("notificationEmailHint")}
          addLabel={t("addEmail")}
          removeLabel={t("removeEmail")}
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {envStatus.webhook_registered ? (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              {t("webhookRegistered")}
            </>
          ) : (
            <>
              <XCircle className="size-3.5 text-amber-500" />
              {t("webhookPending")}
            </>
          )}
        </div>

        {canEditSettings && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
            <Button variant="outline" disabled={saving || !config.connected} onClick={handleDisconnect}>
              {t("disconnect")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
