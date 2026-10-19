import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import path from 'path';

// Sends the "you're verified" email from the app's Gmail account.
// Only admins can call this (the caller's Supabase JWT is validated and
// their profile role is checked). Gmail credentials live in server-only env
// vars, never in the browser.

function verificationEmailHtml(
  name: string,
  hasLogo: boolean,
  siteUrl: string | null
): string {
  const logoBlock = hasLogo
    ? `<img src="cid:bachelornest-logo" alt="BachelorNest" width="110" style="display:block;margin:0 auto;border:0;" />`
    : `<div style="font-size:30px;font-weight:bold;color:#04334B;">BachelorNest</div>`;

  const cta = siteUrl
    ? `<tr><td align="center" style="padding:8px 0 8px;">
         <a href="${siteUrl}/login" style="display:inline-block;background-color:#04334B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 40px;border-radius:12px;">Log in &amp; add your stays</a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#eef4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td style="background-color:#04334B;padding:28px 32px;" align="center">
${logoBlock}
<div style="color:#42BFBC;font-size:13px;font-weight:bold;letter-spacing:3px;margin-top:10px;">BACHELORNEST</div>
</td></tr>
<tr><td style="padding:36px 36px 12px;" align="center">
<div style="font-size:44px;">🎉</div>
<h1 style="color:#04334B;font-size:26px;margin:12px 0 8px;font-family:Arial,Helvetica,sans-serif;">You're verified, ${name}!</h1>
<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0;font-family:Arial,Helvetica,sans-serif;">
Your owner account on <b>BachelorNest</b> has been approved. You can now log in,
list your PG, hostel, flat or room — and reach thousands of bachelors looking for a stay.
</p>
</td></tr>
${cta}
<tr><td style="padding:12px 36px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fafa;border-radius:12px;">
<tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0e7490;line-height:1.7;">
<b>What you can do next</b><br/>
✓ Add your buildings with the step-by-step wizard<br/>
✓ Manage vacancies &amp; occupancy in real time<br/>
✓ Chat directly with interested bachelors — zero brokerage
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:20px 36px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;">
— Team BachelorNest 🪹
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ sent: false, reason: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ sent: false, reason: 'error' }, { status: 500 });
  }

  const sb = createClient(url, anonKey);
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ sent: false, reason: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ sent: false, reason: 'forbidden' }, { status: 403 });
  }

  let body: { toEmail?: string; toName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sent: false, reason: 'error' }, { status: 400 });
  }
  if (!body.toEmail) {
    return NextResponse.json({ sent: false, reason: 'no-email' }, { status: 400 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return NextResponse.json({ sent: false, reason: 'not-configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    const name = (body.toName ?? 'there').trim() || 'there';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || null;

    // Embed the logo so it shows even without a deployed site URL
    let attachments: { filename: string; content: Buffer; cid: string }[] = [];
    try {
      const logo = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
      attachments = [{ filename: 'logo.png', content: logo, cid: 'bachelornest-logo' }];
    } catch {
      attachments = [];
    }

    await transporter.sendMail({
      from: `"BachelorNest" <${gmailUser}>`,
      to: body.toEmail,
      subject: "You're verified on BachelorNest 🎉",
      text:
        `Hi ${name},\n\n` +
        `Your owner account on BachelorNest has been verified. ` +
        `You can now log in and add your stays.\n\n` +
        `— Team BachelorNest`,
      html: verificationEmailHtml(name, attachments.length > 0, siteUrl),
      attachments,
    });
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('[notify] Gmail send failed:', err);
    return NextResponse.json({ sent: false, reason: 'error' });
  }
}
