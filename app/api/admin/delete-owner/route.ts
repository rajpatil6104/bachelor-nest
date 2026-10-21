import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';

// Permanently deletes an OWNER account from the admin Owners directory.
// The caller must be a signed-in admin (verified from their own JWT, with
// the token forwarded so RLS sees the real user — an anon-key-only client
// would look like nobody). The actual deletion uses the service_role key
// server-side; the owner's profile, listings, rooms and listing-linked
// data follow via ON DELETE CASCADE.
// Tenants and admins are refused here on purpose — this endpoint exists
// only for owner policy enforcement.

export async function POST(req: NextRequest) {
  let body: { ownerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }
  const ownerId = (body.ownerId ?? '').trim();
  if (!ownerId) {
    return NextResponse.json({ ok: false, message: 'Missing owner id.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: 'Server not configured.' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });
  }
  const { data: callerProfile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admins only.' }, { status: 403 });
  }
  if (ownerId === userData.user.id) {
    return NextResponse.json({ ok: false, message: 'You cannot delete your own account.' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    console.error('[admin] SUPABASE_SERVICE_ROLE_KEY is not set — owner deletion unavailable.');
    return NextResponse.json(
      { ok: false, message: 'Account deletion is not configured on the server yet (missing service role key).' },
      { status: 503 }
    );
  }

  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', ownerId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ ok: false, message: 'Owner not found.' }, { status: 404 });
  }
  if (target.role !== 'owner') {
    return NextResponse.json({ ok: false, message: 'Only owner accounts can be deleted here.' }, { status: 400 });
  }

  // Remove the owner's listings first so listing-linked rows (rooms,
  // inquiries, reports, favorites, alerts) cascade away cleanly even if
  // one of their own foreign keys is stricter than expected.
  const { error: listingsError } = await admin.from('listings').delete().eq('owner_id', ownerId);
  if (listingsError) {
    console.error('[admin] pre-delete listings failed:', listingsError);
    return NextResponse.json(
      { ok: false, message: 'Could not delete the owner’s listings. Nothing was removed.' },
      { status: 500 }
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(ownerId);
  if (deleteError) {
    console.error('[admin] deleteUser failed:', deleteError);
    return NextResponse.json(
      { ok: false, message: 'The listings were removed, but the account itself could not be deleted. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
