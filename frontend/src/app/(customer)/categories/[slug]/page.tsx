export default function CategoryDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Category: {params.slug}</h1>
      <p className="text-slate-600">Explore products in this category.</p>
    </div>
  );
}
