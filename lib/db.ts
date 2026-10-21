import { MOCK_LISTINGS } from './mock-data';
import { getSupabase } from './supabase';
import { FlatmateInterest, FlatmateKind, FlatmatePost, Inquiry, Listing, ListingReport, ListingStats, ReportReason, Review, Room, RoomType, SearchFilters, VacancyAlert } from './types';

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
// Applies demo edits + hides demo-deleted listings and listings whose
// owner was deleted from the admin Owners directory
export function applyDemoListingState(listings: Listing[]): Listing[] {
  const edits = readDemoEdits();
  const deleted = new Set(readDemoDeleted());
  const deletedOwners = new Set(readDemoDeletedOwners());
  return listings
    .filter((l) => !deleted.has(l.id) && !deletedOwners.has(l.owner_id))
    .map((l) => edits[l.id] ?? l);
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
  return withDemoRatings(hideDemoSuspendedOwners(applyDemoListingState(filterMock(filters))));
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
  const found = hideDemoSuspendedOwners(applyDemoListingState(MOCK_LISTINGS)).find((l) => l.id === id) ?? null;
  return found ? withDemoRatings([found])[0] : null;
}

// Admin variant for the edit form: any status, no ratings merge, and in
// demo mode even a suspended owner's listings stay editable (tenant reads
// hide them; the admin directory must not).
export async function getAdminListing(id: string): Promise<Listing | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('listings')
      .select('*, rooms(*)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as Listing;
  }
  return applyDemoListingState(MOCK_LISTINGS).find((l) => l.id === id) ?? null;
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
  let title: string | null = null;
  if (sb) {
    const { data, error } = await sb
      .from('listings')
      .update({ status })
      .eq('id', id)
      .select('title');
    if (error) throw error;
    title = data?.[0]?.title ?? null;
  } else {
    // Demo mode: the admin page manages local state instead
    title = applyDemoListingState(MOCK_LISTINGS).find((l) => l.id === id)?.title ?? null;
  }
  await logAdminAction(
    status === 'approved' ? 'listing.approved' : 'listing.rejected',
    'listing',
    title
  );
}

export interface ListingEditPatch {
  lat: number | null;
  lng: number | null;
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
  rooms: RoomEditInput[],
  opts?: { keepStatus?: boolean }
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    // Owner edits go back to 'pending' for re-verification (Raj's rule).
    // Admin edits (keepStatus) preserve the listing's current status —
    // the admin IS the verifier, so a fix shouldn't take a live listing
    // down or silently approve a pending one.
    const update = opts?.keepStatus ? { ...patch } : { ...patch, status: 'pending' as const };
    const { error } = await sb
      .from('listings')
      .update(update)
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
    status: opts?.keepStatus ? base.status : 'pending',
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
}): Promise<string | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('inquiries')
      .insert({
        listing_id: input.listing_id,
        tenant_id: input.tenant_id,
        kind: input.kind,
        status: 'pending',
        preferred_date: input.preferred_date || null,
        message: input.message || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  }
  const newId = `demo-inq-${Date.now()}`;
  const all = readDemoInquiries();
  all.unshift({
    id: newId,
    listing_id: input.listing_id,
    tenant_id: input.tenant_id,
    kind: input.kind,
    status: 'pending',
    preferred_date: input.preferred_date || null,
    message: input.message || null,
    created_at: new Date().toISOString(),
  });
  writeDemoInquiries(all);
  return newId;
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


// ---- Listing reports ----

const DEMO_REPORTS_KEY = 'bn-demo-reports';

function readDemoReports(): ListingReport[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_REPORTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeDemoReports(all: ListingReport[]) {
  localStorage.setItem(DEMO_REPORTS_KEY, JSON.stringify(all));
}

const ALREADY_REPORTED_MSG =
  "You've already reported this listing — our team is looking into it.";

export async function createReport(input: {
  listing_id: string;
  reporter_id: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { data: existing } = await sb
      .from('reports')
      .select('id')
      .eq('listing_id', input.listing_id)
      .eq('reporter_id', input.reporter_id)
      .eq('status', 'open')
      .limit(1);
    if ((existing ?? []).length > 0) throw new Error(ALREADY_REPORTED_MSG);
    const { error } = await sb.from('reports').insert({
      listing_id: input.listing_id,
      reporter_id: input.reporter_id,
      reason: input.reason,
      details: input.details || null,
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new Error(ALREADY_REPORTED_MSG);
      }
      throw error;
    }
    return;
  }
  const all = readDemoReports();
  if (
    all.some(
      (r) =>
        r.listing_id === input.listing_id &&
        r.reporter_id === input.reporter_id &&
        r.status === 'open'
    )
  ) {
    throw new Error(ALREADY_REPORTED_MSG);
  }
  all.unshift({
    id: `demo-report-${Date.now()}`,
    listing_id: input.listing_id,
    reporter_id: input.reporter_id,
    reason: input.reason,
    details: input.details || null,
    status: 'open',
    created_at: new Date().toISOString(),
  });
  writeDemoReports(all);
}

export async function getMyOpenReport(
  listingId: string,
  reporterId: string
): Promise<ListingReport | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from('reports')
      .select('*')
      .eq('listing_id', listingId)
      .eq('reporter_id', reporterId)
      .eq('status', 'open')
      .limit(1);
    return ((data ?? [])[0] as ListingReport) ?? null;
  }
  return (
    readDemoReports().find(
      (r) =>
        r.listing_id === listingId &&
        r.reporter_id === reporterId &&
        r.status === 'open'
    ) ?? null
  );
}

