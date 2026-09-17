import { decrypt } from '@/lib/whatsapp/encryption'
import type { PayPalEnvironment } from './paypal-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export interface ResolvedGateway {
  environment: PayPalEnvironment
  clientId: string
  clientSecret: string
  webhookId: string | null
}

/**
 * Loads and decrypts the account's active-environment PayPal
 * credentials. Returns `null` when the account hasn't connected
 * PayPal yet, or hasn't finished the active environment's fields —
 * callers treat both the same ("payments aren't available for this
 * form yet").
 */
export async function resolveGateway(
  db: AnySupabase,
  accountId: string,
): Promise<ResolvedGateway | null> {
  const { data: config } = await db
    .from('payment_gateway_credentials')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!config) return null

  const env = config.environment as PayPalEnvironment
  const clientId = env === 'sandbox' ? config.sandbox_client_id : config.live_client_id
  const encryptedSecret =
    env === 'sandbox' ? config.sandbox_client_secret : config.live_client_secret
  const webhookId = env === 'sandbox' ? config.sandbox_webhook_id : config.live_webhook_id
  if (!clientId || !encryptedSecret) return null

  let clientSecret: string
  try {
    clientSecret = decrypt(encryptedSecret)
  } catch (err) {
    console.error('[payments/gateway] failed to decrypt client secret:', err)
    return null
  }

  return { environment: env, clientId, clientSecret, webhookId: webhookId ?? null }
}
