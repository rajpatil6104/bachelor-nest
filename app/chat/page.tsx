import { Suspense } from 'react';
import ChatInbox from '@/components/ChatInbox';

export const metadata = {
  title: 'Chats',
  description: 'Chat directly with owners and bachelors on BachelorNest — no brokerage, no middlemen.',
};

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-zinc-500">Loading chats…</p>}>
      <ChatInbox />
    </Suspense>
  );
}
