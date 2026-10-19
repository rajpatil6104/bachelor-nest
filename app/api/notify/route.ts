import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Sends the "you're verified" email from the app's Gmail account.
// Only admins can call this (the caller's Supabase JWT is validated and
// their profile role is checked). Gmail credentials live in server-only env
// vars, never in the browser.

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

    const name = body.toName ?? 'there';
    await transporter.sendMail({
      from: `"BachelorNest" <${gmailUser}>`,
      to: body.toEmail,
      subject: "You're verified on BachelorNest 🎉",
      text:
        `Hi ${name},\n\n` +
        `Your owner account on BachelorNest has been verified. ` +
        `You can now log in and add your stays.\n\n` +
        `— Team BachelorNest`,
      html:
        `<p>Hi ${name},</p>` +
        `<p>Your owner account on <b>BachelorNest</b> has been verified. ` +
        `You can now log in and add your stays.</p>` +
        `<p>— Team BachelorNest</p>`,
    });
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('[notify] Gmail send failed:', err);
    return NextResponse.json({ sent: false, reason: 'error' });
  }
}
