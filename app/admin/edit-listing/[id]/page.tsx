import { connection } from 'next/server';
import EditListingForm from '@/components/owner/EditListingForm';

export const instant = false;

// Admin editing an owner's listing (linked from the Owners directory).
// The form's adminMode enforces the admin role, loads any listing
// regardless of status, and preserves the listing's status on save —
// unlike owner edits, which go back to pending for re-verification.
export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <EditListingForm listingId={id} adminMode />;
}
