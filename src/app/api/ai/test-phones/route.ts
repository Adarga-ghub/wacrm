import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { listPhoneCountries } from '@/lib/whatsapp/phone-country'
import { phoneDigits } from '@/lib/ai/routing'

const KNOWN_COUNTRIES = new Set(listPhoneCountries('en').map((c) => c.iso))

/**
 * GET /api/ai/test-phones — test numbers with a simulated country
 * (any member; the inbox shows the simulated country on their chats).
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('ai_test_phones')
      .select('id, phone, country_iso')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[ai/test-phones GET] error:', error)
      return NextResponse.json({ error: 'Failed to load test numbers' }, { status: 500 })
    }
    return NextResponse.json({ phones: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/test-phones  (admin+) — add a test number or change its
 * simulated country. Body: { phone, country_iso }.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-test-phones:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const phone = phoneDigits(typeof body?.phone === 'string' ? body.phone : '')
    const country =
      typeof body?.country_iso === 'string' ? body.country_iso.trim().toUpperCase() : ''
    if (phone.length < 7 || phone.length > 15) {
      return NextResponse.json({ error: 'Número de prueba inválido.' }, { status: 400 })
    }
    if (!KNOWN_COUNTRIES.has(country)) {
      return NextResponse.json({ error: 'País inválido.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ai_test_phones')
      .upsert(
        { account_id: accountId, phone, country_iso: country },
        { onConflict: 'account_id,phone' },
      )
    if (error) {
      console.error('[ai/test-phones POST] error:', error)
      return NextResponse.json({ error: 'Failed to save test number' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/test-phones?id=…  (admin+)
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabase
      .from('ai_test_phones')
      .delete()
      .eq('account_id', accountId)
      .eq('id', id)
    if (error) {
      console.error('[ai/test-phones DELETE] error:', error)
      return NextResponse.json({ error: 'Failed to delete test number' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
