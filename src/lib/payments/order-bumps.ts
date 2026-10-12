// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

/** An order bump resolved against its bump offer — the price here is the only one the checkout and the order route ever trust. */
export interface ResolvedOrderBump {
  id: string
  bumpFormId: string
  title: string
  description: string | null
  price: number
  imageUrl: string | null
  /** Line name for the PayPal order, receipts and `payment_transactions.line_items`. */
  itemName: string
  automationId: string | null
}

interface MainForm {
  id: string
  account_id: string
  currency: string
}

/**
 * Active order bumps for a main offer (migration 061), in display
 * order, resolved to what the buyer can actually be charged. Shared by
 * `GET /api/public/payments/forms/[slug]` (what's shown) and
 * `POST /api/public/payments/orders` (what's charged) so both apply the
 * exact same eligibility rules. A bump is silently dropped — never
 * shown, never chargeable — when its offer is archived, isn't a fixed
 * price, belongs to another account, or is priced in a different
 * currency than the main offer (one PayPal order has one currency).
 */
export async function loadOrderBumps(db: AnySupabase, form: MainForm): Promise<ResolvedOrderBump[]> {
  const { data: bumps, error } = await db
    .from('payment_order_bumps')
    .select('id, bump_form_id, title, description')
    .eq('form_id', form.id)
    .eq('active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[payments/order-bumps] failed to load bumps:', error)
    return []
  }
  if (!bumps?.length) return []

  const { data: offers } = await db
    .from('payment_forms')
    .select('id, account_id, name, status, amount_type, amount, currency, product_id, automation_id')
    .in('id', bumps.map((b: { bump_form_id: string }) => b.bump_form_id))
  const offerById = new Map<string, Record<string, unknown>>(
    (offers ?? []).map((o: { id: string }) => [o.id, o]),
  )

  const productIds = (offers ?? [])
    .map((o: { product_id: string | null }) => o.product_id)
    .filter((id: string | null): id is string => !!id)
  const productById = new Map<string, { name: string; image_url: string | null }>()
  if (productIds.length) {
    const { data: products } = await db
      .from('payment_products')
      .select('id, name, image_url')
      .in('id', productIds)
    for (const p of products ?? []) productById.set(p.id, p)
  }

  const resolved: ResolvedOrderBump[] = []
  for (const bump of bumps) {
    const offer = offerById.get(bump.bump_form_id) as
      | {
          account_id: string
          name: string
          status: string
          amount_type: string
          amount: number | null
          currency: string
          product_id: string | null
          automation_id: string | null
        }
      | undefined
    if (!offer) continue
    if (offer.account_id !== form.account_id) continue
    if (offer.status === 'archived') continue
    if (offer.amount_type !== 'fixed' || offer.amount == null || Number(offer.amount) <= 0) continue
    if (offer.currency !== form.currency) continue

    const product = offer.product_id ? productById.get(offer.product_id) : undefined
    const itemName = product?.name ?? offer.name
    resolved.push({
      id: bump.id,
      bumpFormId: bump.bump_form_id,
      title: bump.title?.trim() || itemName,
      description: bump.description?.trim() || null,
      price: Number(offer.amount),
      imageUrl: product?.image_url ?? null,
      itemName,
      automationId: offer.automation_id,
    })
  }
  return resolved
}

/** Money math in integer cents — summing `5.99 + 2.99` as floats drifts, and PayPal rejects an order whose item total doesn't match the amount exactly. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}
