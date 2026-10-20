import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page wandered off. Find bachelor-friendly stays on BachelorNest instead.',
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <img src="/logo.png" alt="BachelorNest logo" className="mx-auto h-20 w-auto" />
      <p className="mt-6 text-6xl font-black tracking-tight text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold">This nest is empty 🪹</h1>
      <p className="mt-2 text-zinc-500">
        The page you're looking for doesn't exist or may have moved. Let's get
        you back to finding a stay.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Go home
        </Link>
        <Link
          href="/search"
          className="rounded-xl border border-zinc-300 px-6 py-3 font-semibold hover:border-brand-500 dark:border-zinc-700"
        >
          Find a stay
        </Link>
      </div>
    </div>
  );
}
