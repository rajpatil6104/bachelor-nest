import type { NextRequest } from 'next/server';

// Best-effort per-key throttle for API routes. Counters live in memory,
// so each serverless instance keeps its own — treat this as a blunt
// first layer; the hard limits live in the database (e.g. the
// email_otps functions rate-limit per email and lock after 5 tries).

const hits = new Map<string, number[]>();

export function rateLimitOk(key: string, limit = 20, windowMs = 3_600_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