// Admin: all reports, open first, with listing title + reporter name.
export async function getReports(): Promise<ListingReport[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ListingReport[];
    if (rows.length === 0) return rows;
    const listingIds = [...new Set(rows.map((r) => r.listing_id))];
    const reporterIds = [...new Set(rows.map((r) => r.reporter_id))];
    const [{ data: listings }, { data: profiles }] = await Promise.all([
      sb.from('listings').select('id, title').in('id', listingIds),
      sb.from('profiles').select('id, full_name').in('id', reporterIds),
    ]);
    const titleById = new Map((listings ?? []).map((l) => [l.id, l.title]));
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return rows
      .map((r) => ({
        ...r,
        listing_title: titleById.get(r.listing_id) ?? 'Listing',
        reporter_name: nameById.get(r.reporter_id) ?? 'Tenant',
      }))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
  }
  const titles = new Map(
    applyDemoListingState(MOCK_LISTINGS).map((l) => [l.id, l.title])
  );
  return readDemoReports()
    .map((r) => ({
      ...r,
      listing_title: titles.get(r.listing_id) ?? 'Listing',
      reporter_name: 'Demo bachelor',
    }))
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
}

export async function setReportStatus(
  id: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('reports').update({ status }).eq('id', id);
    if (error) throw error;
    return;
  }
  writeDemoReports(
    readDemoReports().map((r) => (r.id === id ? { ...r, status } : r))
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
  created_at?: string;
  suspended?: boolean;
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
  const fromProfile = p.kyc_status === 'pending' ? [p] : [];
  const deleted = new Set(readDemoDeletedOwners());
  const overrides = readDemoOwnerKycOverrides();
  const fromDirectory = DEMO_OWNERS.filter(
    (o) => !deleted.has(o.id) && (overrides[o.id] ?? o.kyc_status) === 'pending'
  );
  return [...fromProfile, ...fromDirectory];
}

