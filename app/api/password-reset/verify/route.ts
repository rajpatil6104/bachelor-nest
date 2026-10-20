import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { findUserByEmail, getAdminClient } from '@/lib/supabase-admin';

// Step 2 of forgot-password: verifies the 6-digit code via the same
// verify_email_otp() function as registration. On success it mints a
// single-use reset token (only its SHA-256 hash is stored, in
// public.password_resets) which step 3 exchanges for the new password.
// This indirection means the password itself is only ever sent once,
// together with a server-issued token — the OTP alone can't set it.

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').replace(/\D/g, '');
  if (!/^\S+@\S+\.\S+$/.test(email) || code.length !== 6) {
    return NextResponse.json({ ok: false, message: 'Enter the 6-digit code from your email.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: 'Server not configured.' }, { status: 500 });
  }
  const admin = getAdminClient();
  if (!admin) {
    // Checked BEFORE verifying so a failed config never burns the
    // single-use code.
    console.error('[password-reset] SUPABASE_SERVICE_ROLE_KEY is not set — reset is unavailable.');
    return NextResponse.json(
      { ok: false, message: 'Password reset is not available right now. Please contact support.' },
      { status: 503 }
    );
  }

  const codeHash = createHash('sha256').update(code).digest('hex');
  const sb = createClient(url, anonKey);
  const { data, error } = await sb.rpc('verify_email_otp', {
    p_email: email,
    p_code_hash: codeHash,
  });
  if (error) {
    console.error('[password-reset] verify_email_otp failed:', error);
    return NextResponse.json({ ok: false, message: 'Could not verify the code. Please try again.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired code. Check the latest email and try again.' },
      { status: 400 }
    );
  }

  const user = await findUserByEmail(admin, email);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired code. Check the latest email and try again.' },
      { status: 400 }
    );
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  // One live token per user: drop any previous ones first.
  await admin.from('password_resets').delete().eq('user_id', user.id);
  const { error: insertError } = await admin.from('password_resets').insert({
    user_id: user.id,
    email,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (insertError) {
    console.error('[password-reset] token insert failed:', insertError);
    return NextResponse.json(
      { ok: false, message: 'Could not verify the code. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, resetToken: token });
}
