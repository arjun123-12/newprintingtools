import React from 'react';
import EditTemplateClient from './EditTemplateClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export const dynamicParams = true;

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  return <EditTemplateClient id={params?.id} />;
}
