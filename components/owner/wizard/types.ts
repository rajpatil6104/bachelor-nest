import { ListingType, RoomType } from '@/lib/types';

export interface WizardRoomInput {
  room_type: RoomType;
  label: string;
  total_beds: number;
  rent_per_bed: number;
  deposit: number;
  available: boolean;
}

export type RentCycle = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';

export interface WizardDraft {
  title: string;
  type: ListingType;
  city: string;
  locality: string;
  address: string;
  lat: number | null;
  lng: number | null;
  description: string;
  proofDocs: File[];
  rentCycle: RentCycle;
  rooms: WizardRoomInput[];
  flatSpaces: WizardRoomInput[];
  roomInfo: WizardRoomInput;
  photos: { file: File; preview: string }[];
  amenities: string[];
  services: string[];
  rules: string[];
  customRule: string;
}

export const initialDraft = (): WizardDraft => ({
  title: '',
  type: 'pg',
  city: '',
  locality: '',
  address: '',
  lat: null,
  lng: null,
  description: '',
  proofDocs: [],
  rentCycle: 'monthly',
  rooms: [
    { room_type: 'double', label: '', total_beds: 6, rent_per_bed: 8000, deposit: 8000, available: true },
  ],
  flatSpaces: [
    { room_type: 'single', label: 'Master bedroom', total_beds: 1, rent_per_bed: 12000, deposit: 24000, available: true },
  ],
  roomInfo:
    { room_type: 'single', label: 'Private room', total_beds: 1, rent_per_bed: 9000, deposit: 18000, available: true },
  photos: [],
  amenities: [],
  services: [],
  rules: [],
  customRule: '',
});

export const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700';

export const TYPE_CARDS: { value: ListingType; title: string; desc: string }[] = [
  { value: 'pg', title: 'PG', desc: 'Students & pros' },
  { value: 'hostel', title: 'Hostel', desc: 'Beds in shared rooms' },
  { value: 'flat', title: 'Flat', desc: 'Rent the whole unit' },
  { value: 'room', title: 'Room', desc: 'A single room' },
  { value: 'coliving', title: 'Co-living', desc: 'Managed community' },
];
