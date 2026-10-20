import { connection } from 'next/server';
import AgreementDoc from '@/components/AgreementDoc';

export const instant = false;

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <AgreementDoc agreementId={id} />;
}
