'use client';

import { useState } from 'react';

export default function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center bg-gradient-to-br from-brand-500 to-navy-800">
        <span className="text-7xl opacity-80">🏠</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-72 items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-800 sm:h-96">
        <img
          src={photos[active]}
          alt={`${title} — photo ${active + 1}`}
          className="h-full w-full object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {photos.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === active ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
