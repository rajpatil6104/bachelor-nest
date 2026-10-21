import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { clientIp, rateLimitOk } from '@/lib/rate-limit';

// Verifies a 6-digit OTP previously issued by /api/otp/send.
// The code itself never leaves the server unhashed; verification happens
// inside the verify_email_otp() SECURITY DEFINER function.

export async function POST(req: NextRequest) {
  // The DB locks a code after 5 wrong tries; this IP cap is a second layer.
  if (!rateLimitOk(`otp-verify:${clientIp(req)}`, 30)) {
    return NextResponse.json(
      { ok: false, message: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }
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

  const codeHash = createHash('sha256').update(code).digest('hex');
  const sb = createClient(url, anonKey);
  const { data, error } = await sb.rpc('verify_email_otp', {
    p_email: email,
    p_code_hash: codeHash,
  });
  if (error) {
    console.error('[otp] verify_email_otp failed:', error);
    return NextResponse.json({ ok: false, message: 'Could not verify the code. Please try again.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired code. Check the latest email and try again.' },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
