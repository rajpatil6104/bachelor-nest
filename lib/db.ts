import { MOCK_LISTINGS } from './mock-data';
import { getSupabase } from './supabase';
import { Inquiry, Listing, Review, Room, RoomType, SearchFilters, VacancyAlert } from './types';

// Data layer: uses Supabase when configured, otherwise demo data.

// ---- Demo-mode listing edits/deletes (persisted in localStorage) ----
const DEMO_EDITS_KEY = 'bn-demo-listing-edits';
const DEMO_DELETED_KEY = 'bn-demo-deleted-listings';

function readDemoEdits(): Record<string, Listing> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_EDITS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function writeDemoEdits(m: Record<string, Listing>) {
  localStorage.setItem(DEMO_EDITS_KEY, JSON.stringify(m));
}
function readDemoDeleted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_DELETED_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeDemoDeleted(ids: string[]) {
  localStorage.setItem(DEMO_DELETED_KEY, JSON.stringify(ids));
}
// Applies demo edits + hides demo-deleted listings
export function applyDemoListingState(listings: Listing[]): Listing[] {
  const edits = readDemoEdits();
  const deleted = new Set(readDemoDeleted());
  return listings.filter((l) => !deleted.has(l.id)).map((l) => edits[l.id] ?? l);
}
export async function getListings(filters: SearchFilters = {}): Promise<Listing[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from('listings').select('*, rooms(*)').eq('status', 'approved');
    if (filters.city) q = q.ilike('city', `%${filters.city}%`);
    if (filters.type) q = q.eq('type', filters.type);
    const { data, error } = await q;
    if (error) throw error;
    let listings = (data ?? []) as Listing[];
    if (filters.maxBudget)
      listings = listings.filter((l) => l.rooms.some((r) => r.rent_per_bed <= filters.maxBudget!));
    if (filters.roomType)
      listings = listings.filter((l) => l.rooms.some((r) => r.room_type === filters.roomType));
    return withLiveRatings(sb, listings);
  }
  return withDemoRatings(applyDemoListingState(filterMock(filters)));
}

export async function getListing(id: string): Promise<Listing | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('listings')
      .select('*, rooms(*)')
      .eq('id', id)
      .single();
    if (error) return null;
    const [rated] = await withLiveRatings(sb, [data as Listing]);
    return rated;
  }
  const found = applyDemoListingState(MOCK_LISTINGS).find((l) => l.id === id) ?? null;
  return found ? withDemoRatings([found])[0] : null;
}

function filterMock(filters: SearchFilters): Listing[] {
  return MOCK_LISTINGS.filter((l) => {
    if (filters.city && !l.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.type && l.type !== filters.type) return false;
    if (filters.maxBudget && !l.rooms.some((r) => r.rent_per_bed <= filters.maxBudget!)) return false;
    if (filters.roomType && !l.rooms.some((r) => r.room_type === filters.roomType)) return false;
    return true;
  });
}

export async function getOwnerListings(ownerId: string): Promise<Listing[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('listings')
      .select('*, rooms(*)')
      .eq('owner_id', ownerId);
    if (error) throw error;
    return (data ?? []) as Listing[];
  }
  // Demo: pretend all mock listings belong to the demo owner
  return applyDemoListingState(MOCK_LISTINGS);
}

// ---- Admin moderation ----

export async function getPendingListings(): Promise<Listing[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('listings')
      .select('*, rooms(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Listing[];
  }
  return applyDemoListingState(MOCK_LISTINGS).filter((l) => l.status === 'pending');
}

export async function setListingStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('listings').update({ status }).eq('id', id);
    if (error) throw error;
  }
  // Demo mode: the admin page manages local state instead
}

export interface ListingEditPatch {
  title: string;
  description: string;
  address: string;
  city: string;
  locality: string;
  amenities: string[];
  house_rules: string;
  rent_cycle: string;
  photos: string[];
}

export interface RoomEditInput {
  room_type: RoomType;
  label: string | null;
  total_beds: number;
  occupied_beds: number;
  rent_per_bed: number;
  deposit: number;
}

