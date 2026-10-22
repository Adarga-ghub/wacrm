import { supabaseAdmin } from '@/lib/payments/admin-db'
import { resolveGateway } from '@/lib/payments/gateway'
import { loadOrderBumps } from '@/lib/payments/order-bumps'
import type { PublicPaymentForm } from '@/types'

/**
 * Loads a published payment form as the public checkout sees it —
 * only the fields a payer's browser needs, never `account_id`,
 * `automation_id`, `created_by`, or anything else that would leak
 * internal state. `null` = no published form with that slug; throws on
 * a database error.
 *
 * Shared by `GET /api/public/payments/forms/[slug]` and the server
 * half of `/pay/[slug]` (which renders the checkout straight into the
 * first HTML response instead of making the browser fetch it).
 */
export async function loadPublicPaymentForm(slug: string): Promise<PublicPaymentForm | null> {
  const { data, error } = await supabaseAdmin()
    .from('payment_forms')
    .select(
      'id, account_id, name, status, fields, amount_type, amount, min_amount, products, currency, design, skin_id, product_id, checkout_description, bump_heading',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // A form linked to a skin (migration 053) defers ALL of its
  // cosmetics to the skin — every form pointed at the same skin
  // renders identically and picks up edits together. A form with no
  // `skin_id` keeps using its own `design` column exactly as before.
  // A price linked to a Producto (migration 054) pulls its title,
  // cover image and author from THERE — Hotmart-style — instead of
  // any per-form/per-skin copy. Deliberately NOT `description`: that
  // stays product-page-only, never fetched onto the public checkout.
  // The bumps use the same resolver `POST /api/public/payments/orders`
  // charges from — so the price shown in each bump box is exactly what
  // gets billed. Independent lookups, so they run in parallel.
  const [gateway, skin, productRow, bumps] = await Promise.all([
    resolveGateway(supabaseAdmin(), data.account_id),
    data.skin_id
      ? supabaseAdmin().from('payment_skins').select('design').eq('id', data.skin_id).maybeSingle().then((r: { data: { design: PublicPaymentForm['design'] } | null }) => r.data)
      : null,
    data.product_id
      ? supabaseAdmin().from('payment_products').select('name, image_url, author').eq('id', data.product_id).maybeSingle().then((r: { data: PublicPaymentForm['product'] }) => r.data)
      : null,
    loadOrderBumps(supabaseAdmin(), data),
  ])

  const design = skin ? (skin.design ?? {}) : (data.design ?? {})

  return {
    name: data.name,
    status: data.status,
    fields: data.fields,
    amount_type: data.amount_type,
    amount: data.amount,
    min_amount: data.min_amount,
    products: data.products,
    currency: data.currency,
    design,
    paypal_client_id: gateway?.clientId ?? null,
    product: productRow ?? null,
    checkout_description: data.checkout_description ?? null,
    order_bumps: bumps.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
      compare_at_price: b.compareAtPrice,
      image_url: b.imageUrl,
      gallery_images: b.galleryImages,
      ...b.popupCopy,
      box_font_sizes: b.boxFontSizes,
    })),
    bump_heading: data.bump_heading?.trim() || null,
  }
}
