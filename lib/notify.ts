// Sends the "you're verified" email to an owner after admin approval.
// Goes through the server-side /api/notify route, which sends it from the
// app's Gmail account (GMAIL_USER + GMAIL_APP_PASSWORD in .env.local).
// The route validates that the caller is an admin, so the credentials never
// touch the browser. If Gmail isn't configured, it no-ops gracefully.
// Setup guide: README.md → "Owner verification emails".

import { getSupabase } from './supabase';

export interface NotifyResult {
  sent: boolean;
  reason?: 'not-configured' | 'no-email' | 'error' | 'unauthorized' | 'forbidden';
}

export async function sendVerifiedEmail(
  toEmail: string | null,
  toName: string | null
): Promise<NotifyResult> {
  if (!toEmail) return { sent: false, reason: 'no-email' };

  const sb = getSupabase();
  if (!sb) return { sent: false, reason: 'error' };

  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { sent: false, reason: 'unauthorized' };

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ toEmail, toName }),
    });
    const json = (await res.json()) as NotifyResult;
    return { sent: !!json.sent, reason: json.reason };
  } catch (err) {
    console.warn('[notify] request failed:', err);
    return { sent: false, reason: 'error' };
  }
}

export type NotifyEventType =
  | 'visit_requested'
  | 'visit_accepted'
  | 'visit_rejected'
  | 'visit_done'
  | 'listing_approved_alerts';

// Fire-and-forget event email via /api/notify-event (visit lifecycle +
// vacancy-alert matches). Never throws and never blocks the UI — if Gmail
// isn't configured or anything fails, the app carries on silently.
// No-op in demo mode (no Supabase session).
export async function notifyEvent(
  type: NotifyEventType,
  payload: { inquiryId?: string; listingId?: string }
): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/notify-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    });
  } catch {
    // Notifications are best-effort only.
  }
}
