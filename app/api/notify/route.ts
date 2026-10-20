import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { esc, sendBrandedEmail } from '@/lib/server-mail';

// Sends the "you're verified" email from the app's Gmail account.
// Only admins can call this (the caller's Supabase JWT is validated and
// their profile role is checked). Gmail credentials live in server-only env
// vars, never in the browser. The shared branding/sending lives in
// lib/server-mail.ts.

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

  // Run DB queries AS the calling user: RLS policies (e.g. "users read own
  // profile") read auth.uid() from the request's JWT. With only the anon key,
  // auth.uid() is null, the profile lookup returns nothing, and every admin
  // gets a false "forbidden".
  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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

  const name = (body.toName ?? 'there').trim() || 'there';
  const res = await sendBrandedEmail(
    body.toEmail,
    "You're verified on BachelorNest 🎉",
    {
      emoji: '🎉',
      heading: `You're verified, ${esc(name)}!`,
      bodyHtml:
        `<p>Your owner account on <b>BachelorNest</b> has been approved. You can now log in, ` +
        `list your PG, hostel, flat or room — and reach thousands of bachelors looking for a stay.</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fafa;border-radius:12px;margin-top:16px;">` +
        `<tr><td style="padding:16px 20px;font-size:13px;color:#0e7490;line-height:1.7;">` +
        `<b>What you can do next</b><br/>` +
        `✓ Add your buildings with the step-by-step wizard<br/>` +
        `✓ Manage vacancies &amp; occupancy in real time<br/>` +
        `✓ Chat directly with interested bachelors — zero brokerage` +
        `</td></tr></table>`,
      ctaText: 'Log in & add your stays',
      ctaPath: '/login',
    },
    `Hi ${name},\n\nYour owner account on BachelorNest has been verified. You can now log in and add your stays.\n\n— Team BachelorNest`
  );
  return NextResponse.json(res);
}
