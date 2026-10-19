export type ListingType = 'pg' | 'hostel' | 'room' | 'flat' | 'coliving';
export type RoomType = 'single' | 'double' | 'triple' | 'dorm';

export interface Room {
  id: string;
  listing_id: string;
  room_type: RoomType;
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
}

export interface SearchFilters {
  city?: string;
  maxBudget?: number;
  type?: ListingType | '';
  roomType?: RoomType | '';
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
