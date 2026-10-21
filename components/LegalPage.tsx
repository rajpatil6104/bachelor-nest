import type { ReactNode } from 'react';

// Shared shell for the legal pages (Privacy, Terms, Cookies) so they
// read consistently. Pure server component — no client JavaScript.
export default function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated: 21 October 2026</p>
      <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-300">{intro}</p>
      {children}
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mt-8 text-xl font-semibold">{heading}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-zinc-600 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}
