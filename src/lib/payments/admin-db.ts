import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null

/**
 * Lazy-initialised service-role client for the public (session-less)
 * payment routes — same pattern as the `supabaseAdmin()` copies in
 * `src/app/api/public/payments/**`. RLS can't scope these requests,
 * so every caller filters explicitly (published form, funnel token…).
 */
export function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}
