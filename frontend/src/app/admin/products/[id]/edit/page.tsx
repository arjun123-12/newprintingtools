import React from 'react';
import EditProductClient from './EditProductClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export const dynamicParams = true;

export default function EditProductPage({ params }: { params: { id: string } }) {
  return <EditProductClient id={params?.id} />;
}
