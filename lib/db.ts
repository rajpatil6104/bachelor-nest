import { MOCK_LISTINGS } from './mock-data';
import { getSupabase } from './supabase';
import { Inquiry, Listing, SearchFilters, VacancyAlert } from './types';

// Data layer: uses Supabase when configured, otherwise demo data.
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
    return listings;
  }
  return filterMock(filters);
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
    return data as Listing;
  }
  return MOCK_LISTINGS.find((l) => l.id === id) ?? null;
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
  return MOCK_LISTINGS;
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
  return MOCK_LISTINGS.filter((l) => l.status === 'pending');
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
  return MOCK_LISTINGS.filter((l) => ids.has(l.id));
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