export async function setKycStatus(userId: string, status: 'verified' | 'rejected', label?: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('profiles').update({ kyc_status: status }).eq('id', userId);
    if (error) throw error;
    await logAdminAction(
      status === 'verified' ? 'owner.kyc_verified' : 'owner.kyc_rejected',
      'owner',
      label ?? userId
    );
    return;
  }
  const p = readDemoProfile();
  if (p.id === userId) {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ ...p, kyc_status: status }));
  }
  // Keep the admin Owners directory in sync for its demo seed owners.
  if (DEMO_OWNERS.some((o) => o.id === userId)) {
    const overrides = readDemoOwnerKycOverrides();
    overrides[userId] = status;
    try {
      localStorage.setItem(DEMO_OWNER_KYC_KEY, JSON.stringify(overrides));
    } catch {}
  }
  await logAdminAction(
    status === 'verified' ? 'owner.kyc_verified' : 'owner.kyc_rejected',
    'owner',
    label ?? userId
  );
}

export async function getSignedDocUrl(path: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) return path; // demo: already an object URL
  const { data, error } = await sb.storage.from('owner-docs').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ---- Admin: owners directory (list, suspend, delete) ----

// Defensive on purpose: queried separately from getOwnerProfile so a
// database that hasn't run migration_owner_suspend.sql yet (no `suspended`
// column) just reads as "not suspended" instead of breaking login.
export async function getOwnerSuspended(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return readDemoSuspendedOwners().includes(userId);
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('suspended')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return false;
    return !!(data as { suspended?: boolean }).suspended;
  } catch {
    return false;
  }
}

const DEMO_SUSPENDED_OWNERS_KEY = 'bn-demo-owner-suspended';
const DEMO_DELETED_OWNERS_KEY = 'bn-demo-owner-deleted';
const DEMO_OWNER_KYC_KEY = 'bn-demo-owner-kyc';

