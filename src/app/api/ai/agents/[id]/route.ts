import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { listPhoneCountries } from '@/lib/whatsapp/phone-country'

type Params = { params: Promise<{ id: string }> }

const KNOWN_COUNTRIES = new Set(listPhoneCountries('en').map((c) => c.iso))

/**
 * PATCH /api/ai/agents/[id]  (admin+)
 *
 * Rename an agent and/or set the countries it answers.
 * Body: { name?: string, countries?: string[] (ISO alpha-2) }.
 * Countries are ignored on the default agent — it already answers
 * every country that has no agent of its own.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-agents:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { data: agent } = await supabase
      .from('ai_configs')
      .select('id, is_default')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle()
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const update: Record<string, unknown> = {}
    if ('name' in body) {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
      if (!name) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 })
      }
      update.name = name
    }
    if ('countries' in body && !agent.is_default) {
      if (!Array.isArray(body.countries)) {
        return NextResponse.json({ error: 'countries must be an array' }, { status: 400 })
      }
      update.countries = Array.from(
        new Set(
          (body.countries as unknown[])
            .filter((c): c is string => typeof c === 'string')
            .map((c) => c.trim().toUpperCase())
            .filter((c) => KNOWN_COUNTRIES.has(c)),
        ),
      )
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from('ai_configs')
      .update(update)
      .eq('account_id', accountId)
      .eq('id', id)
    if (error) {
      console.error('[ai/agents/[id] PATCH] error:', error)
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
