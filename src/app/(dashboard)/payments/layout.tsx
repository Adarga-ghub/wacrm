import type { ReactNode } from "react"

import { PaymentsLocaleProvider } from "@/hooks/use-payments-locale"

// Wraps every /payments/* route with the panel's own Spanish/English
// toggle context (see `PaymentsLanguageToggle`). Only the list
// (`/payments`) and skins (`/payments/skins`) pages currently read
// from it — other subpages (forms editor, transactions, gateway
// settings) still use next-intl's deployment-wide locale untouched —
// but the provider lives here so the toggle's choice is consistent
// if/when more of the section adopts it.
export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return <PaymentsLocaleProvider>{children}</PaymentsLocaleProvider>
}
