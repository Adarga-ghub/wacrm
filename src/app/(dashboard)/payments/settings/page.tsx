"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"

import { PaymentGatewayConfig } from "@/components/payments/payment-gateway-config"

export default function PaymentsSettingsPage() {
  const t = useTranslations("Sidebar")

  return (
    <div className="space-y-6">
      <Link
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("payments")}
      </Link>
      <PaymentGatewayConfig />
    </div>
  )
}
