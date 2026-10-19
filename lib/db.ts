import { MOCK_LISTINGS } from './mock-data';
import { getSupabase } from './supabase';
import { Listing, SearchFilters } from './types';

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