function readDemoIdSet(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeDemoIdSet(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}
export function readDemoSuspendedOwners(): string[] {
  return readDemoIdSet(DEMO_SUSPENDED_OWNERS_KEY);
}
export function readDemoDeletedOwners(): string[] {
  return readDemoIdSet(DEMO_DELETED_OWNERS_KEY);
}
function readDemoOwnerKycOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(DEMO_OWNER_KYC_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

// Tenant-facing demo reads hide suspended owners' listings, mirroring the
// live RLS policy (migration_owner_suspend.sql). Admin/owner reads don't.
export function hideDemoSuspendedOwners(listings: Listing[]): Listing[] {
  const suspended = new Set(readDemoSuspendedOwners());
  if (suspended.size === 0) return listings;
  return listings.filter((l) => !suspended.has(l.owner_id));
}

export interface AdminOwner extends OwnerProfile {
  listings: Listing[];
  liveCount: number;
  pendingCount: number;
  reportCount: number;
}

// The mock listings belong to owner-1/2/3; owner-4 is a pending-KYC owner
// with no listings yet, so the directory's verify flow works in demo too.
const DEMO_OWNERS: OwnerProfile[] = [
  { id: 'owner-1', role: 'owner', full_name: 'Rajesh Kumar', phone: '+91 98220 11111', email: 'rajesh.kumar@demo.in', kyc_status: 'verified', kyc_docs: [], created_at: '2026-08-14T10:30:00Z' },
  { id: 'owner-2', role: 'owner', full_name: 'Amit Verma', phone: '+91 98220 22222', email: 'amit.verma@demo.in', kyc_status: 'verified', kyc_docs: [], created_at: '2026-09-02T09:15:00Z' },
  { id: 'owner-3', role: 'owner', full_name: 'Suresh Patil', phone: '+91 98220 33333', email: 'suresh.patil@demo.in', kyc_status: 'verified', kyc_docs: [], created_at: '2026-09-27T14:45:00Z' },
  { id: 'owner-4', role: 'owner', full_name: 'Priya Nair', phone: '+91 98220 44444', email: 'priya.nair@demo.in', kyc_status: 'pending', kyc_docs: [], created_at: '2026-10-18T08:20:00Z' },
];

function ownerRank(o: OwnerProfile): number {
  if (o.kyc_status === 'pending') return 0;
  if (o.suspended) return 1;
  if (o.kyc_status === 'verified') return 2;
  return 3; // rejected
}

function composeAdminOwners(
  profiles: OwnerProfile[],
  allListings: Listing[],
  reportCountByListing: Map<string, number>
): AdminOwner[] {
  const byOwner = new Map<string, Listing[]>();
  for (const l of allListings) {
    const arr = byOwner.get(l.owner_id) ?? [];
    arr.push(l);
    byOwner.set(l.owner_id, arr);
  }
  return profiles
    .map((p) => {
      const listings = byOwner.get(p.id) ?? [];
      return {
        ...p,
        listings,
        liveCount: listings.filter((l) => l.status === 'approved').length,
        pendingCount: listings.filter((l) => l.status === 'pending').length,
        reportCount: listings.reduce((sum, l) => sum + (reportCountByListing.get(l.id) ?? 0), 0),
      };
    })
    .sort((a, b) => ownerRank(a) - ownerRank(b) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export async function getAdminOwners(): Promise<AdminOwner[]> {
  const sb = getSupabase();
  if (sb) {
    const { data: profiles, error } = await sb
      .from('profiles')
      .select('*')
      .eq('role', 'owner');
    if (error) throw error;
    const { data: listings, error: lErr } = await sb.from('listings').select('*, rooms(*)');
    if (lErr) throw lErr;
    // Reports are a bonus signal — never let a missing reports table
    // (migration not run) break the whole directory.
    const reportCountByListing = new Map<string, number>();
    try {
      const { data: reports } = await sb.from('reports').select('listing_id');
      for (const r of (reports ?? []) as { listing_id: string }[]) {
        reportCountByListing.set(r.listing_id, (reportCountByListing.get(r.listing_id) ?? 0) + 1);
      }
    } catch { /* counts stay 0 */ }
    return composeAdminOwners(
      (profiles ?? []) as OwnerProfile[],
      (listings ?? []) as Listing[],
      reportCountByListing
    );
  }
  // Demo mode: seed owners + localStorage moderation state.
  const suspended = new Set(readDemoSuspendedOwners());
  const deleted = new Set(readDemoDeletedOwners());
  const kycOverrides = readDemoOwnerKycOverrides();
  const profiles = DEMO_OWNERS.filter((o) => !deleted.has(o.id)).map((o) => ({
    ...o,
    kyc_status: kycOverrides[o.id] ?? o.kyc_status,
    suspended: suspended.has(o.id),
  }));
  const reportCountByListing = new Map<string, number>();
  try {
    const raw = JSON.parse(localStorage.getItem('bn-demo-reports') ?? '[]');
    if (Array.isArray(raw)) {
      for (const r of raw) {
        if (r && typeof r.listing_id === 'string') {
          reportCountByListing.set(r.listing_id, (reportCountByListing.get(r.listing_id) ?? 0) + 1);
        }
      }
    }
  } catch { /* counts stay 0 */ }
  return composeAdminOwners(profiles, applyDemoListingState(MOCK_LISTINGS), reportCountByListing);
}

export async function setOwnerSuspended(ownerId: string, suspended: boolean, label?: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('profiles').update({ suspended }).eq('id', ownerId);
    if (error) throw error;
  } else {
    const set = new Set(readDemoSuspendedOwners());
    if (suspended) set.add(ownerId);
    else set.delete(ownerId);
    writeDemoIdSet(DEMO_SUSPENDED_OWNERS_KEY, [...set]);
  }
  await logAdminAction(
    suspended ? 'owner.suspended' : 'owner.reinstated',
    'owner',
    label ?? ownerId
  );
}

// Permanent: removes the auth account server-side (profile, listings and
// rooms follow via ON DELETE CASCADE). Needs SUPABASE_SERVICE_ROLE_KEY on
// the server — the route answers 503 without it and we surface that.
export async function deleteOwnerAccount(
  ownerId: string,
  label?: string
): Promise<{ ok: boolean; message?: string }> {
  const sb = getSupabase();
  if (!sb) {
    const set = new Set(readDemoDeletedOwners());
    set.add(ownerId);
    writeDemoIdSet(DEMO_DELETED_OWNERS_KEY, [...set]);
    await logAdminAction('owner.deleted', 'owner', label ?? ownerId);
    return { ok: true };
  }
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: 'You are not signed in.' };
  try {
    const res = await fetch('/api/admin/delete-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ownerId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      return { ok: false, message: body.message ?? 'Could not delete the account.' };
    }
    await logAdminAction('owner.deleted', 'owner', label ?? ownerId);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not reach the server. Please try again.' };
  }
}

// ---- Admin action log (migration_admin_log.sql) ----
// Best-effort audit trail for moderation. logAdminAction NEVER throws:
// if the table doesn't exist yet (migration not run) the moderation
// action itself must still succeed, just unlogged.

export type AdminAction = {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: 'listing' | 'owner';
  targetLabel: string | null;
  createdAt: string;
};

const DEMO_ADMIN_ACTIONS_KEY = 'bn-demo-admin-actions';

async function logAdminAction(
  action: string,
  targetType: 'listing' | 'owner',
  targetLabel: string | null
): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) {
      const entry: AdminAction = {
        id: `demo-action-${Date.now()}`,
        adminEmail: 'admin@demo.in',
        action,
        targetType,
        targetLabel,
        createdAt: new Date().toISOString(),
      };
      let list: AdminAction[] = [];
      try {
        const raw = JSON.parse(localStorage.getItem(DEMO_ADMIN_ACTIONS_KEY) ?? '[]');
        if (Array.isArray(raw)) list = raw;
      } catch { /* start fresh */ }
      list.unshift(entry);
      localStorage.setItem(DEMO_ADMIN_ACTIONS_KEY, JSON.stringify(list.slice(0, 100)));
      return;
    }
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return;
    await sb.from('admin_actions').insert({
      admin_id: u.id,
      admin_email: u.email ?? null,
      action,
      target_type: targetType,
      target_label: targetLabel,
    });
  } catch {
    /* logging must never break moderation */
  }
}

