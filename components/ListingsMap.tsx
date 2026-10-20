'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Listing, listingAvailableBeds, minRent } from '@/lib/types';
import { escHtml, resolveListingCoords } from '@/lib/geo';

// Search-results map (Leaflet + OpenStreetMap, no API key). Each stay is
// a price pin; listings with a stored pin use it exactly, the rest are
// geocoded from locality + city (cached — see lib/geo.ts). Clicking a pin
// shows a small card linking to the listing.
export default function ListingsMap({ listings }: { listings: Listing[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readyRef = useRef<Promise<{ L: any; map: any; layer: any }> | null>(null);
  const [locating, setLocating] = useState(true);
  const [placed, setPlaced] = useState(0);

  function ensureMap() {
    if (!readyRef.current) {
      readyRef.current = (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L: any = (await import('leaflet')).default;
        const map = L.map(containerRef.current).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        return { L, map, layer };
      })();
    }
    return readyRef.current;
  }

  // Unmount cleanup only
  useEffect(() => {
    return () => {
      if (readyRef.current) {
        readyRef.current.then(({ map }) => map.remove()).catch(() => undefined);
        readyRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { L, map, layer } = await ensureMap();
      if (cancelled) return;
      setLocating(true);
      layer.clearLayers();
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bounds: any[] = [];
      for (const l of listings) {
        const coords = await resolveListingCoords(l);
        if (cancelled) return;
        if (!coords) continue;
        const rent = minRent(l);
        const beds = listingAvailableBeds(l);
        const icon = L.divIcon({
          className: 'bn-pin-wrap',
          html: `<div class="bn-pin">₹${rent.toLocaleString('en-IN')}</div>`,
        });
        const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(layer);
        marker.bindPopup(
          `<div style="min-width:190px;font-family:Arial,sans-serif;">` +
            (l.photos[0]
              ? `<img src="${escHtml(l.photos[0])}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px;" />`
              : '') +
            `<b style="font-size:14px;">${escHtml(l.title)}</b><br/>` +
            `<span style="color:#666;font-size:12px;">${escHtml(l.locality)}, ${escHtml(l.city)}</span><br/>` +
            `<span style="color:${beds > 0 ? '#059669' : '#dc2626'};font-weight:600;font-size:12px;">` +
            `${beds} ${l.type === 'flat' ? 'spaces' : 'beds'} available</span>` +
            `<span style="font-size:12px;"> · ₹${rent.toLocaleString('en-IN')}/mo</span><br/>` +
            `<a href="/listing/${l.id}" style="color:#0e7490;font-weight:600;font-size:13px;">View stay →</a>` +
            `</div>`
        );
        bounds.push([coords.lat, coords.lng]);
        count++;
      }
      if (cancelled) return;
      setPlaced(count);
      setLocating(false);
      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listings]);

  return (
    <div className="relative mt-4">
      <div
        ref={containerRef}
        className="isolate z-0 h-[480px] w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
      />
      {(locating || (placed === 0 && !locating)) && (
        <p className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow dark:bg-zinc-900/90 dark:text-zinc-300">
          {locating ? '📍 Locating stays…' : 'No locations found for these stays'}
        </p>
      )}
      {!locating && placed > 0 && (
        <p className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow dark:bg-zinc-900/90 dark:text-zinc-300">
          📍 {placed} stay{placed === 1 ? '' : 's'} on the map — pins show rent/month
        </p>
      )}
    </div>
  );
}
