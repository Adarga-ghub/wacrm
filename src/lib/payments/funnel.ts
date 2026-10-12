import { randomBytes } from 'crypto'
import { fromCents, toCents } from './order-bumps'
import type {
  FunnelPageContent,
  PaymentFunnelStage,
  PaymentFunnelStepKind,
  PaymentTransactionLineItem,
  PublicFunnelOffer,
} from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

/**
 * Post-purchase funnel (migration 063): checkout → upsell → (declined)
 * downsell → thank-you. Everything that decides what a buyer sees or
 * pays on the upsell/downsell pages lives here, shared by the public
 * routes (`/api/public/payments/funnel/[token]/…`), the capture route
 * (where the funnel starts) and the admin preview — so what's shown is
 * always exactly what's charged, same rule as `loadOrderBumps`.
 */

export const FUNNEL_STEP_KINDS: PaymentFunnelStepKind[] = ['upsell', 'downsell']

export interface FunnelMainForm {
  id: string
  account_id: string
  currency: string
}

/** One offer sold by a step, with its share of the step price. */
export interface ResolvedFunnelLine {
  formId: string
  name: string
  imageUrl: string | null
  author: string | null
  /** This offer's share of the step price — proportional to the offers' own prices, summing to the step price exactly. */
  amount: number
}

export interface ResolvedFunnelStep {
  id: string
  kind: PaymentFunnelStepKind
  active: boolean
  price: number
  compareAtPrice: number | null
  page: FunnelPageContent
  lines: ResolvedFunnelLine[]
}

interface OfferRow {
  id: string
  account_id: string
  name: string
  status: string
  amount_type: string
  amount: number | null
  currency: string
  product_id: string | null
}

/**
 * The `kind` step of a main offer's funnel, resolved to what the buyer
 * can actually be charged — or null when there's no such step or none
 * of its offers is sellable anymore. Offers are dropped (not the whole
 * step) when archived, not a fixed price, from another account, or in
 * a different currency than the main offer. Inactive steps resolve too
 * (the admin preview needs them) — pass `activeOnly` on public paths.
 */
