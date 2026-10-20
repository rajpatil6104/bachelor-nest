import { connection } from 'next/server';
import ExpenseGroupView from '@/components/ExpenseGroupView';

export const instant = false;

export default async function ExpenseGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <ExpenseGroupView groupId={id} />;
}
