// Server-only mailer shared by the API routes. Sends branded BachelorsNest
// emails from the app's Gmail account (GMAIL_USER + GMAIL_APP_PASSWORD in
// .env.local — never exposed to the browser). Used by /api/notify (owner
// verified) and /api/notify-event (visit + alert notifications).
// If Gmail isn't configured, sends no-op gracefully.

import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import path from 'path';

export function mailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function siteUrl(): string | null {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || null;
}

let logoCache: Buffer | null | undefined;
async function loadLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// Escape user-generated text before putting it into an email's HTML.
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BrandedEmail {
  emoji: string;
  heading: string;
  bodyHtml: string; // paragraphs, already-escaped HTML
  ctaText?: string;
  ctaPath?: string; // e.g. '/owner' — joined with NEXT_PUBLIC_SITE_URL
}

export async function renderBrandedEmail(e: BrandedEmail): Promise<string> {
  const logo = await loadLogo();
  const url = siteUrl();
  const logoBlock = logo
    ? `<img src="cid:bachelorsnest-logo" alt="BachelorsNest" width="110" style="display:block;margin:0 auto;border:0;" />`
    : `<div style="font-size:30px;font-weight:bold;color:#ffffff;">BachelorsNest</div>`;
  const cta =
    e.ctaText && e.ctaPath && url
      ? `<tr><td align="center" style="padding:8px 0 8px;">
           <a href="${url}${e.ctaPath}" style="display:inline-block;background-color:#04334B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 40px;border-radius:12px;">${esc(e.ctaText)}</a>
         </td></tr>`
      : '';

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
<div style="font-size:44px;">${e.emoji}</div>
<h1 style="color:#04334B;font-size:26px;margin:12px 0 8px;font-family:Arial,Helvetica,sans-serif;">${e.heading}</h1>
<div style="color:#4b5563;font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
${e.bodyHtml}
</div>
</td></tr>
${cta}
<tr><td align="center" style="padding:20px 36px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;">
— Team BachelorsNest 🪹
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendBrandedEmail(
  to: string,
  subject: string,
  email: BrandedEmail,
  textFallback: string
): Promise<{ sent: boolean; reason?: string }> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return { sent: false, reason: 'not-configured' };

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    const logo = await loadLogo();
    await transporter.sendMail({
      from: `"BachelorsNest" <${gmailUser}>`,
      to,
      subject,
      text: textFallback,
      html: await renderBrandedEmail(email),
      attachments: logo
        ? [{ filename: 'logo.png', content: logo, cid: 'bachelorsnest-logo' }]
        : [],
    });
    return { sent: true };
  } catch (err) {
    console.warn('[mail] send failed:', err);
    return { sent: false, reason: 'error' };
  }
}
