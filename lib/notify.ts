// Sends the "you're verified" email to an owner after admin approval.
// Uses EmailJS (free tier, public key is safe in client code). If the
// NEXT_PUBLIC_EMAILJS_* vars are not configured, it no-ops gracefully and
// the caller should tell the admin the email was skipped.
// Setup guide: README.md → "Owner verification emails".

export interface NotifyResult {
  sent: boolean;
  reason?: 'not-configured' | 'no-email' | 'error';
}

export async function sendVerifiedEmail(
  toEmail: string | null,
  toName: string | null
): Promise<NotifyResult> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (!toEmail) return { sent: false, reason: 'no-email' };
  if (!serviceId || !templateId || !publicKey) {
    console.warn('[notify] EmailJS not configured — skipping verification email.');
    return { sent: false, reason: 'not-configured' };
  }

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: toEmail,
          to_name: toName ?? 'Owner',
          app_name: 'BachelorNest',
        },
      }),
    });
    if (!res.ok) {
      console.warn('[notify] EmailJS send failed:', await res.text());
      return { sent: false, reason: 'error' };
    }
    return { sent: true };
  } catch (err) {
    console.warn('[notify] EmailJS error:', err);
    return { sent: false, reason: 'error' };
  }
}
