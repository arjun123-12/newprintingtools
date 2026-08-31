'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FormSection } from '@/components/admin/shared';
import { ProductFormData } from './types';
import { LayoutTemplate, ExternalLink, Loader2 } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

interface ProductTemplatesProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  productId?: string;
}

interface TemplateItem {
  id: string;
  name: string;
  category?: string;
  thumbnail_url?: string;
  is_active: boolean;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export const ProductTemplates: React.FC<ProductTemplatesProps> = ({
  productId,
}) => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!productId) return;

    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/designer/templates/${productId}`);
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setTemplates(result.data);
        }
      } catch (err) {
        console.warn('Could not load product design templates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [productId]);

  return (
    <FormSection
      title="Design Templates"
      description="Connect pre-designed vector artwork templates that customers can personalize in the interactive online editor."
      action={
        productId ? (
          <Link
            href={`/admin/designer?productId=${productId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
          >
            <span>Open Template Designer</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 hover:border-gray-300 transition-all shadow-2xs group"
            >
              <div className="aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 relative">
                {tpl.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formatImageUrl(tpl.thumbnail_url)}
                    alt={tpl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <LayoutTemplate className="w-8 h-8 text-gray-300" />
                )}
                {tpl.is_active && (
                  <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Active
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-900 truncate">{tpl.name}</h4>
                <p className="text-[11px] text-gray-400">{tpl.category || 'General'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-center">
          <LayoutTemplate className="w-6 h-6 text-gray-400 mb-2" />
          <p className="text-xs font-semibold text-gray-700">No design templates linked to this product</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {productId
              ? 'Click "Open Template Designer" to create a new print template for this product.'
              : 'Save this product first to attach and design templates.'}
          </p>
        </div>
      )}
    </FormSection>
  );
};

export default ProductTemplates;
