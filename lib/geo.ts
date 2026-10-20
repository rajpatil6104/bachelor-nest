// Geocoding via OpenStreetMap's Nominatim — free, no API key. Results are
// cached in localStorage, and requests go through a queue spaced ~1.1s
// apart to respect Nominatim's usage policy (the cache makes repeat
// visits instant, so the queue only drains once per area).

import { Listing } from './types';

export interface Coords {
  lat: number;
  lng: number;
}

const CACHE_KEY = 'bn-geocode-v1';

function readCache(): Record<string, Coords | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, Coords | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full/blocked — geocoding still works, just uncached.
  }
}

let queue: Promise<unknown> = Promise.resolve();
let lastRun = 0;

async function fetchNominatim(query: string): Promise<Coords | null> {
  const run = async (): Promise<Coords | null> => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRun));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRun = Date.now();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

export async function geocode(query: string): Promise<Coords | null> {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!q) return null;
  const cache = readCache();
  if (q in cache) return cache[q];
  const hit = await fetchNominatim(q);
  cache[q] = hit;
  writeCache(cache);
  return hit;
}

// Small deterministic offset so several stays in the same locality don't
// stack on one pin (only applied to geocoded, approximate positions).
function jitter(id: string): { dLat: number; dLng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return {
    dLat: ((h % 100) / 100 - 0.5) * 0.004,
    dLng: (((h >> 8) % 100) / 100 - 0.5) * 0.004,
  };
}

// Where should this listing's pin go? Stored pin first, then geocode the
// address, then the locality. Null when nothing resolves.
export async function resolveListingCoords(l: Listing): Promise<Coords | null> {
  if (typeof l.lat === 'number' && typeof l.lng === 'number') {
    return { lat: l.lat, lng: l.lng };
  }
  const byLocality = await geocode(`${l.locality}, ${l.city}, India`);
  if (byLocality) {
    const j = jitter(l.id);
    return { lat: byLocality.lat + j.dLat, lng: byLocality.lng + j.dLng };
  }
  return geocode(`${l.city}, India`);
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
