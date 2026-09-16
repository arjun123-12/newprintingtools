import React from 'react';

interface CategoryDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return [{ slug: 'default' }];
}

export const dynamicParams = true;

export default async function CategoryDetailPage({
  params,
}: CategoryDetailPageProps) {
  const { slug } = await params;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="mb-4 text-3xl font-bold text-slate-900">
        Category: {slug}
      </h1>

      <p className="text-slate-600">
        Explore products in this category.
      </p>
    </div>
  );
}