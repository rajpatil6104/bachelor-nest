'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { geocode } from '@/lib/geo';

// Pin picker for the listing wizard + edit form. "Find my address"
// geocodes the typed address; the owner can also tap the map or drag
// the pin to the exact spot. Optional — listings without a pin fall
// back to locality-level geocoding on the search map.
export default function LocationPicker({
  lat,
  lng,
  addressHint,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  addressHint: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any;
    place: (la: number, ln: number) => void;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialRef = useRef({ lat, lng });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;
      const init = initialRef.current;
      const hasPin = typeof init.lat === 'number' && typeof init.lng === 'number';
      const map = L.map(containerRef.current).setView(
        hasPin ? [init.lat, init.lng] : [20.5937, 78.9629],
        hasPin ? 15 : 4
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'bn-pin-wrap',
        html: `<div class="bn-pin bn-pin-picker">📍</div>`,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let marker: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const place = (la: number, ln: number) => {
        if (marker) {
          marker.setLatLng([la, ln]);
        } else {
          marker = L.marker([la, ln], { icon: pinIcon, draggable: true }).addTo(map);
          marker.on('dragend', () => {
            const p = marker.getLatLng();
            onChangeRef.current(p.lat, p.lng);
          });
        }
      };
      if (hasPin) place(init.lat as number, init.lng as number);
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        place(e.latlng.lat, e.latlng.lng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
        setNote('');
      });
      stateRef.current = { map, place };
    })();
    return () => {
      cancelled = true;
      if (stateRef.current) {
        stateRef.current.map.remove();
        stateRef.current = null;
      }
    };
    // Init once — initial pin comes from props at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function findAddress() {
    if (!addressHint.trim()) {
      setNote('Fill in the city, locality and address first, then try again.');
      return;
    }
    setBusy(true);
    setNote('');
    const hit = await geocode(addressHint);
    setBusy(false);
    const st = stateRef.current;
    if (!hit || !st) {
      setNote("Couldn't find that address — tap the map to drop the pin instead.");
      return;
    }
    st.place(hit.lat, hit.lng);
    st.map.flyTo([hit.lat, hit.lng], 15);
    onChange(hit.lat, hit.lng);
    setNote('Pin placed — drag it if it is slightly off.');
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="isolate z-0 h-64 w-full overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-700"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={findAddress}
          disabled={busy}
          className="rounded-xl bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          {busy ? 'Searching…' : '📍 Find my address'}
        </button>
        <span className="text-sm text-zinc-500">
          {typeof lat === 'number' && typeof lng === 'number'
            ? 'Pin set ✓ — tap the map or drag to adjust.'
            : 'No pin yet — the map search will use your locality.'}
        </span>
      </div>
      {note && <p className="mt-1 text-sm text-brand-700 dark:text-brand-300">{note}</p>}
    </div>
  );
}
