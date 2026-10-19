import Link from 'next/link';
import ListingCard from '@/components/ListingCard';
import { getListings } from '@/lib/db';

export default async function Home() {
  const listings = await getListings();

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-900 via-brand-800 to-brand-600 px-4 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find a bachelor-friendly stay.
            <br />
            See live availability.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            PGs, hostels, rooms & flats listed directly by owners — with real,
            up-to-date vacancy counts. No brokers. No &ldquo;family only&rdquo; rejections.
          </p>

          <form
            action="/search"
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row"
          >
            <input
              name="city"
              placeholder="City — e.g. Bengaluru"
              className="flex-1 rounded-xl px-4 py-3 text-zinc-900 outline-none"
            />
            <input
              name="maxBudget"
              type="number"
              placeholder="Max budget ₹/mo"
              className="w-full rounded-xl px-4 py-3 text-zinc-900 outline-none sm:w-44"
            />
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Featured stays</h2>
          <Link href="/search" className="text-sm font-medium text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.slice(0, 6).map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-6 text-2xl font-bold">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: '🔍', title: 'Search', text: 'Filter by city, budget, room type and amenities that matter to you.' },
            { icon: '🛏️', title: 'Check live vacancy', text: 'Owners update bed counts in real time — see exactly what\u2019s free before you visit.' },
            { icon: '📞', title: 'Contact & move in', text: 'Book a visit or call the owner directly. Zero brokerage, always.' },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="text-3xl">{s.icon}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
