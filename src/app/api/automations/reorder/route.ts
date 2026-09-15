import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * Bulk-reorder the caller's account's automations for the /automations
 * list page (drag-and-drop card reordering, migration 047's `position`
 * column).
 *
 * Reordering is a write — the RLS `automations_update` policy requires
 * `agent`, but this route writes via the service-role client which
 * bypasses RLS, so the role is enforced here (same pattern as every
 * other automations write route).
 */
export async function PATCH(request: Request) {
  let accountId: string
  try {
    const ctx = await requireRole('agent')
    accountId = ctx.accountId
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = await request.json().catch(() => null)
  const orderedIds = body?.ordered_ids
  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.some((id) => typeof id !== 'string')
  ) {
    return NextResponse.json(
      { error: 'ordered_ids must be a non-empty array of automation ids' },
      { status: 400 },
    )
  }

  const admin = supabaseAdmin()

  // Load the account's own rows for two reasons:
  //
  // 1. Tenancy: an id in the payload that isn't in this set belongs to
  //    another account (or doesn't exist) and is silently dropped — a
  //    forged payload can never reposition a foreign account's rows.
  //
  // 2. `upsert(..., { onConflict: 'id' })` needs every NOT NULL column
  //    without a default (account_id, user_id, name, trigger_type) in
  //    each row, even though every id here is guaranteed pre-existing
  //    and this is really just a bulk UPDATE. Postgres validates
  //    `INSERT ... ON CONFLICT DO UPDATE`'s implicit insert tuple
  //    against NOT NULL constraints BEFORE it even checks for a
  //    conflict, so a partial `{id, position}` row fails even though
  //    the conflict path would have ignored those columns. This
  //    mirrors the same full-row upsert pipeline_stages already does
  //    in `pipeline-settings.tsx` for the same reason.
  const { data: existing, error: fetchErr } = await admin
    .from('automations')
    .select('id, account_id, user_id, name, trigger_type')
    .eq('account_id', accountId)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const byId = new Map((existing ?? []).map((row) => [row.id, row]))

  // Position is recomputed strictly from the submitted array's order —
  // this IS the "strictly respect the final visual order" contract the
  // client's drag-and-drop is built around.
  const rows = orderedIds
    .filter((id): id is string => byId.has(id))
    .map((id, index) => {
      const row = byId.get(id)!
      return {
        id: row.id,
        account_id: row.account_id,
        user_id: row.user_id,
        name: row.name,
        trigger_type: row.trigger_type,
        position: index,
      }
    })

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'None of the given ids belong to this account' },
      { status: 400 },
    )
  }

  const { error: upsertErr } = await admin
    .from('automations')
    .upsert(rows, { onConflict: 'id' })
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