export async function loadFunnelStep(
  db: AnySupabase,
  form: FunnelMainForm,
  kind: PaymentFunnelStepKind,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<ResolvedFunnelStep | null> {
  const { data: step, error } = await db
    .from('payment_funnel_steps')
    .select('id, kind, offer_form_ids, price, compare_at_price, page, active')
    .eq('form_id', form.id)
    .eq('account_id', form.account_id)
    .eq('kind', kind)
    .maybeSingle()
  if (error) {
    console.error('[payments/funnel] failed to load step:', error)
    return null
  }
  if (!step || (activeOnly && !step.active)) return null
  const offerIds = ((step.offer_form_ids ?? []) as string[]).filter((id) => id !== form.id)
  if (offerIds.length === 0) return null

  const { data: offers } = await db
    .from('payment_forms')
    .select('id, account_id, name, status, amount_type, amount, currency, product_id')
    .in('id', offerIds)
  const offerById = new Map<string, OfferRow>((offers ?? []).map((o: OfferRow) => [o.id, o]))
  const sellable = offerIds
    .map((id) => offerById.get(id))
    .filter(
      (o): o is OfferRow =>
        !!o &&
        o.account_id === form.account_id &&
        o.status !== 'archived' &&
        o.amount_type === 'fixed' &&
        Number(o.amount) > 0 &&
        o.currency === form.currency,
    )
  if (sellable.length === 0) return null

  const productIds = sellable.map((o) => o.product_id).filter((id): id is string => !!id)
  const productById = new Map<string, { name: string; image_url: string | null; author: string | null }>()
  if (productIds.length) {
    const { data: products } = await db
      .from('payment_products')
      .select('id, name, image_url, author')
      .in('id', productIds)
    for (const p of products ?? []) productById.set(p.id, p)
  }

  const ownCents = sellable.map((o) => toCents(Number(o.amount)))
  const ownTotal = ownCents.reduce((a, b) => a + b, 0)
  const priceCents = step.price != null && Number(step.price) > 0 ? toCents(Number(step.price)) : ownTotal
  // Split the step price across its offers in proportion to their own
  // prices, in integer cents, the rounding remainder on the last line —
  // the PayPal order's item total must equal its amount exactly.
  let allocated = 0
  const lines: ResolvedFunnelLine[] = sellable.map((offer, i) => {
    const cents =
      i === sellable.length - 1 ? priceCents - allocated : Math.round((priceCents * ownCents[i]) / ownTotal)
    allocated += cents
    const product = offer.product_id ? productById.get(offer.product_id) : undefined
    return {
      formId: offer.id,
      name: product?.name ?? offer.name,
      imageUrl: product?.image_url ?? null,
      author: product?.author ?? null,
      amount: cents / 100,
    }
  })

  const price = priceCents / 100
  const compareAt = step.compare_at_price != null ? Number(step.compare_at_price) : null
  return {
    id: step.id,
    kind: step.kind,
    active: step.active,
    price,
    compareAtPrice: compareAt != null && compareAt > price ? compareAt : null,
    page: (step.page ?? {}) as FunnelPageContent,
    lines,
  }
}

/** Public-safe projection rendered by the upsell/downsell page. */
export function toPublicFunnelOffer(step: ResolvedFunnelStep, currency: string): PublicFunnelOffer {
  return {
    kind: step.kind,
    page: step.page,
    items: step.lines.map((l) => ({ name: l.name, image_url: l.imageUrl, author: l.author })),
    price: step.price,
    compare_at_price: step.compareAtPrice,
    currency,
  }
}

/** Line items recorded on the step's own `payment_transactions` row. */
export function funnelLineItems(step: ResolvedFunnelStep): PaymentTransactionLineItem[] {
  return step.lines.map((l) => ({
    kind: step.kind,
    form_id: l.formId,
    step_id: step.id,
    name: l.name,
    amount: l.amount,
  }))
}

/** PayPal order lines for a step: the first offer is the order's main item, the rest ride as extra items. */
export function funnelOrderItems(step: ResolvedFunnelStep) {
  const [first, ...rest] = step.lines
  return {
    amount: fromCents(toCents(step.price)),
    itemName: first.name,
    extraItems: rest.map((l) => ({ name: l.name, amount: fromCents(toCents(l.amount)) })),
  }
}

/**
 * Where the buyer goes after declining (or not being offered) `after`:
 * the downsell if one is set up and sellable, otherwise done. `null`
 * = the very first stage (right after the checkout payment).
 */
export async function nextFunnelStage(
  db: AnySupabase,
  form: FunnelMainForm,
  after: PaymentFunnelStepKind | null,
): Promise<PaymentFunnelStage> {
  const remaining = after === null ? FUNNEL_STEP_KINDS : FUNNEL_STEP_KINDS.slice(FUNNEL_STEP_KINDS.indexOf(after) + 1)
  for (const kind of remaining) {
    if (await loadFunnelStep(db, form, kind)) return kind
  }
  return 'done'
}

export function funnelPageUrl(token: string): string {
  return `/pay/offer/${token}`
}

export interface ThankYouTarget {
  redirect_url: string | null
  inline_message: string | null
}

/** The main offer's own thank-you: its Redirect URL, or its inline success message. */
export async function loadThankYou(db: AnySupabase, formId: string | null): Promise<ThankYouTarget> {
  if (!formId) return { redirect_url: null, inline_message: null }
  const { data: form } = await db
    .from('payment_forms')
    .select('redirect_url, inline_success_message')
    .eq('id', formId)
    .maybeSingle()
  return {
    redirect_url: form?.redirect_url ?? null,
    inline_message: form?.inline_success_message ?? null,
  }
}

interface CompletedTxn {
  id: string
  form_id: string | null
  account_id: string
  currency: string
  parent_transaction_id?: string | null
  funnel_token?: string | null
  funnel_stage?: PaymentFunnelStage | null
}

/**
 * Where the browser goes once a payment is captured — what the capture
 * route answers with. A checkout purchase whose offer has an upsell or
 * downsell gets a funnel token (issued here, only after the payment is
 * completed, so the pages can't be reached without buying) and is sent
 * to the first page; an upsell/downsell purchase closes its funnel and
 * goes to the MAIN offer's thank-you. Everything else: the offer's own
 * thank-you, as before. Idempotent — a retried capture reuses the
 * token already issued.
 */
export async function resolvePostPurchaseRedirect(
  db: AnySupabase,
  txn: CompletedTxn,
): Promise<ThankYouTarget> {
  if (txn.parent_transaction_id) {
    const { data: parent } = await db
      .from('payment_transactions')
      .select('id, form_id')
      .eq('id', txn.parent_transaction_id)
      .maybeSingle()
    if (parent) {
      await db.from('payment_transactions').update({ funnel_stage: 'done' }).eq('id', parent.id)
    }
    return loadThankYou(db, parent?.form_id ?? txn.form_id)
  }

  if (txn.funnel_token && txn.funnel_stage && txn.funnel_stage !== 'done') {
    return { redirect_url: funnelPageUrl(txn.funnel_token), inline_message: null }
  }
  if (!txn.form_id || txn.funnel_stage === 'done') return loadThankYou(db, txn.form_id)

  const stage = await nextFunnelStage(
    db,
    { id: txn.form_id, account_id: txn.account_id, currency: txn.currency },
    null,
  )
  if (stage === 'done') return loadThankYou(db, txn.form_id)

  const token = randomBytes(24).toString('base64url')
  const { data: updated } = await db
    .from('payment_transactions')
    .update({ funnel_token: token, funnel_stage: stage })
    .eq('id', txn.id)
    .is('funnel_token', null)
    .select('funnel_token')
    .maybeSingle()
  if (updated?.funnel_token) {
    return { redirect_url: funnelPageUrl(updated.funnel_token), inline_message: null }
  }
  // Lost a race with a concurrent capture call — use the token it issued.
  const { data: current } = await db
    .from('payment_transactions')
    .select('funnel_token, funnel_stage')
    .eq('id', txn.id)
    .maybeSingle()
  if (current?.funnel_token && current.funnel_stage !== 'done') {
    return { redirect_url: funnelPageUrl(current.funnel_token), inline_message: null }
  }
  return loadThankYou(db, txn.form_id)
}

export interface FunnelParent {
  id: string
  account_id: string
  form_id: string
  currency: string
  status: string
  funnel_stage: PaymentFunnelStage | null
  whatsapp_phone: string | null
  form_field_values: Record<string, string> | null
  payer_name: string | null
  payer_email: string | null
  send_automation: boolean
}

/**
 * The completed checkout purchase a funnel token belongs to — null for
 * an unknown/malformed token or a purchase that isn't completed. The
 * token is the ONLY credential the public funnel routes accept.
 */
export async function loadFunnelParent(db: AnySupabase, token: string): Promise<FunnelParent | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const { data } = await db
    .from('payment_transactions')
    .select(
      'id, account_id, form_id, currency, status, funnel_stage, whatsapp_phone, form_field_values, payer_name, payer_email, send_automation',
    )
    .eq('funnel_token', token)
    .maybeSingle()
  if (!data || data.status !== 'completed' || !data.form_id) return null
  return data
}

