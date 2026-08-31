'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import TemplateForm from '@/components/admin/templates/templateForm/TemplateForm';

export default function EditTemplateClient({ id }: { id?: string }) {
  const hookParams = useParams<{ id: string }>();
  const resolvedId = id || hookParams?.id;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <TemplateForm mode="edit" templateId={resolvedId} />
    </div>
  );
}
