import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function cleanUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  // Strip whitespace and accidental surrounding quotes
  const url = raw.trim().replace(/^["']+|["']+$/g, '');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function getSupabase(): SupabaseClient | null {
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !url
    ) {
      console.warn(
        '[BachelorNest] NEXT_PUBLIC_SUPABASE_URL is set but not a valid URL — running in demo mode. Check your .env.local:',
        JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL)
      );
    }
    return null;
  }
  if (!client) client = createClient(url, key);
  return client;
}

export const isSupabaseConfigured = () =>
  cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) !== null &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