export function funnelMainForm(parent: FunnelParent): FunnelMainForm {
  return { id: parent.form_id, account_id: parent.account_id, currency: parent.currency }
}

const PAGE_TEXT_LIMITS: Record<Exclude<keyof FunnelPageContent, 'bullets' | 'timer_minutes'>, number> = {
  banner: 160,
  headline: 200,
  subheadline: 400,
  image_url: 2000,
  body: 3000,
  accept_label: 80,
  decline_label: 160,
  guarantee: 300,
}

/** Keeps only known page fields, trimmed and length-capped — the admin body is untrusted JSON. */
export function sanitizeFunnelPage(input: unknown): FunnelPageContent {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const page: FunnelPageContent = {}
  for (const [key, max] of Object.entries(PAGE_TEXT_LIMITS)) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) {
      page[key as keyof typeof PAGE_TEXT_LIMITS] = value.trim().slice(0, max)
    }
  }
  if (Array.isArray(raw.bullets)) {
    const bullets = raw.bullets
      .filter((b): b is string => typeof b === 'string')
      .map((b) => b.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 12)
    if (bullets.length) page.bullets = bullets
  }
  const minutes = Number(raw.timer_minutes)
  if (Number.isFinite(minutes) && minutes > 0) page.timer_minutes = Math.min(Math.round(minutes), 120)
  return page
}
