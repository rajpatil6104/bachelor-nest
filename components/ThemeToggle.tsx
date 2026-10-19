'use client';

import { useTheme } from '@/lib/theme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg transition hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:hover:border-brand-400 dark:hover:text-brand-300"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
