import { connection } from 'next/server';
import EditListingForm from '@/components/owner/EditListingForm';

export const instant = false;

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <EditListingForm listingId={id} />;
}
