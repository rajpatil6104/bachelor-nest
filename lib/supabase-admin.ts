// Server-only Supabase client using the service_role key. It bypasses RLS
// and can manage auth users — the forgot-password routes use it to find an
// account by email and set a new password after OTP verification.
// NEVER import this from client code, and never give the key a NEXT_PUBLIC_
// prefix: it is a full-access secret that lives only in .env.local / the
// host's env settings (SUPABASE_SERVICE_ROLE_KEY).

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Finds an auth user by email (case-insensitive), paging the admin user
// list. Returns null when no account uses that email.
export async function findUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}
