'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessSection } from '@/utils/adminPermissions';
import AdminVoiceAssistantPopup from '@/components/admin/AdminVoiceAssistantPopup';

export default function AdminAssistantLauncher() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user || pathname === '/admin/assistant' || !canAccessSection(user, 'orders') || !canAccessSection(user, 'enquiries')) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open voice and command assistant" className="fixed bottom-4 right-4 z-40 inline-flex min-h-14 items-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-xl shadow-sky-900/20 transition hover:bg-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-300 sm:bottom-6 sm:right-6">
      <MessageCircle className="h-5 w-5"/><span className="hidden sm:inline">Assistant</span>
    </button>
    {open && <AdminVoiceAssistantPopup onClose={() => setOpen(false)} />}
  </>;
}