// Owner edits a listing. Any edit sends the listing back to 'pending' —
// it disappears from tenant search until an admin re-approves it.
export async function updateListing(
  id: string,
  patch: ListingEditPatch,
  rooms: RoomEditInput[]
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from('listings')
      .update({ ...patch, status: 'pending' })
      .eq('id', id);
    if (error) throw error;
    const { error: delError } = await sb.from('rooms').delete().eq('listing_id', id);
    if (delError) throw delError;
    if (rooms.length > 0) {
      const { error: insError } = await sb
        .from('rooms')
        .insert(rooms.map((r) => ({ listing_id: id, ...r })));
      if (insError) throw insError;
    }
    return;
  }
  // Demo: persist an override copy
  const base = applyDemoListingState(MOCK_LISTINGS).find((l) => l.id === id);
  if (!base) return;
  const edits = readDemoEdits();
  edits[id] = {
    ...base,
    ...patch,
    status: 'pending',
    rooms: rooms.map(
      (r, i): Room => ({ id: `demo-room-${id}-${i}`, listing_id: id, ...r })
    ),
  };
  writeDemoEdits(edits);
}

// Owner removes a listing permanently (rooms go with it — FK cascade in
// the real DB; a deleted-id list in demo mode).
export async function deleteListing(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('listings').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const deleted = readDemoDeleted();
  if (!deleted.includes(id)) {
    deleted.push(id);
    writeDemoDeleted(deleted);
  }
  const edits = readDemoEdits();
  delete edits[id];
  writeDemoEdits(edits);
}

// ---- Listing photos (Supabase Storage) ----

