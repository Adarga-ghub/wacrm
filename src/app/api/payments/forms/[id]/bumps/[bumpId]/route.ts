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

interface PutBody extends Partial<Record<keyof BumpPopupCopy, string | null>> {
  title?: string | null
  description?: string | null
  active?: boolean
  position?: number
  price?: number | string | null
  compare_at_price?: number | string | null
  gallery_images?: string[] | null
  box_font_sizes?: BumpBoxFontSizes | null
  /** Drafts only (migration 066): pick or change the offer. */
  bump_form_id?: string | null
  /** `false` publishes a draft; `true` keeps it a draft. A published bump can't go back to draft. */
  draft?: boolean
}

/**
 * PUT /api/payments/forms/[id]/bumps/[bumpId] — edit an order bump's
 * copy, toggle it, or reorder it. For a draft (migration 066) it can
 * also set the offer, and `draft: false` publishes it — only then are
 * the offer's price/currency checked, as when a bump is created.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; bumpId: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, bumpId } = await params
  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

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

  const update: Record<string, unknown> = { ...popupCopy.copy }
  if (title !== undefined) update.title = title
  if (description !== undefined) update.description = description
  if (galleryImages !== undefined) update.gallery_images = galleryImages
  if (boxFontSizes !== undefined) update.box_font_sizes = boxFontSizes
  if (body.active !== undefined) update.active = Boolean(body.active)
  if (body.position !== undefined && Number.isInteger(body.position)) update.position = body.position
  const price = parseBumpPrice(body.price)
  const compareAtPrice = parseBumpPrice(body.compare_at_price)
  if (price === 'invalid' || compareAtPrice === 'invalid') {
    return NextResponse.json({ error: 'Prices must be numbers greater than 0' }, { status: 400 })
  }
  if (price !== undefined) update.price = price
  if (compareAtPrice !== undefined) update.compare_at_price = compareAtPrice

  if (body.bump_form_id !== undefined || body.draft !== undefined) {
    const { data: existing } = await ctx.supabase
      .from('payment_order_bumps')
      .select('is_draft, bump_form_id')
      .eq('id', bumpId)
      .eq('form_id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (body.draft === true && !existing.is_draft) {
      return NextResponse.json({ error: 'A published order bump cannot go back to draft' }, { status: 400 })
    }
    const nextOffer = body.bump_form_id !== undefined ? body.bump_form_id || null : existing.bump_form_id
    if (nextOffer !== existing.bump_form_id) {
      if (!existing.is_draft) {
        return NextResponse.json({ error: 'The offer of a published order bump cannot be changed' }, { status: 400 })
      }
      update.bump_form_id = nextOffer
    }
    const publishing = body.draft === false && existing.is_draft
    if (publishing && !nextOffer) {
      return NextResponse.json({ error: 'Choose the offer to add before publishing' }, { status: 400 })
    }
    if (nextOffer && (publishing || nextOffer !== existing.bump_form_id)) {
      const offerError = await checkBumpOffer(ctx.supabase, ctx.accountId, id, nextOffer, publishing)
      if (offerError) return NextResponse.json({ error: offerError.error }, { status: offerError.status })
    }
    if (publishing) update.is_draft = false
  }

  const { data, error } = await ctx.supabase
    .from('payment_order_bumps')
    .update(update)
    .eq('id', bumpId)
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That offer is already an order bump here' }, { status: 409 })
    }
    console.error('[payments/forms/[id]/bumps/[bumpId] PUT] failed:', error)
    return NextResponse.json({ error: 'Failed to save order bump' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ bump: data })
}

/**
 * DELETE /api/payments/forms/[id]/bumps/[bumpId]
 *
 * A hard delete is safe here (unlike archiving a form): past purchases
 * keep their own copy of what was bought in
 * `payment_transactions.line_items`, nothing references this row.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bumpId: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, bumpId } = await params

  const { error } = await ctx.supabase
    .from('payment_order_bumps')
    .delete()
    .eq('id', bumpId)
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/forms/[id]/bumps/[bumpId] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to remove order bump' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
