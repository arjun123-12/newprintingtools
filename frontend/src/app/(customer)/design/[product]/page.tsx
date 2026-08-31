import React from 'react';
import DesignEditorClient from './DesignEditorClient';

export function generateStaticParams() {
  return [{ product: 'default' }];
}

export const dynamicParams = true;

export default function DesignEditorPage({
  params,
}: {
  params: { product: string };
}) {
  return <DesignEditorClient product={params?.product} />;
}
