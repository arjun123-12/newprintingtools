'use client';

import React from 'react';
import TemplateForm from '@/components/admin/templates/templateForm/TemplateForm';

export default function CreateTemplatePage() {
  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <TemplateForm mode="create" />
    </div>
  );
}