export async function getAdminActions(): Promise<AdminAction[]> {
  const sb = getSupabase();
  if (!sb) {
    try {
      const raw = JSON.parse(localStorage.getItem(DEMO_ADMIN_ACTIONS_KEY) ?? '[]');
      return Array.isArray(raw) ? raw.slice(0, 30) : [];
    } catch {
      return [];
    }
  }
  const { data, error } = await sb
    .from('admin_actions')
    .select('id, admin_email, action, target_type, target_label, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error || !data) return []; // table missing (migration not run) — show empty
  return data.map((r) => ({
    id: r.id as string,
    adminEmail: (r.admin_email as string | null) ?? null,
    action: r.action as string,
    targetType: r.target_type as 'listing' | 'owner',
    targetLabel: (r.target_label as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
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

// ---- Owner analytics ----

const DEMO_VIEWS_KEY = 'bn-demo-view-counts';

function readDemoViews(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_VIEWS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// Count a listing-page view. Fire-and-forget: analytics must never break
// or slow down the page. Real DB: the increment_listing_view RPC.
export async function trackListingView(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.rpc('increment_listing_view', { p_listing_id: id });
    } catch {
      // RPC missing (migration not run yet) — ignore.
    }
    return;
  }
  const m = readDemoViews();
  m[id] = (m[id] ?? 0) + 1;
  localStorage.setItem(DEMO_VIEWS_KEY, JSON.stringify(m));
}

// Per-listing stats for the owner dashboard, keyed by listing id.
// Real DB: owner_listing_stats() RPC (SECURITY DEFINER, scoped to the
// caller's own listings) + the view_count column. Demo: composed from
// the local favorites / inquiries / reviews / view stores.
export async function getOwnerStats(
  ownerId: string
): Promise<Record<string, ListingStats>> {
  const sb = getSupabase();
  if (sb) {
    const [{ data: statRows }, { data: viewRows }] = await Promise.all([
      sb.rpc('owner_listing_stats'),
      sb.from('listings').select('id, view_count').eq('owner_id', ownerId),
    ]);
    const views = new Map<string, number>(
      ((viewRows ?? []) as { id: string; view_count: number | null }[]).map(
        (r) => [r.id, r.view_count ?? 0]
      )
    );
    const out: Record<string, ListingStats> = {};
    for (const r of (statRows ?? []) as {
      listing_id: string;
      saves: number;
      inquiries: number;
      visits_done: number;
      review_count: number;
      avg_rating: number | null;
    }[]) {
      out[r.listing_id] = {
        views: views.get(r.listing_id) ?? 0,
        saves: Number(r.saves),
        inquiries: Number(r.inquiries),
        visitsDone: Number(r.visits_done),
        reviewCount: Number(r.review_count),
        avgRating:
          r.avg_rating != null ? Math.round(Number(r.avg_rating) * 10) / 10 : null,
      };
    }
    for (const [id, v] of views) {
      if (!out[id]) {
        out[id] = {
          views: v,
          saves: 0,
          inquiries: 0,
          visitsDone: 0,
          reviewCount: 0,
          avgRating: null,
        };
      }
    }
    return out;
  }

  const viewsMap = readDemoViews();
  const out: Record<string, ListingStats> = {};
  const ensure = (id: string): ListingStats =>
    (out[id] ??= {
      views: viewsMap[id] ?? 0,
      saves: 0,
      inquiries: 0,
      visitsDone: 0,
      reviewCount: 0,
      avgRating: null,
    });
  for (const f of readDemoFavorites()) ensure(f.listing_id).saves++;
  for (const i of readDemoInquiries()) {
    const st = ensure(i.listing_id);
    st.inquiries++;
    if (i.status === 'done') st.visitsDone++;
  }
  const ratingsBy: Record<string, number[]> = {};
  for (const r of readDemoReviews()) {
    (ratingsBy[r.listing_id] ??= []).push(r.rating);
  }
  for (const [id, ratings] of Object.entries(ratingsBy)) {
    const st = ensure(id);
    st.reviewCount = ratings.length;
    st.avgRating =
      Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  }
  for (const id of Object.keys(viewsMap)) ensure(id);
  return out;
}

// ---- Flatmate matching ----

interface DemoFlatmateStore {
  posts: FlatmatePost[];
  interests: FlatmateInterest[];
}

const DEMO_FLAT_KEY = 'bn-demo-flatmates';

const DEMO_FLAT_SEED: DemoFlatmateStore = {
  posts: [
    {
      id: 'demo-flat-1',
      user_id: 'demo-user-rahul',
      poster_name: 'Rahul Sharma',
      poster_email: 'rahul@demo.in',
      kind: 'have_room',
      city: 'Pune',
      locality: 'Akurdi',
      budget: 7000,
      move_in: null,
      about:
        'One bed free in a 2-sharing PG room near the station. I keep things clean and quiet on weekdays.',
      tags: ['Non-smoker', 'Working professional', 'Early riser'],
      status: 'open',
      created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    },
    {
      id: 'demo-flat-2',
      user_id: 'demo-user-vikram',
      poster_name: 'Vikram Patil',
      poster_email: 'vikram@demo.in',
      kind: 'need_room',
      city: 'Pune',
      locality: 'Chinchwad',
      budget: 8000,
      move_in: null,
      about:
        'Software trainee moving to Pune next month. Looking for a shared room or a flatmate to hunt together.',
      tags: ['Student', 'Night owl', 'Non-veg ok'],
      status: 'open',
      created_at: new Date(Date.now() - 1 * 864e5).toISOString(),
    },
    {
      id: 'demo-flat-3',
      user_id: 'demo-user-arjun',
      poster_name: 'Arjun Mehta',
      poster_email: 'arjun@demo.in',
      kind: 'have_room',
      city: 'Bengaluru',
      locality: 'Koramangala',
      budget: 11000,
      move_in: null,
      about:
        'Spare room in a 2BHK, fully furnished. Flatmate should be okay with occasional guests on weekends.',
      tags: ['Works from home', 'Guests ok', 'Vegetarian'],
      status: 'open',
      created_at: new Date(Date.now() - 5 * 36e5).toISOString(),
    },
  ],
  interests: [],
};

function readDemoFlatStore(): DemoFlatmateStore {
  try {
    const raw = localStorage.getItem(DEMO_FLAT_KEY);
    if (!raw) {
      localStorage.setItem(DEMO_FLAT_KEY, JSON.stringify(DEMO_FLAT_SEED));
      return structuredClone(DEMO_FLAT_SEED);
    }
    return JSON.parse(raw) as DemoFlatmateStore;
  } catch {
    return structuredClone(DEMO_FLAT_SEED);
  }
}
function writeDemoFlatStore(store: DemoFlatmateStore) {
  localStorage.setItem(DEMO_FLAT_KEY, JSON.stringify(store));
}

export async function getFlatmatePosts(filters?: {
  kind?: FlatmateKind;
  city?: string;
}): Promise<FlatmatePost[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb
      .from('flatmate_posts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (filters?.kind) q = q.eq('kind', filters.kind);
    if (filters?.city) q = q.ilike('city', filters.city);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as FlatmatePost[];
  }
  return readDemoFlatStore().posts.filter(
    (p) =>
      p.status === 'open' &&
      (!filters?.kind || p.kind === filters.kind) &&
      (!filters?.city ||
        p.city.toLowerCase() === filters.city.trim().toLowerCase())
  );
}

export async function getMyFlatmatePosts(userId: string): Promise<FlatmatePost[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('flatmate_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FlatmatePost[];
  }
  return readDemoFlatStore().posts.filter((p) => p.user_id === userId);
}

export async function createFlatmatePost(input: {
  user_id: string;
  poster_name: string;
  poster_email?: string;
  kind: FlatmateKind;
  city: string;
  locality?: string;
  budget: number;
  move_in?: string;
  about?: string;
  tags: string[];
}): Promise<FlatmatePost> {
  const sb = getSupabase();
  if (sb) {
    const { poster_email: _ignored, ...row } = input;
    const { data, error } = await sb
      .from('flatmate_posts')
      .insert({
        ...row,
        locality: input.locality || null,
        move_in: input.move_in || null,
        about: input.about || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as FlatmatePost;
  }
  const store = readDemoFlatStore();
  const post: FlatmatePost = {
    id: `demo-flat-${Date.now()}`,
    user_id: input.user_id,
    poster_name: input.poster_name,
    poster_email: input.poster_email,
    kind: input.kind,
    city: input.city,
    locality: input.locality || null,
    budget: input.budget,
    move_in: input.move_in || null,
    about: input.about || null,
    tags: input.tags,
    status: 'open',
    created_at: new Date().toISOString(),
  };
  store.posts.unshift(post);
  writeDemoFlatStore(store);
  return post;
}

export async function setFlatmatePostStatus(
  id: string,
  status: 'open' | 'closed'
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('flatmate_posts').update({ status }).eq('id', id);
    if (error) throw error;
    return;
  }
  const store = readDemoFlatStore();
  store.posts = store.posts.map((p) => (p.id === id ? { ...p, status } : p));
  writeDemoFlatStore(store);
}

export async function deleteFlatmatePost(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('flatmate_posts').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const store = readDemoFlatStore();
  store.posts = store.posts.filter((p) => p.id !== id);
  store.interests = store.interests.filter((i) => i.post_id !== id);
  writeDemoFlatStore(store);
}

const ALREADY_INTERESTED_MSG = "You've already shown interest in this post.";

export async function expressInterest(input: {
  post_id: string;
  seeker_id: string;
  seeker_name: string;
  message?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('flatmate_interests').insert({
      post_id: input.post_id,
      seeker_id: input.seeker_id,
      seeker_name: input.seeker_name,
      message: input.message || null,
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new Error(ALREADY_INTERESTED_MSG);
      }
      throw error;
    }
    return;
  }
  const store = readDemoFlatStore();
  if (
    store.interests.some(
      (i) => i.post_id === input.post_id && i.seeker_id === input.seeker_id
    )
  ) {
    throw new Error(ALREADY_INTERESTED_MSG);
  }
  store.interests.unshift({
    id: `demo-int-${Date.now()}`,
    post_id: input.post_id,
    seeker_id: input.seeker_id,
    seeker_name: input.seeker_name,
    message: input.message || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  writeDemoFlatStore(store);
}

function attachInterestContext(
  interests: FlatmateInterest[],
  posts: FlatmatePost[]
): FlatmateInterest[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  return interests.map((i) => {
    const p = byId.get(i.post_id);
    return {
      ...i,
      post_kind: p?.kind,
      post_city: p?.city,
      post_locality: p?.locality,
      post_budget: p?.budget,
      poster_name: p?.poster_name,
    };
  });
}

// Interests received on one of my posts
export async function getInterestsForPost(
  postId: string
): Promise<FlatmateInterest[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('flatmate_interests')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FlatmateInterest[];
  }
  return readDemoFlatStore().interests.filter((i) => i.post_id === postId);
}

// Interests I sent, with the post's context attached
export async function getMyInterests(
  seekerId: string
): Promise<FlatmateInterest[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('flatmate_interests')
      .select('*, flatmate_posts(kind, city, locality, budget, poster_name)')
      .eq('seeker_id', seekerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const post = r.flatmate_posts as {
        kind: FlatmateKind;
        city: string;
        locality: string | null;
        budget: number;
        poster_name: string;
      } | null;
      const { flatmate_posts: _drop, ...rest } = r;
      return {
        ...(rest as unknown as FlatmateInterest),
        post_kind: post?.kind,
        post_city: post?.city,
        post_locality: post?.locality,
        post_budget: post?.budget,
        poster_name: post?.poster_name,
      };
    });
  }
  const store = readDemoFlatStore();
  return attachInterestContext(
    store.interests.filter((i) => i.seeker_id === seekerId),
    store.posts
  );
}

export async function setInterestStatus(
  id: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from('flatmate_interests')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    return;
  }
  const store = readDemoFlatStore();
  store.interests = store.interests.map((i) =>
    i.id === id ? { ...i, status } : i
  );
  writeDemoFlatStore(store);
}

// After an interest is accepted, reveal the other party's contact.
// Real DB: guarded RPC (accepted + participant only). Demo: poster's
// stored demo email, or the demo bachelor's inbox for seekers.
export async function getMatchContact(
  interestId: string,
  currentUserId: string
): Promise<{ email: string; full_name: string } | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.rpc('flatmate_match_contact', {
      p_interest_id: interestId,
    });
    const row = (data as { email: string; full_name: string }[] | null)?.[0];
    return row ?? null;
  }
  const store = readDemoFlatStore();
  const interest = store.interests.find((i) => i.id === interestId);
  if (!interest || interest.status !== 'accepted') return null;
  const post = store.posts.find((p) => p.id === interest.post_id);
  if (!post) return null;
  if (currentUserId === interest.seeker_id) {
    // Seeker asking → reveal the poster
    return post.poster_email
      ? { email: post.poster_email, full_name: post.poster_name }
      : null;
  }
  // Poster asking → the demo seeker is the demo bachelor
  return { email: 'bachelor@demo.in', full_name: interest.seeker_name };
}
