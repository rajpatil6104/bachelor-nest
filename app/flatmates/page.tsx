'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createFlatmatePost,
  deleteFlatmatePost,
  expressInterest,
  getFlatmatePosts,
  getInterestsForPost,
  getMatchContact,
  getMyFlatmatePosts,
  getMyInterests,
  setFlatmatePostStatus,
  setInterestStatus,
} from '@/lib/db';
import { useAuth } from '@/lib/auth';
import {
  FLATMATE_TAGS,
  FlatmateInterest,
  FlatmateKind,
  FlatmatePost,
} from '@/lib/types';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const displayName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

export default function FlatmatesPage() {
  const { user } = useAuth();

  const [posts, setPosts] = useState<FlatmatePost[]>([]);
  const [myPosts, setMyPosts] = useState<FlatmatePost[]>([]);
  const [myInterests, setMyInterests] = useState<FlatmateInterest[]>([]);
  const [received, setReceived] = useState<Record<string, FlatmateInterest[]>>({});
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [kindFilter, setKindFilter] = useState<'all' | FlatmateKind>('all');
  const [cityFilter, setCityFilter] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<FlatmateKind>('need_room');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [budget, setBudget] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [about, setAbout] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Interest composer
  const [interestFor, setInterestFor] = useState<string | null>(null);
  const [interestMsg, setInterestMsg] = useState('');
  const [interestBusy, setInterestBusy] = useState(false);
  const [interestError, setInterestError] = useState('');

  const loadAll = async (uid?: string) => {
    const all = await getFlatmatePosts().catch(() => []);
    setPosts(all);
    if (uid) {
      const [mine, sent] = await Promise.all([
        getMyFlatmatePosts(uid).catch(() => []),
        getMyInterests(uid).catch(() => []),
      ]);
      setMyPosts(mine);
      setMyInterests(sent);
      const rec: Record<string, FlatmateInterest[]> = {};
      await Promise.all(
        mine.map(async (p) => {
          rec[p.id] = await getInterestsForPost(p.id).catch(() => []);
        })
      );
      setReceived(rec);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll(user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const interestedPostIds = useMemo(
    () => new Set(myInterests.map((i) => i.post_id)),
    [myInterests]
  );

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (kindFilter === 'all' || p.kind === kindFilter) &&
          (!cityFilter.trim() ||
            p.city.toLowerCase().includes(cityFilter.trim().toLowerCase()))
      ),
    [posts, kindFilter, cityFilter]
  );

  // A post "matches" one of my open posts of the opposite kind in the
  // same city with a close budget.
  const isMatch = (p: FlatmatePost) =>
    myPosts.some(
      (m) =>
        m.status === 'open' &&
        m.kind !== p.kind &&
        m.city.toLowerCase() === p.city.toLowerCase() &&
        Math.abs(m.budget - p.budget) <= m.budget * 0.25
    );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = parseInt(budget, 10);
    if (!city.trim() || !amt || amt <= 0) {
      setFormError('City and a valid budget are required.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      const post = await createFlatmatePost({
        user_id: user.id,
        poster_name: user.name,
        poster_email: user.email,
        kind,
        city: city.trim(),
        locality: locality.trim() || undefined,
        budget: amt,
        move_in: moveIn || undefined,
        about: about.trim() || undefined,
        tags,
      });
      setMyPosts((prev) => [post, ...prev]);
      setPosts((prev) => [post, ...prev]);
      setShowForm(false);
      setCity('');
      setLocality('');
      setBudget('');
      setAbout('');
      setTags([]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the post.');
    } finally {
      setCreating(false);
    }
  }

  async function handleInterest(post: FlatmatePost) {
    if (!user) return;
    setInterestBusy(true);
    setInterestError('');
    try {
      await expressInterest({
        post_id: post.id,
        seeker_id: user.id,
        seeker_name: user.name,
        message: interestMsg.trim() || undefined,
      });
      setMyInterests((prev) => [
        {
          id: `tmp-${Date.now()}`,
          post_id: post.id,
          seeker_id: user.id,
          seeker_name: user.name,
          message: interestMsg.trim() || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          post_kind: post.kind,
          post_city: post.city,
          post_locality: post.locality,
          post_budget: post.budget,
          poster_name: post.poster_name,
        },
        ...prev,
      ]);
      setInterestFor(null);
      setInterestMsg('');
    } catch (err) {
      setInterestError(err instanceof Error ? err.message : 'Could not send interest.');
    } finally {
      setInterestBusy(false);
    }
  }

  async function handleModerate(postId: string, interestId: string, status: 'accepted' | 'declined') {
    await setInterestStatus(interestId, status);
    setReceived((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((i) =>
        i.id === interestId ? { ...i, status } : i
      ),
    }));
  }

  async function revealContact(interestId: string) {
    if (!user) return;
    const c = await getMatchContact(interestId, user.id);
    if (c) setContacts((prev) => ({ ...prev, [interestId]: c.email }));
  }

  const kindBadge = (k: FlatmateKind) =>
    k === 'have_room'
      ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Find a flatmate 🤝</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Have a spare bed or room? Looking for one? Post here, show interest,
        and contact details are shared only when both sides agree.
      </p>

      {/* Filters + post button */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All posts'],
            ['have_room', '🏠 Has a room'],
            ['need_room', '🔍 Needs a room'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setKindFilter(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              kindFilter === v
                ? 'bg-navy-800 text-white'
                : 'border border-zinc-300 hover:border-brand-500 dark:border-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
        <input
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filter by city…"
          className="w-44 rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {user?.role === 'tenant' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {showForm ? 'Close' : '＋ Post yours'}
          </button>
        )}
        {!user && (
          <Link href="/login?next=/flatmates" className="ml-auto text-sm font-medium text-brand-600 hover:underline">
            Log in to post or show interest
          </Link>
        )}
      </div>

      {/* Create form */}
      {showForm && user?.role === 'tenant' && (
        <form onSubmit={handleCreate} className="mt-4 space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['need_room', '🔍 I need a room', 'Looking for a flatmate who has a space'],
                ['have_room', '🏠 I have a room', 'I have a bed/room and need a flatmate'],
              ] as const
            ).map(([v, title, desc]) => (
              <button
                type="button"
                key={v}
                onClick={() => setKind(v)}
                className={`rounded-2xl border-2 p-4 text-left ${
                  kind === v
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-950'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <p className="font-bold">{title}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *" className={inputCls} />
            <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Locality" className={inputCls} />
            <input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" min={1} placeholder={kind === 'have_room' ? 'Rent for the space ₹ *' : 'Your budget ₹ *'} className={inputCls} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Move-in date (optional)</label>
              <input value={moveIn} onChange={(e) => setMoveIn(e.target.value)} type="date" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">About you / the space</label>
              <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A line or two…" className={inputCls} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Lifestyle tags</p>
            <div className="flex flex-wrap gap-2">
              {FLATMATE_TAGS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    tags.includes(t)
                      ? 'bg-brand-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button type="submit" disabled={creating} className="rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {creating ? 'Posting…' : 'Post it'}
          </button>
        </form>
      )}

      {/* Browse */}
      {loading ? (
        <p className="mt-8 text-zinc-500">Loading posts…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          No posts match. Try another city — or be the first to post here.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => {
            const mine = user?.id === p.user_id;
            const sent = interestedPostIds.has(p.id);
            return (
              <div key={p.id} className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kindBadge(p.kind)}`}>
                    {p.kind === 'have_room' ? '🏠 Has a room' : '🔍 Needs a room'}
                  </span>
                  {isMatch(p) && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      🎯 Matches your post
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-bold">
                  {displayName(p.poster_name)}
                  <span className="ml-2 text-sm font-medium text-zinc-500">
                    {p.locality ? `${p.locality}, ` : ''}{p.city}
                  </span>
                </h3>
                <p className="mt-1 text-sm">
                  <span className="font-bold text-navy-900 dark:text-white">{inr(p.budget)}/mo</span>
                  <span className="text-zinc-500">
                    {p.kind === 'have_room' ? ' rent for the space' : ' budget'}
                    {p.move_in ? ` · move-in ${p.move_in}` : ''}
                  </span>
                </p>
                {p.about && <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{p.about}</p>}
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex-1" />
                {mine ? (
                  <p className="text-sm font-medium text-zinc-400">This is your post</p>
                ) : sent ? (
                  <p className="text-sm font-semibold text-green-600">✓ Interest sent</p>
                ) : user?.role === 'tenant' ? (
                  interestFor === p.id ? (
                    <div className="space-y-2">
                      <input
                        value={interestMsg}
                        onChange={(e) => setInterestMsg(e.target.value)}
                        placeholder="Say hi (optional)…"
                        className={inputCls}
                      />
                      {interestError && <p className="text-sm text-red-600">{interestError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => handleInterest(p)} disabled={interestBusy} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                          {interestBusy ? 'Sending…' : 'Send interest'}
                        </button>
                        <button onClick={() => setInterestFor(null)} className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold dark:border-zinc-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setInterestFor(p.id)} className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      🤝 Show interest
                    </button>
                  )
                ) : (
                  !user && (
                    <Link href="/login?next=/flatmates" className="text-sm font-medium text-brand-600 hover:underline">
                      Log in to show interest
                    </Link>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* My posts + received interests */}
      {user?.role === 'tenant' && myPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">My posts</h2>
          <div className="mt-3 space-y-4">
            {myPosts.map((p) => (
              <div key={p.id} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    <span className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${kindBadge(p.kind)}`}>
                      {p.kind === 'have_room' ? '🏠 Has a room' : '🔍 Needs a room'}
                    </span>
                    {p.locality ? `${p.locality}, ` : ''}{p.city} · {inr(p.budget)}/mo
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                      {p.status}
                    </span>
                    <button
                      onClick={async () => {
                        const next = p.status === 'open' ? 'closed' : 'open';
                        await setFlatmatePostStatus(p.id, next);
                        setMyPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
                        setPosts((prev) =>
                          next === 'closed'
                            ? prev.filter((x) => x.id !== p.id)
                            : [{ ...p, status: 'open' }, ...prev]
                        );
                      }}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {p.status === 'open' ? 'Close post' : 'Reopen'}
                    </button>
                    <button
                      onClick={async () => {
                        await deleteFlatmatePost(p.id);
                        setMyPosts((prev) => prev.filter((x) => x.id !== p.id));
                        setPosts((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {(received[p.id] ?? []).length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {(received[p.id] ?? []).map((i) => (
                      <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          <b>{displayName(i.seeker_name)}</b>
                          {i.message ? <span className="text-zinc-500"> — “{i.message}”</span> : ''}
                          {i.status !== 'pending' && (
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${i.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                              {i.status}
                            </span>
                          )}
                        </span>
                        {i.status === 'pending' ? (
                          <span className="flex gap-2">
                            <button onClick={() => handleModerate(p.id, i.id, 'accepted')} className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
                              Accept
                            </button>
                            <button onClick={() => handleModerate(p.id, i.id, 'declined')} className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-600">
                              Decline
                            </button>
                          </span>
                        ) : i.status === 'accepted' ? (
                          contacts[i.id] ? (
                            <span className="font-medium text-brand-700 dark:text-brand-300">📧 {contacts[i.id]}</span>
                          ) : (
                            <button onClick={() => revealContact(i.id)} className="font-medium text-brand-600 hover:underline">
                              Show contact
                            </button>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interests I sent */}
      {user?.role === 'tenant' && myInterests.length > 0 && (
        <section className="mt-10 pb-8">
          <h2 className="text-xl font-bold">Interests I sent</h2>
          <div className="mt-3 space-y-3">
            {myInterests.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm">
                  <b>{i.poster_name ? displayName(i.poster_name) : 'Poster'}</b>{' '}
                  <span className="text-zinc-500">
                    · {i.post_locality ? `${i.post_locality}, ` : ''}{i.post_city} · {i.post_budget ? inr(i.post_budget) : ''}/mo
                  </span>
                </p>
                {i.status === 'accepted' ? (
                  contacts[i.id] ? (
                    <span className="text-sm font-medium text-brand-700 dark:text-brand-300">📧 {contacts[i.id]}</span>
                  ) : (
                    <button onClick={() => revealContact(i.id)} className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                      🎉 Accepted — show contact
                    </button>
                  )
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    {i.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
