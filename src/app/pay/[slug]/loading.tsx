import { PayPageLoading } from "./pay-page-loading"

// Instant loading UI while the /pay/[slug] route segment loads — see
// `PayPageLoading` for why it matters for WhatsApp link-button taps.
export default function Loading() {
  return <PayPageLoading />
}
