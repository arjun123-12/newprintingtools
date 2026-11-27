'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const headingId = useId();
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
      } catch (err) {
        console.error('Error loading admin designer templates:', err);
        if (isMounted) {
          setTemplates([]);
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

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      if (!normalizedSearch) return true;

      return (
        template.title.toLowerCase().includes(normalizedSearch) ||
        template.category.toLowerCase().includes(normalizedSearch) ||
        Boolean(
          template.description
            ?.toLowerCase()
            .includes(normalizedSearch)
        )
      );
    });
  }, [templates, searchQuery]);

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
    <div className="space-y-4 px-3 pb-4 pt-3">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          type="search"
          aria-label="Search templates for this product"
          placeholder="Search templates"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <section aria-labelledby={headingId} aria-busy={loading}>
        <h3 id={headingId} className="mb-2.5 text-xs font-semibold text-slate-800">
          Templates for this product
        </h3>

        {error && (
          <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div aria-hidden="true" className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="aspect-video animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredTemplates.map((template) => {
              const isApplied = activeTemplateId === template.id;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void handleApplyTemplate(template)}
                  aria-label={`Open ${template.title} in artwork`}
                  aria-pressed={isApplied}
                  title={template.description ? `${template.title} · ${template.description}` : template.title}
                  className={`group relative aspect-video min-w-0 overflow-hidden rounded-lg border bg-slate-50 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${isApplied
                    ? 'border-violet-600 ring-1 ring-violet-600'
                    : 'border-slate-200 hover:border-violet-400'
                  }`}
                >
                  {template.thumbnailUrl ? (
                    <Image
                      src={template.thumbnailUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-contain transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <span className="flex h-full flex-col justify-center gap-1 px-2 text-white" style={{ background: template.thumbnailBg }}>
                      <LayoutTemplate aria-hidden="true" className="h-4 w-4" />
                      <span className="line-clamp-2 text-xs font-semibold leading-tight">{template.title}</span>
                    </span>
                  )}

                  {isApplied && (
                    <span className="absolute bottom-1 right-1 rounded-full bg-violet-700 p-1 text-white shadow-sm">
                      <Check aria-hidden="true" className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : !error && (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-600">
            {templates.length === 0
              ? 'No templates are available for this product.'
              : `No templates matching "${searchQuery}"`}
          </p>
        )}
      </section>
    </div>
  );
};