export async function uploadListingPhotos(
  ownerId: string,
  files: File[]
): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) {
    // Demo mode: session-only preview URLs (not persisted)
    return files.map((f) => URL.createObjectURL(f));
  }
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb
      .storage.from('listing-photos')
      .upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = sb.storage.from('listing-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ---- Vacancy alerts ----

const DEMO_ALERT_KEY = 'bn-demo-alerts';

function readDemoAlerts(): VacancyAlert[] {
  try {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(DEMO_ALERT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeDemoAlerts(all: VacancyAlert[]) {
  try {
    localStorage.setItem(DEMO_ALERT_KEY, JSON.stringify(all));
  } catch {}
}

export async function getAlerts(tenantId: string): Promise<VacancyAlert[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as VacancyAlert[];
  }
  return readDemoAlerts().filter((a) => a.tenant_id === tenantId);
}

export async function createAlert(
  tenantId: string,
  input: { city: string; locality?: string; maxBudget?: number; roomType?: string }
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('alerts').insert({
      tenant_id: tenantId,
      city: input.city,
      locality: input.locality || null,
      max_budget: input.maxBudget ?? null,
      room_type: input.roomType || null,
    });
    if (error) throw error;
    return;
  }
  const all = readDemoAlerts();
  all.unshift({
    id: `demo-alert-${Date.now()}`,
    tenant_id: tenantId,
    city: input.city,
    locality: input.locality || null,
    max_budget: input.maxBudget ?? null,
    room_type: (input.roomType as any) || null,
    created_at: new Date().toISOString(),
  });
  writeDemoAlerts(all);
}

export async function deleteAlert(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('alerts').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  writeDemoAlerts(readDemoAlerts().filter((a) => a.id !== id));
}

// ---- Favorites ----

const DEMO_FAV_KEY = 'bn-demo-favorites';

function readDemoFavorites(): { tenant_id: string; listing_id: string }[] {
  try {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(DEMO_FAV_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeDemoFavorites(all: { tenant_id: string; listing_id: string }[]) {
  try {
    localStorage.setItem(DEMO_FAV_KEY, JSON.stringify(all));
  } catch {}
}

export async function getFavoriteIds(tenantId: string): Promise<string[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('favorites')
      .select('listing_id')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.listing_id as string);
  }
  return readDemoFavorites()
    .filter((f) => f.tenant_id === tenantId)
    .map((f) => f.listing_id);
}

export async function getFavoriteListings(tenantId: string): Promise<Listing[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('favorites')
      .select('listing_id, listings!inner(*, rooms(*))')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return ((data ?? []) as any[])
      .map((r) => r.listings)
      .filter(Boolean) as Listing[];
  }
  const ids = new Set(
    readDemoFavorites()
      .filter((f) => f.tenant_id === tenantId)
      .map((f) => f.listing_id)
  );
  return applyDemoListingState(MOCK_LISTINGS).filter((l) => ids.has(l.id));
}

export async function toggleFavorite(
  tenantId: string,
  listingId: string
): Promise<boolean> {
  // returns true if now favorited
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from('favorites')
      .select('listing_id')
      .eq('tenant_id', tenantId)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (data) {
      const { error } = await sb
        .from('favorites')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('listing_id', listingId);
      if (error) throw error;
      return false;
    }
    const { error } = await sb
      .from('favorites')
      .insert({ tenant_id: tenantId, listing_id: listingId });
    if (error) throw error;
    return true;
  }
  const all = readDemoFavorites();
  const idx = all.findIndex(
    (f) => f.tenant_id === tenantId && f.listing_id === listingId
  );
  if (idx >= 0) {
    all.splice(idx, 1);
    writeDemoFavorites(all);
    return false;
  }
  all.push({ tenant_id: tenantId, listing_id: listingId });
  writeDemoFavorites(all);
  return true;
}

// ---- Visit inquiries ----

const DEMO_INQ_KEY = 'bn-demo-inquiries';

function readDemoInquiries(): Inquiry[] {
  try {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(DEMO_INQ_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeDemoInquiries(all: Inquiry[]) {
  try {
    localStorage.setItem(DEMO_INQ_KEY, JSON.stringify(all));
  } catch {}
}

function attachListingInfo(inq: Inquiry): Inquiry {
  const l = MOCK_LISTINGS.find((x) => x.id === inq.listing_id);
  if (l) {
    inq.listing_title = l.title;
    inq.listing_locality = l.locality;
    inq.listing_city = l.city;
  }
  return inq;
}

export async function createInquiry(input: {
  listing_id: string;
  tenant_id: string;
  kind: 'visit' | 'callback';
  preferred_date?: string;
  message?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('inquiries').insert({
      listing_id: input.listing_id,
      tenant_id: input.tenant_id,
      kind: input.kind,
      status: 'pending',
      preferred_date: input.preferred_date || null,
      message: input.message || null,
    });
    if (error) throw error;
    return;
  }
  const all = readDemoInquiries();
  all.unshift({
    id: `demo-inq-${Date.now()}`,
    listing_id: input.listing_id,
    tenant_id: input.tenant_id,
    kind: input.kind,
    status: 'pending',
    preferred_date: input.preferred_date || null,
    message: input.message || null,
    created_at: new Date().toISOString(),
  });
  writeDemoInquiries(all);
}

export async function getTenantInquiries(tenantId: string): Promise<Inquiry[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('inquiries')
      .select('*, listings!inner(title, locality, city)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      listing_id: r.listing_id,
      tenant_id: r.tenant_id,
      kind: r.kind,
      status: r.status,
      preferred_date: r.preferred_date,
      message: r.message,
      created_at: r.created_at,
      listing_title: r.listings?.title,
      listing_locality: r.listings?.locality,
      listing_city: r.listings?.city,
    }));
  }
  return readDemoInquiries()
    .filter((i) => i.tenant_id === tenantId)
    .map(attachListingInfo);
}

export async function getOwnerInquiries(ownerId: string): Promise<Inquiry[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('inquiries')
      .select('*, listings!inner(title, locality, city, owner_id)')
      .eq('listings.owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      listing_id: r.listing_id,
      tenant_id: r.tenant_id,
      kind: r.kind,
      status: r.status,
      preferred_date: r.preferred_date,
      message: r.message,
      created_at: r.created_at,
      listing_title: r.listings?.title,
      listing_locality: r.listings?.locality,
      listing_city: r.listings?.city,
    }));
  }
  // Demo: all mock listings belong to the demo owner
  return readDemoInquiries().map(attachListingInfo);
}

export async function setInquiryStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'done'
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('inquiries').update({ status }).eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readDemoInquiries().map((i) =>
    i.id === id ? { ...i, status } : i
  );
  writeDemoInquiries(all);
}

// Reviews unlock only after a visit actually happened: the tenant booked,
// the owner accepted, and the owner confirmed the visit took place.
export async function hasCompletedVisit(
  tenantId: string,
  listingId: string
): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('inquiries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('listing_id', listingId)
      .eq('kind', 'visit')
      .eq('status', 'done')
      .limit(1);
    if (error) return false;
    return (data ?? []).length > 0;
  }
  return readDemoInquiries().some(
    (i) =>
      i.tenant_id === tenantId &&
      i.listing_id === listingId &&
      i.kind === 'visit' &&
      i.status === 'done'
  );
}

