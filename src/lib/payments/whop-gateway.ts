import { decrypt } from '@/lib/whatsapp/encryption'
import type { WhopEnvironment } from './whop-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export interface ResolvedWhopGateway {
  environment: WhopEnvironment
  companyId: string
  apiKey: string
  /** False when the merchant switched Whop off: no NEW payments, but orders in progress still get confirmed. */
  enabled: boolean
}

function decryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return decrypt(value)
  } catch (err) {
    console.error('[payments/whop-gateway] failed to decrypt a stored secret:', err)
    return null
  }
}

/**
 * The account's active-environment Whop credentials, or `null` when
 * Whop isn't connected — callers then simply don't offer it, and the
 * buyer sees PayPal alone, exactly as before Whop existed.
 */
export async function resolveWhopGateway(
  db: AnySupabase,
  accountId: string,
): Promise<ResolvedWhopGateway | null> {
  const { data: config } = await db
    .from('whop_gateway_credentials')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!config) return null

  const environment = config.environment as WhopEnvironment
  const companyId = environment === 'sandbox' ? config.sandbox_company_id : config.live_company_id
  const apiKey = decryptOrNull(
    environment === 'sandbox' ? config.sandbox_api_key : config.live_api_key,
  )
  if (!companyId || !apiKey) return null
  return { environment, companyId, apiKey, enabled: config.enabled !== false }
}

/** Both environments' signing secrets: a delivery may belong to either, and only one will verify. */
export async function loadWhopWebhookSecrets(db: AnySupabase, accountId: string): Promise<string[]> {
  const { data: config } = await db
    .from('whop_gateway_credentials')
    .select('sandbox_webhook_secret, live_webhook_secret')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!config) return []
  return [decryptOrNull(config.live_webhook_secret), decryptOrNull(config.sandbox_webhook_secret)].filter(
    (s): s is string => !!s,
  )
}
