import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { esc, mailConfigured, sendBrandedEmail } from '@/lib/server-mail';

// Event emails for the visit lifecycle + vacancy alerts, sent from the
// app's Gmail account:
//   visit_requested          → owner gets "new visit request"
//   visit_accepted/rejected  → tenant gets the owner's decision
//   visit_done               → tenant gets "review this stay"
//   listing_approved_alerts  → tenants whose vacancy alerts match a
//                              newly approved listing get an email
// The caller's Supabase JWT is forwarded so every query runs as them
// under RLS; the route verifies they are a party to the inquiry (or an
// admin, for alerts) before emailing anyone. Contact emails come from
// the SECURITY DEFINER helpers in supabase/migration_notifications.sql.

type EventType =
  | 'visit_requested'
  | 'visit_accepted'
  | 'visit_rejected'
  | 'visit_done'
  | 'listing_approved_alerts';

const firstName = (full: string | null | undefined) =>
  (full ?? 'there').trim().split(/\s+/)[0] || 'there';

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

  if (!mailConfigured()) {
    return NextResponse.json({ sent: false, reason: 'not-configured' });
  }

  let body: { type?: EventType; inquiryId?: string; listingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sent: false, reason: 'error' }, { status: 400 });
  }

  // ---------- Vacancy-alert matches (admin approves a listing) ----------
  if (body.type === 'listing_approved_alerts') {
    if (!body.listingId) {
      return NextResponse.json({ sent: false, reason: 'error' }, { status: 400 });
    }
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ sent: false, reason: 'forbidden' }, { status: 403 });
    }
    const { data: listing } = await sb
      .from('listings')
      .select('title, city, locality')
      .eq('id', body.listingId)
      .single();
    if (!listing) {
      return NextResponse.json({ sent: false, reason: 'not-found' }, { status: 404 });
    }
    const { data: matches } = await sb.rpc('alert_matches_for_listing', {
      p_listing_id: body.listingId,
    });
    const rows = ((matches ?? []) as { email: string; full_name: string | null }[])
      .filter((r) => r.email)
      .slice(0, 50);

    let count = 0;
    for (const r of rows) {
      const name = firstName(r.full_name);
      const res = await sendBrandedEmail(
        r.email,
        `New stay in ${listing.city} matching your alert 🏠`,
        {
          emoji: '🏠',
          heading: 'A new stay just landed',
          bodyHtml:
            `<p>Hi ${esc(name)},</p>` +
            `<p><b>${esc(listing.title)}</b> in ${esc(listing.locality)}, ${esc(listing.city)} ` +
            `just went live and matches your vacancy alert. Good stays go fast — take a look before the beds fill up.</p>`,
          ctaText: 'View this stay',
          ctaPath: `/listing/${body.listingId}`,
        },
        `Hi ${name}, ${listing.title} in ${listing.locality}, ${listing.city} just went live and matches your vacancy alert on BachelorNest.`
      );
      if (res.sent) count++;
    }
    return NextResponse.json({ sent: count > 0, count });
  }

  // ---------- Visit lifecycle (needs an inquiry) ----------
  if (!body.inquiryId || !body.type) {
    return NextResponse.json({ sent: false, reason: 'error' }, { status: 400 });
  }
  const { data: inquiry } = await sb
    .from('inquiries')
    .select('id, listing_id, tenant_id, preferred_date, message')
    .eq('id', body.inquiryId)
    .single();
  if (!inquiry) {
    return NextResponse.json({ sent: false, reason: 'not-found' }, { status: 404 });
  }
  const { data: listing } = await sb
    .from('listings')
    .select('title, owner_id')
    .eq('id', inquiry.listing_id)
    .single();
  const title = listing?.title ?? 'a stay on BachelorNest';

  if (body.type === 'visit_requested') {
    if (inquiry.tenant_id !== user.id) {
      return NextResponse.json({ sent: false, reason: 'forbidden' }, { status: 403 });
    }
    const { data: me } = await sb
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const { data: contact } = await sb.rpc('owner_contact', {
      p_listing_id: inquiry.listing_id,
    });
    const owner = (contact as { email: string; full_name: string | null }[] | null)?.[0];
    if (!owner?.email) {
      return NextResponse.json({ sent: false, reason: 'no-email' });
    }
    const tenantName = me?.full_name ?? 'A bachelor';
    const res = await sendBrandedEmail(
      owner.email,
      `New visit request — ${title}`,
      {
        emoji: '📅',
        heading: 'You have a new visit request',
        bodyHtml:
          `<p>Hi ${esc(firstName(owner.full_name))},</p>` +
          `<p><b>${esc(tenantName)}</b> wants to visit <b>${esc(title)}</b>` +
          (inquiry.preferred_date ? ` on <b>${esc(inquiry.preferred_date)}</b>` : '') +
          `.</p>` +
          (inquiry.message ? `<p style="font-style:italic;">“${esc(inquiry.message)}”</p>` : '') +
          `<p>Open your dashboard to accept or decline the request.</p>`,
        ctaText: 'View visit requests',
        ctaPath: '/owner',
      },
      `Hi, ${tenantName} wants to visit ${title}${inquiry.preferred_date ? ` on ${inquiry.preferred_date}` : ''}. Open your BachelorNest dashboard to respond.`
    );
    return NextResponse.json(res);
  }

  if (
    body.type === 'visit_accepted' ||
    body.type === 'visit_rejected' ||
    body.type === 'visit_done'
  ) {
    if (!listing || listing.owner_id !== user.id) {
      return NextResponse.json({ sent: false, reason: 'forbidden' }, { status: 403 });
    }
    const { data: contact } = await sb.rpc('inquiry_tenant_contact', {
      p_inquiry_id: inquiry.id,
    });
    const tenant = (contact as { email: string; full_name: string | null }[] | null)?.[0];
    if (!tenant?.email) {
      return NextResponse.json({ sent: false, reason: 'no-email' });
    }
    const name = firstName(tenant.full_name);

    if (body.type === 'visit_accepted') {
      const res = await sendBrandedEmail(
        tenant.email,
        `Visit accepted — ${title} 🎉`,
        {
          emoji: '🎉',
          heading: 'Your visit is accepted!',
          bodyHtml:
            `<p>Hi ${esc(name)},</p>` +
            `<p>Great news — the owner of <b>${esc(title)}</b> accepted your visit request` +
            (inquiry.preferred_date ? ` for <b>${esc(inquiry.preferred_date)}</b>` : '') +
            `. Message them in the app to fix a time that works.</p>`,
          ctaText: 'See my visits',
          ctaPath: '/visits',
        },
        `Hi ${name}, the owner of ${title} accepted your visit request on BachelorNest.`
      );
      return NextResponse.json(res);
    }

    if (body.type === 'visit_rejected') {
      const res = await sendBrandedEmail(
        tenant.email,
        `Visit update — ${title}`,
        {
          emoji: '🏠',
          heading: "This one didn't work out",
          bodyHtml:
            `<p>Hi ${esc(name)},</p>` +
            `<p>The owner of <b>${esc(title)}</b> couldn't take your visit request this time. ` +
            `Don't worry — plenty of bachelor-friendly stays are waiting for you.</p>`,
          ctaText: 'Find other stays',
          ctaPath: '/search',
        },
        `Hi ${name}, the owner of ${title} couldn't take your visit request. Find other stays on BachelorNest.`
      );
      return NextResponse.json(res);
    }

    // visit_done
    const res = await sendBrandedEmail(
      tenant.email,
      `Visit completed — ${title} ⭐`,
      {
        emoji: '⭐',
        heading: 'How was your visit?',
        bodyHtml:
          `<p>Hi ${esc(name)},</p>` +
          `<p>The owner confirmed your visit to <b>${esc(title)}</b>. You can now ` +
          `review this stay — honest reviews help other bachelors choose well.</p>`,
        ctaText: 'Review this stay',
        ctaPath: `/listing/${inquiry.listing_id}`,
      },
      `Hi ${name}, your visit to ${title} is confirmed complete. You can now review this stay on BachelorNest.`
    );
    return NextResponse.json(res);
  }

  return NextResponse.json({ sent: false, reason: 'error' }, { status: 400 });
}
