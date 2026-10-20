import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';

// Step 3 of forgot-password: exchanges the single-use reset token (issued
// by step 2 after OTP verification) for a new password, set through the
// Supabase admin API. The token is looked up by its SHA-256 hash, must be
// unused and unexpired, and is marked used before returning so it can
// never be replayed.

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const password = body.password ?? '';
  if (!token) {
    return NextResponse.json(
      { ok: false, message: 'This reset session has expired. Please start again.' },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, message: 'Password must be at least 6 characters.' },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    console.error('[password-reset] SUPABASE_SERVICE_ROLE_KEY is not set — reset is unavailable.');
    return NextResponse.json(
      { ok: false, message: 'Password reset is not available right now. Please contact support.' },
      { status: 503 }
    );
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: row, error: lookupError } = await admin
    .from('password_resets')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (lookupError) {
    console.error('[password-reset] token lookup failed:', lookupError);
    return NextResponse.json(
      { ok: false, message: 'Could not update the password. Please try again.' },
      { status: 500 }
    );
  }
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, message: 'This reset session has expired. Please start again.' },
      { status: 400 }
    );
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, { password });
  if (updateError) {
    console.error('[password-reset] updateUserById failed:', updateError);
    return NextResponse.json(
      { ok: false, message: 'Could not update the password. Please try again.' },
      { status: 500 }
    );
  }

  await admin
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id);

  return NextResponse.json({ ok: true });
}
