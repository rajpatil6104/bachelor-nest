'use client';

import { useEffect, useState } from 'react';

export default function NewBadge({ createdAt }: { createdAt?: string }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    setIsNew(
      createdAt != null &&
        Date.now() - new Date(createdAt).getTime() < 7 * 24 * 3600 * 1000
    );
  }, [createdAt]);

  if (!isNew) return null;
  return (
    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
      NEW
    </span>
  );
}
