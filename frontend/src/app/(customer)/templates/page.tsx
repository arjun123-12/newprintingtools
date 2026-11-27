'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { ArrowLeft, ArrowRight, ChevronRight, LayoutTemplate, Loader2, Palette, Search, CreditCard, Image as ImageIcon, Mail, Youtube, Workflow, FileText, BadgeCheck, Presentation, Link2 } from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface Product { id: string; name: string; }
interface Template { id: string; name: string; thumbnail_url?: string | null; artwork_config?: { width?: number; height?: number; unit?: string }; }
interface TemplateItem { template: Template; product: Product; }
interface GalleryPage { items: TemplateItem[]; category_product: Product | null; next_page: number | null; }
const templateCategories = [
  { name: 'Business Card', color: '#ecd4ff', artwork: '#b4db25', Icon: CreditCard },
  { name: 'Whiteboard', color: '#cff9e5', artwork: '#52d69a', Icon: Workflow },
  { name: 'Poster', color: '#ead2ff', artwork: '#f7f7fb', Icon: ImageIcon },
  { name: 'Doc', color: '#d2f8fb', artwork: '#80e1e4', Icon: FileText },
  { name: 'Invitation', color: '#eed5ff', artwork: '#fff0a6', Icon: Mail },
  { name: 'Logo', color: '#fff2c7', artwork: '#fff', Icon: BadgeCheck },
  { name: 'YouTube Shorts', color: '#f4d5fa', artwork: '#ef4455', Icon: Youtube },
  { name: 'Presentation', color: '#ffe1d2', artwork: '#ff9b63', Icon: Presentation },
  { name: 'Document', color: '#e8d7ff', artwork: '#fff', Icon: FileText },
  { name: 'Link in Bio', color: '#dedfff', artwork: '#ef886b', Icon: Link2 },
];

