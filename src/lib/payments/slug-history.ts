import { supabaseAdmin } from '@/lib/payments/admin-db'

/**
 * Old checkout links (migration 068). An offer's `/pay/[slug]` can be
 * edited from the product page; the slugs it leaves behind live in
 * `payment_form_slug_history` and redirect to the current one. Both
 * tables are read with the service role: slugs are unique across
 * EVERY account, which RLS-scoped queries can't see.
 */

/**
 * Whether `slug` can become `formId`'s link: not the live slug of
 * another offer, nor an old slug still redirecting to another offer.
 * The offer's own old slugs are free to take back.
 */
export async function isSlugAvailable(slug: string, formId: string): Promise<boolean> {
  const db = supabaseAdmin()
  const [{ data: live, error: liveError }, { data: old, error: oldError }] = await Promise.all([
    db.from('payment_forms').select('id').eq('slug', slug).maybeSingle(),
    db.from('payment_form_slug_history').select('form_id').eq('old_slug', slug).maybeSingle(),
  ])
  if (liveError) throw liveError
  if (oldError) throw oldError
  if (live && live.id !== formId) return false
  if (old && old.form_id !== formId) return false
  return true
}

/**
 * Records a slug change once it's saved: the old slug starts
 * redirecting here, and the new one — if it was one of this offer's
 * old slugs — stops being a redirect.
 */
export async function recordSlugChange(
  formId: string,
  accountId: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  const db = supabaseAdmin()
  const { error: deleteError } = await db
    .from('payment_form_slug_history')
    .delete()
    .eq('old_slug', newSlug)
    .eq('form_id', formId)
  if (deleteError) throw deleteError
  const { error } = await db
    .from('payment_form_slug_history')
    .upsert({ old_slug: oldSlug, form_id: formId, account_id: accountId }, { onConflict: 'old_slug' })
  if (error) throw error
}

/** The current slug of the published offer an old slug points at, or null. */
export async function resolveRenamedSlug(oldSlug: string): Promise<string | null> {
  const db = supabaseAdmin()
  const { data: old, error } = await db
    .from('payment_form_slug_history')
    .select('form_id')
    .eq('old_slug', oldSlug)
    .maybeSingle()
  if (error) throw error
  if (!old) return null
  const { data: form } = await db
    .from('payment_forms')
    .select('slug')
    .eq('id', old.form_id)
    .eq('status', 'published')
    .maybeSingle()
  return form?.slug && form.slug !== oldSlug ? form.slug : null
}
