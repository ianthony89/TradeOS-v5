// ============================================================
//  Admin route guard + service-role client
//  Shared by all /api/admin/* routes.
//
//  Security model: verify the CALLER is an admin (via their own
//  authenticated session + own-row profile read, which RLS allows),
//  THEN return a service-role client for the privileged work.
//  Never trust a client-supplied "I am admin" flag.
// ============================================================

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient }  from '@supabase/supabase-js'

/** Service-role client — bypasses RLS, server-only, never sent to browser. */
export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Returns the authenticated admin's user id, or null if the caller is
 * not signed in / not an admin. Routes must 403 when this is null.
 */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // RLS allows reading your OWN profile row, so the session client is enough.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin === true ? user.id : null
}