// ---- Reviews ----

const DEMO_REV_KEY = 'bn-demo-reviews';

const DEMO_SEED_REVIEWS: Review[] = [
  {
    id: 'seed-r1', listing_id: 'demo-1', tenant_id: 'tenant-9', rating: 4,
    comment: 'Good food and rooms are cleaned daily. Metro is a 5-minute walk.',
    created_at: '2026-10-05T10:00:00Z',
  },
  {
    id: 'seed-r2', listing_id: 'demo-1', tenant_id: 'tenant-8', rating: 5,
    comment: 'Owner is very helpful, no unnecessary rules. Recommended!',
    created_at: '2026-10-12T10:00:00Z',
  },
  {
    id: 'seed-r3', listing_id: 'demo-4', tenant_id: 'tenant-7', rating: 5,
    comment: 'Premium feel, great community vibe with weekend events.',
    created_at: '2026-10-10T10:00:00Z',
  },
];

function readDemoReviews(): Review[] {
  if (typeof window === 'undefined') return DEMO_SEED_REVIEWS;
  try {
    const raw = localStorage.getItem(DEMO_REV_KEY);
    const saved: Review[] = raw ? JSON.parse(raw) : [];
    const ids = new Set(saved.map((r) => r.id));
    return [...saved, ...DEMO_SEED_REVIEWS.filter((r) => !ids.has(r.id))];
  } catch {
    return DEMO_SEED_REVIEWS;
  }
}

function writeDemoReviews(reviews: Review[]) {
  if (typeof window === 'undefined') return;
  // Only persist user-written reviews; seeds are baked in
  const seedIds = new Set(DEMO_SEED_REVIEWS.map((r) => r.id));
  localStorage.setItem(
    DEMO_REV_KEY,
    JSON.stringify(reviews.filter((r) => !seedIds.has(r.id)))
  );
}

export async function getReviews(listingId: string): Promise<Review[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Review[];
  }
  return readDemoReviews()
    .filter((r) => r.listing_id === listingId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getMyReview(
  listingId: string,
  tenantId: string
): Promise<Review | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return (data as Review | null) ?? null;
  }
  return (
    readDemoReviews().find(
      (r) => r.listing_id === listingId && r.tenant_id === tenantId
    ) ?? null
  );
}

export async function submitReview(
  listingId: string,
  tenantId: string,
  rating: number,
  comment: string
): Promise<void> {
  if (rating < 1 || rating > 5) throw new Error('Rating must be 1–5');
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('reviews').upsert(
      {
        listing_id: listingId,
        tenant_id: tenantId,
        rating,
        comment: comment.trim() || null,
      },
      { onConflict: 'listing_id,tenant_id' }
    );
    if (error) throw error;
    return;
  }
  const all = readDemoReviews();
  const existing = all.find(
    (r) => r.listing_id === listingId && r.tenant_id === tenantId
  );
  if (existing) {
    existing.rating = rating;
    existing.comment = comment.trim() || null;
  } else {
    all.unshift({
      id: `demo-r-${Date.now()}`,
      listing_id: listingId,
      tenant_id: tenantId,
      rating,
      comment: comment.trim() || null,
      created_at: new Date().toISOString(),
    });
  }
  writeDemoReviews(all);
}

function withDemoRatings(listings: Listing[]): Listing[] {
  const all = readDemoReviews();
  return listings.map((l) => {
    const rs = all.filter((r) => r.listing_id === l.id);
    if (!rs.length) return l; // keep mock avg_rating
    const avg = rs.reduce((s, r) => s + r.rating, 0) / rs.length;
    return {
      ...l,
      avg_rating: Math.round(avg * 10) / 10,
      review_count: rs.length,
    };
  });
}

async function withLiveRatings(sb: any, listings: Listing[]): Promise<Listing[]> {
  const ids = listings.map((l) => l.id);
  if (!ids.length) return listings;
  const { data } = await sb
    .from('reviews')
    .select('listing_id, rating')
    .in('listing_id', ids);
  const map = new Map<string, number[]>();
  for (const r of (data ?? []) as { listing_id: string; rating: number }[]) {
    if (!map.has(r.listing_id)) map.set(r.listing_id, []);
    map.get(r.listing_id)!.push(r.rating);
  }
  return listings.map((l) => {
    const rs = map.get(l.id) ?? [];
    if (!rs.length) return { ...l, avg_rating: undefined, review_count: 0 };
    const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
    return {
      ...l,
      avg_rating: Math.round(avg * 10) / 10,
      review_count: rs.length,
    };
  });
}

