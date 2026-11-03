'use client';

import { useRouter } from 'next/navigation';
import AdminVoiceAssistantPopup from '@/components/admin/AdminVoiceAssistantPopup';

export default function AdminAssistantPage() {
  const router = useRouter();
  return <AdminVoiceAssistantPopup onClose={() => router.replace('/admin/dashboard')} />;
}
