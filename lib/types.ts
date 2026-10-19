export type ListingType = 'pg' | 'hostel' | 'room' | 'flat' | 'coliving';
export type RoomType = 'single' | 'double' | 'triple' | 'dorm';

export interface Room {
  id: string;
  listing_id: string;
  room_type: RoomType;
  label?: string | null;
  total_beds: number;
  occupied_beds: number;
  rent_per_bed: number;
  deposit: number;
}

export interface Listing {
  id: string;
  owner_id: string;
  type: ListingType;
  title: string;
  description: string;
  address: string;
  city: string;
  locality: string;
  photos: string[];
  amenities: string[];
  house_rules: string;
  gender_allowed: 'male' | 'female' | 'any';
  status: string;
  rooms: Room[];
  avg_rating?: number;
  review_count?: number;
  rent_cycle?: string;
  created_at?: string;
}

export interface SearchFilters {
  city?: string;
  maxBudget?: number;
  type?: ListingType | '';
  roomType?: RoomType | '';
}

export type InquiryKind = 'visit' | 'callback';
export type InquiryStatus = 'pending' | 'accepted' | 'rejected' | 'done';

export interface Inquiry {
  id: string;
  listing_id: string;
  tenant_id: string;
  kind: InquiryKind;
  status: InquiryStatus;
  preferred_date: string | null;
  message: string | null;
  created_at: string;
  listing_title?: string;
  listing_locality?: string;
  listing_city?: string;
  tenant_name?: string;
}

export interface VacancyAlert {
  id: string;
  tenant_id: string;
  city: string;
  locality: string | null;
  max_budget: number | null;
  room_type: RoomType | null;
  created_at: string;
}

export const availableBeds = (room: Room) => room.total_beds - room.occupied_beds;

export const listingAvailableBeds = (listing: Listing) =>
  listing.rooms.reduce((sum, r) => sum + availableBeds(r), 0);

export const minRent = (listing: Listing) =>
  listing.rooms.length ? Math.min(...listing.rooms.map((r) => r.rent_per_bed)) : 0;

export const TYPE_LABELS: Record<ListingType, string> = {
  pg: 'PG',
  hostel: 'Hostel',
  room: 'Room',
  flat: 'Flat',
  coliving: 'Co-living',
};

export const ROOM_LABELS: Record<RoomType, string> = {
  single: 'Single sharing',
  double: 'Double sharing',
  triple: 'Triple sharing',
  dorm: 'Dorm',
};

export const AMENITY_OPTIONS = [
  'Food included',
  'WiFi',
  'AC',
  'Laundry',
  'Parking',
  'Power backup',
  'Housekeeping',
  'Gym',
  'Hot water',
  'Furnished',
];

// Categorized amenities for the owner listing wizard (ManagR-style)
export const AMENITY_CATEGORIES: { title: string; items: string[] }[] = [
  {
    title: 'Safety',
    items: ['CCTV', 'Security Guard', 'Gated Society', 'Intercom'],
  },
  {
    title: 'Recreation',
    items: ['Gym', 'Swimming Pool', 'Clubhouse', 'Garden / Terrace'],
  },
  {
    title: 'Convenience',
    items: ['Lift / Elevator', 'Power backup', 'RO Water', 'Housekeeping'],
  },
  {
    title: 'Parking',
    items: ['2-Wheeler Parking', '4-Wheeler Parking'],
  },
  {
    title: 'Room comfort',
    items: ['AC', 'Furnished', 'Hot water', 'WiFi', 'Food included', 'Laundry', 'TV', 'Fridge'],
  },
];

export const SERVICE_OPTIONS = [
  { id: 'Cleaning', desc: 'Regular housekeeping' },
  { id: 'Meals', desc: 'Food options' },
  { id: 'Laundry', desc: 'Washing facilities' },
  { id: 'WiFi', desc: 'Internet included' },
  { id: 'RO Water', desc: 'Drinking water provided' },
];

export const RULE_CHIPS: { title: string; items: string[] }[] = [
  {
    title: 'Lifestyle',
    items: ['No drinking', 'No smoking', 'Non-veg Not Allowed', 'Non-veg Allowed'],
  },
  {
    title: 'Guest policy',
    items: ['No guests', 'No overnight stays', 'Same-gender guests only', 'No male guests', 'No female guests'],
  },
  {
    title: 'Curfew',
    items: ['No curfew', 'Gate closes by 10 PM', 'Gate closes by 11 PM'],
  },
];

export interface Review {
  id: string;
  listing_id: string;
  tenant_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
