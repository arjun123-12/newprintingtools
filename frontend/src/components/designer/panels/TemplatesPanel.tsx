'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, LayoutTemplate, Search } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignerTemplate } from '@/types/designer';
import { formatImageUrl } from '@/utils/imageUrl';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

interface TemplatesPanelProps {
  canvasManager: CanvasManager | null;

  /** Laravel UUID for the selected product, such as Business Cards. */
  productId: string;

  /** Callback fired when a template has been selected and applied to the canvas. */
  onApplyTemplate?: (template: DesignerTemplate) => void | Promise<void>;
}

type ApiTemplate = Partial<DesignerTemplate> & {
  id?: string | number;
  name?: string;
  category_name?: string;
  thumbnail_bg?: string;
  thumbnail_url?: string;
  preview_url?: string;
  canvas_json?: unknown;
  design_json?: unknown;
  template_data?: unknown;
};

type PanelTemplate = DesignerTemplate & {
  thumbnailUrl?: string;
};

const DEFAULT_THUMBNAIL_BACKGROUND =
  'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';

function parseDesignData(value: unknown): Partial<DesignerTemplate> {
  if (!value) return {};

  if (typeof value === 'object') {
    return value as Partial<DesignerTemplate>;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Partial<DesignerTemplate>;
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeTemplate(row: ApiTemplate): PanelTemplate {
  const designData = parseDesignData(
    row.canvas_json ??
    row.design_json ??
    row.template_data
  );

  const rawThumb = row.thumbnail_url ?? row.preview_url ?? (designData as any).thumbnailUrl ?? (designData as any).thumbnail_url;
  const formattedThumb = rawThumb ? formatImageUrl(rawThumb) : undefined;

  return {
    ...designData,
    ...row,
    id: String(row.id ?? designData.id ?? ''),
    title:
      row.title ??
      row.name ??
      designData.title ??
      'Untitled Template',
    category:
      row.category ??
      row.category_name ??
      designData.category ??
      'Business Cards',
    description:
      row.description ?? designData.description ?? '',
    thumbnailBg:
      row.thumbnailBg ??
      row.thumbnail_bg ??
      designData.thumbnailBg ??
      DEFAULT_THUMBNAIL_BACKGROUND,
    thumbnailUrl: formattedThumb,
    canvas_json: row.canvas_json ?? (designData as any).canvas_json ?? designData,
    back_canvas_json: (row as any).back_canvas_json ?? (designData as any).back_canvas_json,
    pages: (row as any).pages ?? (designData as any).pages,
    print_sides: (row as any).print_sides ?? (designData as any).print_sides,
  } as PanelTemplate;
}

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({
  canvasManager,
  productId,
  onApplyTemplate,
}) => {
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError('');
        setSelectedCategory('All');
        setActiveTemplateId(null);

        // This public designer endpoint contains the active templates created
        // by the admin. Products and design assets intentionally are not loaded.
        const templateEndpoint =
          productId && productId !== 'default' && productId !== 'all'
            ? `${API_URL}/designer/templates/${productId}`
            : `${API_URL}/designer/templates/all`;

        const response = await fetch(templateEndpoint, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Template request failed (${response.status}).`);
        }

        const result = await response.json();

        if (!isMounted) return;

        const rawTemplates: ApiTemplate[] = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [];
        const adminTemplates = rawTemplates
          .map(normalizeTemplate)
          .filter((template) => Boolean(template.id));

        setTemplates(adminTemplates);
        setDbCategories(
          Array.from(
            new Set(
              adminTemplates
                .map((template) => template.category?.trim())
                .filter((category): category is string => Boolean(category))
            )
          )
        );
      } catch (err) {
        console.error('Error loading admin designer templates:', err);
        if (isMounted) {
          setTemplates([]);
          setDbCategories([]);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load admin templates.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    dbCategories.forEach((cat) => categorySet.add(cat));

    templates.forEach((template) => {
      if (template.category) {
        categorySet.add(template.category);
      }
    });

    return ['All', ...Array.from(categorySet)];
  }, [dbCategories, templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        template.category.toLowerCase() ===
        selectedCategory.toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        template.title.toLowerCase().includes(normalizedSearch) ||
        template.category.toLowerCase().includes(normalizedSearch) ||
        Boolean(
          template.description
            ?.toLowerCase()
            .includes(normalizedSearch)
        );

      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleApplyTemplate = async (
    template: PanelTemplate
  ) => {
    if (!canvasManager) return;

    try {
      setError('');
      setActiveTemplateId(template.id);

      if (onApplyTemplate) {
        await onApplyTemplate(template);
      } else {
        if ((template as any).artwork_config) {
          canvasManager.initializeArtwork((template as any).artwork_config);
        }
        await canvasManager.loadTemplate(template);
      }
    } catch (applyError) {
      console.error('Template apply error:', applyError);
      setActiveTemplateId(null);
      setError('Could not apply this template to the canvas.');
    }
  };

  return (
    <div className="custom-scrollbar select-none space-y-4 p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            Templates
          </h3>
        </div>

        <span className="text-[10px] text-gray-400">
          Print Ready
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search print templates..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-1.5 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
        />
      </div>

      {categories.length > 1 && (
        <div className="custom-scrollbar flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${selectedCategory === category
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 pt-1">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {filteredTemplates.map((template) => {
            const isApplied = activeTemplateId === template.id;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => void handleApplyTemplate(template)}
                title={`Open ${template.title} in artwork`}
                className={`group relative block w-full cursor-pointer overflow-hidden rounded-2xl border bg-white text-left shadow-2xs transition hover:shadow-md ${isApplied
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-gray-200 hover:border-blue-400'
                  }`}
              >
                <div
                  className="relative flex h-28 w-full flex-col justify-between overflow-hidden p-4 transition group-hover:scale-[1.02]"
                  style={{ background: template.thumbnailBg }}
                >
                  {template.thumbnailUrl && (
                    <Image
                      src={template.thumbnailUrl}
                      alt={template.title || 'Template thumbnail'}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 320px"
                      className="object-cover"
                    />
                  )}

                  <div className="absolute inset-0 bg-black/15" />

                  <div className="relative z-10 flex items-start justify-between">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                      {template.category}
                    </span>

                    <div className="flex items-center gap-1">
                      {isApplied && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          <Check className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10">
                    <h4 className="truncate text-sm font-extrabold text-white drop-shadow-xs">
                      {template.title}
                    </h4>
                    <p className="mt-0.5 truncate text-[10px] text-white/70">
                      {template.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredTemplates.length === 0 && !error && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-xs text-gray-400">
              {templates.length === 0
                ? 'No templates are available for this product.'
                : `No templates matching "${searchQuery}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
