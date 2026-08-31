'use client';

import React from 'react';
import Link from 'next/link';
import { FormSection } from '@/components/admin/shared';
import { TemplateFormData } from './types';
import { Palette, ExternalLink, Code2, Sparkles, CheckCircle2 } from 'lucide-react';

interface TemplateCanvasConfigProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  templateId?: string;
}

export const TemplateCanvasConfig: React.FC<TemplateCanvasConfigProps> = ({
  formData,
  setFormData,
  templateId,
}) => {
  const objectCount =
    formData.canvas_json && Array.isArray(formData.canvas_json.objects)
      ? formData.canvas_json.objects.length
      : 0;

  const designerUrl = formData.product_id
    ? `/admin/designer?productId=${formData.product_id}${templateId ? `&templateId=${templateId}` : ''}`
    : null;

  return (
    <FormSection
      title="Visual Artwork Canvas & Design Studio"
      description="Design and arrange vector text layers, logos, shapes, and placeholder artwork in the interactive visual designer."
      action={
        designerUrl ? (
          <Link
            href={designerUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Open in Visual Studio</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Status card */}
        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">
                {objectCount > 0
                  ? `Active Canvas Payload (${objectCount} vector objects)`
                  : 'Empty Canvas Initialized'}
              </h4>
              <p className="text-gray-500 mt-0.5">
                {objectCount > 0
                  ? 'Fabric.js layers, text objects, fonts, and graphics are saved.'
                  : 'Open the visual designer to add background graphics, editable text, and logos.'}
              </p>
            </div>
          </div>

          {designerUrl ? (
            <Link
              href={designerUrl}
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shrink-0 shadow-2xs"
            >
              <span>Launch Studio</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <span className="text-[11px] font-semibold text-gray-400">
              Select product above to enable designer
            </span>
          )}
        </div>

        {/* JSON inspector toggle / view */}
        <details className="text-xs group">
          <summary className="cursor-pointer font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 py-1 select-none">
            <Code2 className="w-3.5 h-3.5 text-gray-400" />
            <span>View Serialized Canvas JSON Data</span>
          </summary>
          <div className="mt-2 p-3 bg-gray-900 text-gray-200 rounded-xl font-mono text-[11px] max-h-60 overflow-y-auto border border-gray-800">
            <pre>{JSON.stringify(formData.canvas_json || {}, null, 2)}</pre>
          </div>
        </details>
      </div>
    </FormSection>
  );
};

export default TemplateCanvasConfig;
