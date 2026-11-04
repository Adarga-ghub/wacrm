"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { GatewayLogo } from "@/components/payments/gateway-logo"
import { NotificationEmailsField } from "@/components/payments/notification-emails-field"

type Environment = "sandbox" | "live"

interface EnvStatus {
  configured: boolean
  client_id: string | null
  webhook_registered: boolean
}

interface ConfigResponse {
  connected: boolean
  environment: Environment
  currency: string
  notification_emails: string[]
  sandbox: EnvStatus
  live: EnvStatus
}

/**
 * "Configuración de Pasarela" panel — PayPal Client ID/Secret per
 * environment (Sandbox/Live) plus the account's read-only currency.
 * Mirrors `DealsSettings` (single-account-scoped setting, `PUT` on
 * save, `canEditSettings` gates the form) rather than the much
 * larger `WhatsAppConfig` — PayPal only needs two fields per
 * environment, no multi-step registration flow.
 */
export function PaymentGatewayConfig() {
  const { canEditSettings, profileLoading } = useAuth()
  const t = useTranslations("Payments.gateway")

  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [environment, setEnvironment] = useState<Environment>("sandbox")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [emails, setEmails] = useState<string[]>([""])
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/payments/config")
      const data: ConfigResponse = await res.json()
      setConfig(data)
      setEnvironment(data.environment)
      setClientId(data[data.environment].client_id ?? "")
      setEmails(data.notification_emails.length > 0 ? data.notification_emails : [""])
    } catch {
      toast.error(t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching the environment tab shows that environment's own saved
  // Client ID (never the secret — it's never sent back from the API).
  function selectEnvironment(env: Environment) {
    setEnvironment(env)
    setClientId(config?.[env].client_id ?? "")
    setClientSecret("")
  }

  async function handleSave() {
    if (!clientId.trim()) {
      toast.error(t("clientIdRequired"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payments/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment,
          [`${environment}_client_id`]: clientId.trim(),
          ...(clientSecret.trim()
            ? { [`${environment}_client_secret`]: clientSecret.trim() }
            : {}),
          notification_emails: emails,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("saveFailed"))
        return
      }
      toast.success(t("saveSuccess"))
      setClientSecret("")
      await load()
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setSaving(true)
    try {
      const res = await fetch("/api/payments/config", { method: "DELETE" })
      if (!res.ok) {
        toast.error(t("disconnectFailed"))
        return
      }
      toast.success(t("disconnectSuccess"))
      setClientId("")
      setClientSecret("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const envStatus = config[environment]
  const readOnly = !canEditSettings || profileLoading

  return (
    <section className="animate-in fade-in-50 duration-200">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <GatewayLogo src="/logos/paypal.svg" alt="PayPal" />
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("cardDescription")}
          </CardDescription>
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
                {config[env].configured && (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("clientId")}</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={readOnly}
              placeholder="AQ1Bk8..."
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("clientSecret")}</Label>
            <Input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              disabled={readOnly}
              placeholder={envStatus.configured ? t("secretSavedPlaceholder") : "EL..."}
            />
            {envStatus.configured && (
              <p className="text-xs text-muted-foreground">{t("secretKeepHint")}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("currencyLabel")}</span>
            <Badge variant="outline">{config.currency}</Badge>
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

          {!canEditSettings && (
            <p className="text-xs text-muted-foreground">{t("adminOnlyHint")}</p>
          )}

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
              {config.connected && (
                <Button variant="outline" disabled={saving} onClick={handleDisconnect}>
                  {t("disconnect")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
