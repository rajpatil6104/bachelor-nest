import Link from 'next/link';
import CopyrightYear from './CopyrightYear';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Explore',
    links: [
      { href: '/search', label: 'Find a stay' },
      { href: '/saved', label: 'Saved stays' },
      { href: '/alerts', label: 'Vacancy alerts' },
      { href: '/visits', label: 'My visits' },
    ],
  },
  {
    heading: 'Owners',
    links: [
      { href: '/register', label: 'List your property' },
      { href: '/owner', label: 'Owner dashboard' },
      { href: '/owner/add', label: 'Add a building' },
      { href: '/chat', label: 'Chats' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Sign up' },
    ],
  },
];

// Contact details are optional: set NEXT_PUBLIC_CONTACT_EMAIL /
// NEXT_PUBLIC_CONTACT_PHONE in .env.local and they appear here as
// tappable tel:/mailto: links. Nothing fake is ever shown.
export default function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-navy-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <img src="/logo.png" alt="BachelorNest logo" className="h-9 w-auto" />
            <span className="text-lg font-bold">BachelorNest</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-zinc-500">
            Bachelor-friendly PGs, hostels, rooms and flats across India — live
            vacancies, zero brokerage, direct from owners.
          </p>
          {(email || phone) && (
            <div className="mt-4 space-y-1.5 text-sm">
              {phone && (
                <p>
                  📞{' '}
                  <a
                    href={`tel:${phone.replace(/[\s()-]/g, '')}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {phone}
                  </a>
                </p>
              )}
              {email && (
                <p>
                  ✉️{' '}
                  <a
                    href={`mailto:${email}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {email}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
              {col.heading}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-zinc-600 hover:text-brand-600 hover:underline dark:text-zinc-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-zinc-200 px-4 py-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
        © <CopyrightYear /> BachelorNest. All rights reserved. · Built for
        bachelors, by a bachelor 🏠
      </div>
    </footer>
  );
}
