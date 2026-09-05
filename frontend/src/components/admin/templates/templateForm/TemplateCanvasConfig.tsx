'use client';

import React from 'react';
import { FormSection } from '@/components/admin/shared';
import { TemplateFormData } from './types';
import {
  Palette,
  ExternalLink,
  Code2,
  Sparkles,
} from 'lucide-react';

interface TemplateCanvasConfigProps {
  formData: TemplateFormData;
  onLaunchStudio: () => void | Promise<void>;
  isLaunchingStudio?: boolean;
}

export const TemplateCanvasConfig: React.FC<
  TemplateCanvasConfigProps
> = ({
  formData,
  onLaunchStudio,
  isLaunchingStudio = false,
}) => {
    const objectCount =
      formData.canvas_json &&
        Array.isArray(formData.canvas_json.objects)
        ? formData.canvas_json.objects.length
        : 0;

    const canLaunchDesigner = Boolean(
      formData.product_id &&
      formData.name?.trim()
    );

    return (
      <FormSection
        title="Visual Artwork Canvas & Design Studio"
        description="Design and arrange vector text layers, logos, shapes, and placeholder artwork in the interactive visual designer."
        action={
          canLaunchDesigner ? (
            <button
              type="button"
              onClick={onLaunchStudio}
              disabled={isLaunchingStudio}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Palette className="h-3.5 w-3.5" />

              <span>
                {isLaunchingStudio
                  ? 'Opening Studio...'
                  : 'Open in Visual Studio'}
              </span>

              <ExternalLink className="ml-0.5 h-3 w-3 opacity-80" />
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Canvas status */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h4 className="font-bold text-gray-900">
                  {objectCount > 0
                    ? `Active Canvas Payload (${objectCount} vector objects)`
                    : 'Empty Canvas Initialized'}
                </h4>

                <p className="mt-0.5 text-gray-500">
                  {objectCount > 0
                    ? 'Fabric.js layers, text objects, fonts, and graphics are saved.'
                    : 'Open the visual designer to add background graphics, editable text, and logos.'}
                </p>
              </div>
            </div>

            {canLaunchDesigner ? (
              <button
                type="button"
                onClick={onLaunchStudio}
                disabled={isLaunchingStudio}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-2xs transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {isLaunchingStudio
                    ? 'Opening Studio...'
                    : 'Launch Studio'}
                </span>

                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-gray-400">
                Enter a template name and select a product
              </span>
            )}
          </div>

          {/* Canvas JSON inspector */}
          <details className="group text-xs">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 py-1 font-semibold text-gray-600 hover:text-gray-900">
              <Code2 className="h-3.5 w-3.5 text-gray-400" />
              <span>View Serialized Canvas JSON Data</span>
            </summary>

            <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-3 font-mono text-[11px] text-gray-200">
              <pre>
                {JSON.stringify(
                  formData.canvas_json || {},
                  null,
                  2
                )}
              </pre>
            </div>
          </details>
        </div>
      </FormSection>
    );
  };

export default TemplateCanvasConfig;