// ---- In-app chat ----

export interface ChatMessage {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  listing_id: string;
  listing_title: string;
  other_id: string;
  other_name: string;
  last_body: string;
  last_at: string;
  unread: number;
}

const DEMO_MSG_KEY = 'bn-demo-messages';

const DEMO_SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'seed-m1', listing_id: 'demo-1',
    sender_id: 'demo-owner', receiver_id: 'demo-tenant', sender_name: 'Demo Owner',
    body: 'Hi! Yes, the double-sharing room is available from next month.',
    created_at: '2026-10-15T09:30:00Z', read_at: '2026-10-15T10:00:00Z',
  },
  {
    id: 'seed-m2', listing_id: 'demo-1',
    sender_id: 'demo-tenant', receiver_id: 'demo-owner', sender_name: 'Demo Bachelor',
    body: 'Great! Is the food included in the rent or extra?',
    created_at: '2026-10-15T10:05:00Z', read_at: null,
  },
];

function readDemoMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return DEMO_SEED_MESSAGES;
  try {
    const raw = localStorage.getItem(DEMO_MSG_KEY);
    const saved: ChatMessage[] = raw ? JSON.parse(raw) : [];
    const ids = new Set(saved.map((m) => m.id));
    return [...saved, ...DEMO_SEED_MESSAGES.filter((m) => !ids.has(m.id))];
  } catch {
    return DEMO_SEED_MESSAGES;
  }
}

function writeDemoMessages(msgs: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  const seedIds = new Set(DEMO_SEED_MESSAGES.map((m) => m.id));
  localStorage.setItem(
    DEMO_MSG_KEY,
    JSON.stringify(msgs.filter((m) => !seedIds.has(m.id)))
  );
}

function demoListingTitles(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of MOCK_LISTINGS) map[l.id] = l.title;
  return map;
}

