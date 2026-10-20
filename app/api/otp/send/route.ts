import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createHash, randomInt } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

// Generates a 6-digit OTP and emails it from the app's Gmail account.
// Supabase itself sends nothing — codes are stored hashed in public.email_otps
// via the request_email_otp() function (rate-limited per email).

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

function otpEmailHtml(code: string, hasLogo: boolean): string {
  const logoBlock = hasLogo
    ? `<img src="cid:bachelorsnest-logo" alt="BachelorsNest" width="110" style="display:block;margin:0 auto;border:0;" />`
    : `<div style="font-size:30px;font-weight:bold;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">BachelorsNest</div>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#eef4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td style="background-color:#04334B;padding:28px 32px;" align="center">
${logoBlock}
<div style="color:#42BFBC;font-size:13px;font-weight:bold;letter-spacing:3px;margin-top:10px;">BACHELORSNEST</div>
</td></tr>
<tr><td style="padding:36px 36px 12px;" align="center">
<h1 style="color:#04334B;font-size:24px;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Your verification code</h1>
<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0;font-family:Arial,Helvetica,sans-serif;">
Enter this 6-digit code in the app to verify your email:
</p>
<div style="font-size:38px;letter-spacing:14px;font-weight:bold;color:#04334B;background-color:#f0fafa;border-radius:14px;padding:18px 12px 18px 26px;margin:20px 0;font-family:Arial,Helvetica,sans-serif;">${code}</div>
<p style="color:#9ca3af;font-size:13px;margin:0;font-family:Arial,Helvetica,sans-serif;">
This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
</p>
</td></tr>
<tr><td align="center" style="padding:16px 36px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;">
— Team BachelorsNest 🪹
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!ipAllowed(ip)) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: { email?: string; name?: string };
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
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: 'Server not configured.' }, { status: 500 });
  }
  if (!gmailUser || !gmailPass) {
    return NextResponse.json(
      { ok: false, message: 'Email service is not configured yet. Please try again later.' },
      { status: 503 }
    );
  }

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
    console.error('[otp] request_email_otp failed:', rpcError);
    return NextResponse.json(
      { ok: false, message: 'Could not send the code. Please try again.' },
      { status: 500 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    let attachments: { filename: string; content: Buffer; cid: string }[] = [];
    try {
      const logo = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
      attachments = [{ filename: 'logo.png', content: logo, cid: 'bachelorsnest-logo' }];
    } catch {
      attachments = [];
    }

    await transporter.sendMail({
      from: `"BachelorsNest" <${gmailUser}>`,
      to: email,
      subject: 'Your BachelorsNest verification code 🔑',
      text: `Your BachelorsNest verification code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.\n\n— Team BachelorsNest`,
      html: otpEmailHtml(code, attachments.length > 0),
      attachments,
    });
  } catch (err) {
    console.error('[otp] Gmail send failed:', err);
    return NextResponse.json(
      { ok: false, message: 'Could not send the email. Please try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
