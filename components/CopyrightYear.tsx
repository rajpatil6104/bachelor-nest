'use client';

import { useEffect, useState } from 'react';

// Computed in the browser so the copyright year is always current —
// never baked in at build time, never a stale hardcoded year.
export default function CopyrightYear() {
  const [year, setYear] = useState('');
  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);
  return <>{year}</>;
}
