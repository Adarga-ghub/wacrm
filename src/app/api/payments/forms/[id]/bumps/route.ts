import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkBumpOffer, parseBumpPrice } from '@/lib/payments/order-bumps'
import {
  CHECKOUT_TEXT_LIMITS,
  parseBumpBoxFontSizes,
  parseBumpPopupCopy,
  parseGalleryImages,
  parseLimitedText,
  type BumpBoxFontSizes,
  type BumpPopupCopy,
} from '@/lib/payments/checkout-limits'

/**
 * GET /api/payments/forms/[id]/bumps
 *
 * The order bumps configured on this offer (migration 061), in
 * checkout display order — including inactive ones, so the admin can
 * re-enable them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params

  const { data, error } = await ctx.supabase
    .from('payment_order_bumps')
    .select('*')
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[payments/forms/[id]/bumps GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load order bumps' }, { status: 500 })
  }
  return NextResponse.json({ bumps: data ?? [] })
}

interface PostBody extends Partial<Record<keyof BumpPopupCopy, string | null>> {
  bump_form_id?: string | null
  /** Save as a draft (migration 066): no offer needed, never on the checkout. */
  draft?: boolean
  title?: string | null
  description?: string | null
  /** Bump-specific price (migration 062) — omitted/null = the bump offer's own amount. */
  price?: number | string | null
  /** Struck-through "before" price, display only. */
  compare_at_price?: number | string | null
  /** Preview pop-up images (migration 064). */
  gallery_images?: string[] | null
  /** Checkout box font sizes (migration 065). */
  box_font_sizes?: BumpBoxFontSizes | null
}

/**
 * POST /api/payments/forms/[id]/bumps
 *
 * Attaches another offer of this account as an order bump. Rejects an
 * offer that could never be charged alongside this one — a different
 * currency (one PayPal order = one currency) or a non-fixed price —
 * up front, instead of letting it silently vanish from the checkout
 * (`loadOrderBumps` filters those out at render time too).
 *
 * With `draft: true` (migration 066) the bump is saved half-done: the
 * offer is optional and only checked to belong to this account — the
 * price/currency checks run when the draft is published (PUT).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params
  const body = (await request.json().catch(() => null)) as PostBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const draft = body.draft === true
  const bumpFormId = body.bump_form_id || null
  if (!draft && !bumpFormId) {
    return NextResponse.json({ error: 'bump_form_id is required' }, { status: 400 })
  }
  const title = parseLimitedText(body.title, CHECKOUT_TEXT_LIMITS.bumpTitle)
  const description = parseLimitedText(body.description, CHECKOUT_TEXT_LIMITS.bumpDescription)
  if (title === 'too_long' || description === 'too_long') {
    return NextResponse.json(
      {
        error: `Title max ${CHECKOUT_TEXT_LIMITS.bumpTitle} characters, description max ${CHECKOUT_TEXT_LIMITS.bumpDescription}`,
      },
      { status: 400 },
    )
  }
  const popupCopy = parseBumpPopupCopy(body)
  if ('tooLong' in popupCopy) {
    return NextResponse.json({ error: `${popupCopy.tooLong} max ${popupCopy.max} characters` }, { status: 400 })
  }
  const boxFontSizes = parseBumpBoxFontSizes(body.box_font_sizes)
  if (boxFontSizes === 'invalid') {
    return NextResponse.json({ error: 'Invalid font sizes' }, { status: 400 })
  }
  const galleryImages = parseGalleryImages(body.gallery_images)
  if (galleryImages === 'invalid') {
    return NextResponse.json({ error: 'Invalid gallery images' }, { status: 400 })
  }
  const price = parseBumpPrice(body.price)
  const compareAtPrice = parseBumpPrice(body.compare_at_price)
  if (price === 'invalid' || compareAtPrice === 'invalid') {
    return NextResponse.json({ error: 'Prices must be numbers greater than 0' }, { status: 400 })
  }

  if (bumpFormId) {
    const offerError = await checkBumpOffer(ctx.supabase, ctx.accountId, id, bumpFormId, !draft)
    if (offerError) return NextResponse.json({ error: offerError.error }, { status: offerError.status })
  } else {
    // A draft with no offer yet: still make sure the main offer is ours.
    const { data: main } = await ctx.supabase
      .from('payment_forms')
      .select('id')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle()
    if (!main) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { count } = await ctx.supabase
    .from('payment_order_bumps')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', id)

  const { data, error } = await ctx.supabase
    .from('payment_order_bumps')
    .insert({
      account_id: ctx.accountId,
      form_id: id,
      bump_form_id: bumpFormId,
      is_draft: draft,
      title: title ?? null,
      description: description ?? null,
      gallery_images: galleryImages ?? [],
      ...popupCopy.copy,
      box_font_sizes: boxFontSizes ?? {},
      price: price ?? null,
      compare_at_price: compareAtPrice ?? null,
      position: count ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That offer is already an order bump here' }, { status: 409 })
    }
    console.error('[payments/forms/[id]/bumps POST] failed:', error)
    return NextResponse.json({ error: 'Failed to add order bump' }, { status: 500 })
  }
  return NextResponse.json({ bump: data }, { status: 201 })
}
