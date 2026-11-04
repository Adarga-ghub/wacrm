"use client"

import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"

import { BackLink } from "@/components/layout/back-link"
import { SettingsPanelHead } from "@/components/settings/settings-panel-head"
import { PaymentGatewayConfig } from "@/components/payments/payment-gateway-config"
import { WhopGatewayConfig } from "@/components/payments/whop-gateway-config"

export default function PaymentsSettingsPage() {
  const t = useTranslations("Sidebar")
  const tGateway = useTranslations("Payments.gateway")

  return (
    <div className="space-y-6">
      <BackLink
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("payments")}
      </BackLink>
      <div>
        <SettingsPanelHead title={tGateway("title")} description={tGateway("description")} />
        <div className="grid max-w-5xl items-start gap-4 lg:grid-cols-2">
          <PaymentGatewayConfig />
          <WhopGatewayConfig />
        </div>
      </div>
    </div>
  )
}
