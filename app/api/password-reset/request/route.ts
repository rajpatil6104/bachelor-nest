import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'crypto';
import { findUserByEmail, getAdminClient } from '@/lib/supabase-admin';
import { mailConfigured, sendBrandedEmail } from '@/lib/server-mail';

// Step 1 of forgot-password: emails a 6-digit reset code from the app's
// Gmail account, reusing the email_otps system (hashed, 10-min expiry,
// rate-limited per email). Codes are only sent when an account actually
// exists for the email — but the response is the same either way, so the
// endpoint can't be used to probe which emails are registered.
// Setting the new password later needs the service_role key; if it isn't
// configured we refuse up front instead of sending a code that can't be
// completed.

// Best-effort per-IP throttle (the DB also rate-limits per email).
const ipHits = new Map<string, number[]>();
function ipAllowed(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= 20) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 2000) ipHits.clear();
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!ipAllowed(ip)) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, message: 'Enter a valid email address.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: 'Server not configured.' }, { status: 500 });
  }
  const admin = getAdminClient();
  if (!admin) {
    console.error('[password-reset] SUPABASE_SERVICE_ROLE_KEY is not set — reset is unavailable.');
    return NextResponse.json(
      { ok: false, message: 'Password reset is not available right now. Please contact support.' },
      { status: 503 }
    );
  }
  if (!mailConfigured()) {
    return NextResponse.json(
      { ok: false, message: 'Email service is not configured yet. Please try again later.' },
      { status: 503 }
    );
  }

  // Only real accounts get a code; unknown emails get the same response.
  const user = await findUserByEmail(admin, email);
  if (!user) return NextResponse.json({ ok: true });

  const code = randomInt(0, 1000000).toString().padStart(6, '0');
  const codeHash = createHash('sha256').update(code).digest('hex');

  const sb = createClient(url, anonKey);
  const { error: rpcError } = await sb.rpc('request_email_otp', {
    p_email: email,
    p_code_hash: codeHash,
  });
  if (rpcError) {
    if (/rate_limited/.test(rpcError.message)) {
      return NextResponse.json(
        { ok: false, message: 'Too many codes sent to this email. Please wait a while and try again.' },
        { status: 429 }
      );
    }
    console.error('[password-reset] request_email_otp failed:', rpcError);
    return NextResponse.json(
      { ok: false, message: 'Could not send the code. Please try again.' },
      { status: 500 }
    );
  }

  const { sent } = await sendBrandedEmail(
    email,
    'Reset your BachelorsNest password 🔑',
    {
      emoji: '🔐',
      heading: 'Reset your password',
      bodyHtml: `
        <p>We got a request to reset the password for your BachelorsNest account.
        Enter this 6-digit code in the app:</p>
        <div style="font-size:38px;letter-spacing:14px;font-weight:bold;color:#04334B;background-color:#f0fafa;border-radius:14px;padding:18px 12px 18px 26px;margin:20px 0;">${code}</div>
        <p style="color:#6b7280;font-size:14px;">The code expires in 10 minutes. If you didn't
        request a password reset, you can safely ignore this email — your password
        will not change.</p>`,
    },
    `Your BachelorsNest password reset code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email — your password will not change.\n\n— Team BachelorsNest`
  );
  if (!sent) {
    return NextResponse.json(
      { ok: false, message: 'Could not send the email. Please try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