export async function getConversations(me: string): Promise<Conversation[]> {
  const sb = getSupabase();
  let msgs: (ChatMessage & { listing_title?: string })[];
  if (sb) {
    const { data, error } = await sb
      .from('messages')
      .select('*, listings(title)')
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    msgs = (data ?? []).map((m: any) => ({
      ...(m as ChatMessage),
      listing_title: m.listings?.title ?? 'Listing',
    }));
  } else {
    const titles = demoListingTitles();
    msgs = readDemoMessages()
      .filter((m) => m.sender_id === me || m.receiver_id === me)
      .map((m) => ({ ...m, listing_title: titles[m.listing_id] ?? 'Listing' }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const convos = new Map<string, Conversation>();
  for (const m of msgs) {
    const other = m.sender_id === me ? m.receiver_id : m.sender_id;
    const key = `${m.listing_id}|${other}`;
    const existing = convos.get(key);
    const otherName =
      m.sender_id === me
        ? existing?.other_name ?? '…'
        : m.sender_name || '…';
    if (!existing) {
      convos.set(key, {
        listing_id: m.listing_id,
        listing_title: m.listing_title ?? 'Listing',
        other_id: other,
        other_name: otherName,
        last_body: m.body,
        last_at: m.created_at,
        unread: m.receiver_id === me && !m.read_at ? 1 : 0,
      });
    } else if (m.receiver_id === me && !m.read_at) {
      existing.unread += 1;
    }
    // Fill in the other party's name from any message they sent
    const c = convos.get(key)!;
    if (m.sender_id !== me && m.sender_name) c.other_name = m.sender_name;
  }
  return [...convos.values()];
}

export async function getMessages(
  listingId: string,
  me: string,
  other: string
): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('listing_id', listingId)
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`
      )
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }
  return readDemoMessages()
    .filter(
      (m) =>
        m.listing_id === listingId &&
        ((m.sender_id === me && m.receiver_id === other) ||
          (m.sender_id === other && m.receiver_id === me))
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function sendMessage(
  listingId: string,
  senderId: string,
  senderName: string,
  receiverId: string,
  body: string
): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Message is empty');
  if (text.length > 1000) throw new Error('Message is too long (max 1000 chars)');
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('messages').insert({
      listing_id: listingId,
      sender_id: senderId,
      receiver_id: receiverId,
      sender_name: senderName,
      body: text,
    });
    if (error) throw error;
    return;
  }
  const all = readDemoMessages();
  all.push({
    id: `demo-m-${Date.now()}`,
    listing_id: listingId,
    sender_id: senderId,
    receiver_id: receiverId,
    sender_name: senderName,
    body: text,
    created_at: new Date().toISOString(),
    read_at: null,
  });
  writeDemoMessages(all);
}

export async function markMessagesRead(
  listingId: string,
  me: string,
  other: string
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('listing_id', listingId)
      .eq('sender_id', other)
      .eq('receiver_id', me)
      .is('read_at', null);
    return;
  }
  const all = readDemoMessages().map((m) =>
    m.listing_id === listingId &&
    m.sender_id === other &&
    m.receiver_id === me &&
    !m.read_at
      ? { ...m, read_at: new Date().toISOString() }
      : m
  );
  writeDemoMessages(all);
}

export async function getUnreadCount(me: string): Promise<number> {
  const sb = getSupabase();
  if (sb) {
    const { count } = await sb
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', me)
      .is('read_at', null);
    return count ?? 0;
  }
  return readDemoMessages().filter((m) => m.receiver_id === me && !m.read_at).length;
}

// ---- Owner profiles & KYC ----

export interface OwnerProfile {
  id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  kyc_status: string;
  kyc_docs: string[];
}

const DEMO_PROFILE_KEY = 'bn-demo-profile';

function readDemoProfile(): OwnerProfile {
  if (typeof window === 'undefined') {
    return { id: 'demo-owner', role: 'owner', full_name: 'Demo Owner', phone: null, email: 'demo@bachelorsnest.app', kyc_status: 'verified', kyc_docs: [] };
  }
  try {
    const raw = localStorage.getItem(DEMO_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { id: 'demo-owner', role: 'owner', full_name: 'Demo Owner', phone: null, email: 'demo@bachelorsnest.app', kyc_status: 'verified', kyc_docs: [] };
}

export async function getOwnerProfile(userId: string): Promise<OwnerProfile | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('profiles')
      .select('id, role, full_name, phone, email, kyc_status, kyc_docs')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as OwnerProfile;
  }
  const p = readDemoProfile();
  return userId === 'demo-owner' ? p : null;
}

export async function updateOwnerProfile(
  userId: string,
  patch: { full_name?: string; phone?: string }
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
    return;
  }
  const p = readDemoProfile();
  localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ ...p, ...patch }));
}

export async function uploadOwnerDocs(ownerId: string, files: File[]): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return files.map((f) => URL.createObjectURL(f));
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage
      .from('owner-docs')
      .upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function submitKyc(userId: string, docPaths: string[]): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from('profiles')
      .update({ kyc_status: 'pending', kyc_docs: docPaths })
      .eq('id', userId);
    if (error) throw error;
    return;
  }
  const p = readDemoProfile();
  localStorage.setItem(
    DEMO_PROFILE_KEY,
    JSON.stringify({ ...p, kyc_status: 'pending', kyc_docs: docPaths })
  );
}

export async function getPendingKyc(): Promise<OwnerProfile[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('profiles')
      .select('id, role, full_name, phone, email, kyc_status, kyc_docs')
      .eq('kyc_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OwnerProfile[];
  }
  const p = readDemoProfile();
  return p.kyc_status === 'pending' ? [p] : [];
}

export async function setKycStatus(userId: string, status: 'verified' | 'rejected'): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('profiles').update({ kyc_status: status }).eq('id', userId);
    if (error) throw error;
    return;
  }
  const p = readDemoProfile();
  if (p.id === userId) {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ ...p, kyc_status: status }));
  }
}

export async function getSignedDocUrl(path: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) return path; // demo: already an object URL
  const { data, error } = await sb.storage.from('owner-docs').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Upsert used by the owner OTP registration flow (profile may not exist yet).
// Never touches kyc_status — verification state is only changed by submitKyc
// (owner) and setKycStatus (admin).
export async function ensureOwnerProfile(p: {
  id: string;
  role: string;
  full_name: string;
  phone: string;
  email: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('profiles').upsert(
    {
      id: p.id,
      role: p.role,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}