export default function CustomerTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const stripRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 250);
  const gallery = useInfiniteQuery({
    queryKey: ['template-gallery', selectedCategory, selectedCategory ? debouncedSearch : ''],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const response = await apiClient.get<{ data: GalleryPage }>('/designer/template-gallery', {
        params: {
          page: pageParam,
          per_page: selectedCategory ? 24 : 4,
          category: selectedCategory || undefined,
          search: selectedCategory ? debouncedSearch : undefined,
        },
        signal,
      });
      return response.data.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
    staleTime: 60_000,
  });
  const loading = gallery.isPending || Boolean(selectedCategory && search !== debouncedSearch);
  const firstPage = gallery.data?.pages[0];
  const categoryProduct = firstPage?.category_product;
  const visibleTemplates = gallery.data?.pages.flatMap((page) => page.items) ?? [];
  const featured = firstPage?.items ?? [];
  const selectCategory = (name: string) => { setSelectedCategory(name); setSearch(''); };
  const renderTemplateCard = (item: TemplateItem) => <Link key={`${item.product.id}-${item.template.id}`} data-template-editor onClick={() => {
    queryClient.setQueryData(['template-opening-preview', item.template.id], item.template.thumbnail_url ?? null);
  }} href={`/design/${item.product.id}?templateId=${encodeURIComponent(item.template.id)}`} className="group block min-w-0 text-left"><div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[#f1f2f4] p-3 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">{item.template.thumbnail_url ? <img src={item.template.thumbnail_url} alt={item.template.name} className="h-full w-full rounded-md object-contain" loading="lazy"/> : <div className="flex flex-col items-center gap-2 text-slate-400"><LayoutTemplate className="h-9 w-9"/><span className="text-xs">{item.template.name}</span></div>}<span className="absolute inset-x-3 bottom-3 rounded-lg bg-violet-600 py-2 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">Open template</span></div><h3 className="mt-3 truncate text-sm font-medium text-slate-900">{item.template.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{item.template.artwork_config?.width && item.template.artwork_config?.height ? `${item.template.artwork_config.width} × ${item.template.artwork_config.height} ${item.template.artwork_config.unit || 'mm'}` : item.product.name}</p></Link>;

  const galleryError = (
    <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
      Templates could not be loaded.
      <button type="button" onClick={() => void gallery.refetch()} className="ml-2 font-semibold text-violet-700 hover:underline">Try again</button>
    </div>
  );

  if (selectedCategory) return <main className="min-h-[calc(100vh-72px)] bg-[#f8f7fb] text-slate-900">
    <div className="bg-gradient-to-br from-[#d9f7f7] via-white to-[#eadcff] px-5 pb-8 pt-7 sm:px-8"><div className="mx-auto flex max-w-6xl flex-col items-center text-center">
      <button onClick={() => setSelectedCategory(null)} className="mb-4 inline-flex items-center gap-1.5 self-start text-xs font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5"/> Templates</button>
      <h1 className="text-2xl font-semibold tracking-tight text-violet-700 sm:text-3xl">What will you design today?</h1>
      <div className="relative mt-5 w-full max-w-[600px]"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search millions of templates" className="h-11 w-full rounded-xl border border-violet-200 bg-white px-11 text-sm shadow-[0_4px_16px_rgba(112,63,245,0.10)] outline-none focus:border-violet-400"/></div>
      <div className="mt-3 flex items-center gap-2"><button onClick={()=>setSelectedCategory(null)} aria-label="Clear category" className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500"><ArrowLeft className="h-3.5 w-3.5"/></button><span className="rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">{selectedCategory} <ChevronRight className="ml-1 inline h-3 w-3 rotate-90"/></span><button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Style <ChevronRight className="ml-1 inline h-3 w-3 rotate-90"/></button><button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Language <ChevronRight className="ml-1 inline h-3 w-3 rotate-90"/></button></div>
    </div></div>
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8">{loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-violet-600"/></div> : gallery.isError && !visibleTemplates.length ? galleryError : visibleTemplates.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{visibleTemplates.map(renderTemplateCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center"><LayoutTemplate className="mx-auto h-9 w-9 text-slate-300"/><p className="mt-3 text-sm font-semibold">No templates found in {selectedCategory} yet</p>{categoryProduct && <Link href={`/design/${categoryProduct.id}`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"><Palette className="h-4 w-4"/> Create a blank design</Link>}</div>}{visibleTemplates.length > 0 && gallery.hasNextPage && (
      <div className="mt-6 flex flex-col items-center gap-2">
        {gallery.isFetchNextPageError && <p role="alert" className="text-sm text-slate-600">More templates could not be loaded.</p>}
        <button type="button" disabled={gallery.isFetchingNextPage} onClick={() => void gallery.fetchNextPage()} className="rounded-lg border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-60">
          {gallery.isFetchingNextPage ? 'Loading templates…' : 'Load more templates'}
        </button>
      </div>
    )}</div>
  </main>;

  return <main className="min-h-[calc(100vh-72px)] bg-white text-slate-900"><div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12">
    <section className="mb-12"><div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Browse template categories</h1></div>
      <div className="relative"><div ref={stripRef} className="grid grid-flow-col grid-rows-2 gap-x-5 gap-y-5 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{gridAutoColumns:'203px'}}>{templateCategories.map(({name,color,artwork,Icon})=><button key={name} onClick={()=>selectCategory(name)} className="group relative flex h-[72px] items-center overflow-hidden rounded-[17px] px-3 text-left" style={{backgroundColor:color}}><span className="relative z-10 max-w-[56%] text-[13px] font-medium leading-5 text-slate-900">{name}</span><span className="absolute -right-1 bottom-[-13px] h-[58px] w-[84px] rotate-[-6deg] rounded-lg bg-white/45 shadow-sm"/><span className="absolute right-[13px] bottom-[-8px] h-[58px] w-[76px] rotate-[5deg] rounded-md border border-white/70 bg-white/75 shadow-md"/><span className="absolute right-[18px] bottom-[6px] flex h-[46px] w-[68px] rotate-[5deg] items-center justify-center rounded-md border border-white/70 shadow-md transition group-hover:scale-105" style={{backgroundColor:artwork}}><Icon className="h-7 w-7 text-slate-700/80"/><span className="absolute right-1 top-1 h-1.5 w-5 rounded-full bg-white/70"/></span></button>)}</div><button onClick={()=>stripRef.current?.scrollBy({left:430,behavior:'smooth'})} aria-label="Show more template categories" className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_3px_14px_rgba(15,23,42,.16)] transition hover:scale-105"><ChevronRight className="h-5 w-5"/></button></div>
    </section>
    <section><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Frequently used</h2><button onClick={()=>featured[0]&&selectCategory(featured[0].product.name)} className="text-sm font-medium hover:underline">See all</button></div>{loading?<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100"/>)}</div>:gallery.isError && !featured.length ? galleryError : featured.length?<div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{featured.map(renderTemplateCard)}</div>:<div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center"><p className="text-sm text-slate-500">No templates are available yet.</p><Link href="/products" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-violet-700">Browse products <ArrowRight className="h-4 w-4"/></Link></div>}</section>
  </div></main>;
}
