'use client';

import { useId, useState } from 'react';
import { ArrowRight, ImageOff, X } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';
import { AddToCartModal } from '@/components/designer/controls/AddToCartModal';

interface TemplatePreviewDrawerProps {
  template: {
    name: string;
    thumbnail_url?: string | null;
    artwork_config?: { width?: number; height?: number; unit?: string };
  };
  product: { id: string; name: string };
  onClose: () => void;
  prepareArtwork: () => Promise<string>;
  printSides: string;
  pageCount: number;
}

const steps = ['Set up', 'Look & feel', 'Review'] as const;

export function TemplatePreviewDrawer({ template, product, onClose, prepareArtwork, printSides, pageCount }: TemplatePreviewDrawerProps) {
  const titleId = useId();
  const [step, setStep] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail = formatImageUrl(template.thumbnail_url);
  const config = template.artwork_config;
  const dimensions = config?.width && config?.height
    ? `${config.width} × ${config.height} ${config.unit || 'mm'}`
    : null;

  return (
    <aside
      aria-labelledby={titleId}
      className="absolute inset-y-0 right-0 z-50 w-full overflow-hidden border-l border-slate-200 bg-white text-slate-900 shadow-lg sm:relative sm:z-auto sm:w-[min(40vw,420px)] sm:shrink-0 sm:shadow-none"
    >
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{product.name}</p>
              <h2 id={titleId} className="break-words text-xl font-semibold">{template.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close print options"
              className="shrink-0 rounded-full p-2 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ol aria-label="Template preview steps" className="mt-4 grid grid-cols-3 gap-2">
            {steps.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  aria-current={index === step ? 'step' : undefined}
                  onClick={() => setStep(index)}
                  className={`w-full rounded-lg px-1.5 py-2 text-xs font-semibold ${index === step
                    ? 'bg-violet-100 text-violet-800'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-4">
            {thumbnail && !imageFailed ? (
              <img
                src={thumbnail}
                alt={`${template.name} template preview`}
                onError={() => setImageFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm text-slate-600">
                <ImageOff aria-hidden="true" className="h-7 w-7" />
                Preview unavailable
              </div>
            )}
          </div>

          {step !== 1 && (
            <dl className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4 text-sm">
              {step === 2 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Template</dt>
                  <dd className="text-right font-medium">{template.name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Product</dt>
                <dd className="text-right font-medium">{product.name}</dd>
              </div>
              {dimensions && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Design size</dt>
                  <dd className="text-right font-medium">{dimensions}</dd>
                </div>
              )}
            </dl>
          )}
          {step === 2 && (
            <div className="mt-5" data-template-cart>
              <AddToCartModal
                isOpen
                onClose={onClose}
                productId={product.id}
                artworkId={null}
                prepareArtwork={prepareArtwork}
                printSides={printSides}
                pageCount={pageCount}
                artworkName={template.name}
                previewDataUrl={null}
              />
            </div>
          )}
        </div>

        <footer className="flex gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">
              Back
            </button>
          )}
          {step < steps.length - 1 && (
            <button type="button" onClick={() => setStep(step + 1)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-800">
              Continue <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </footer>
      </div>
    </aside>
  );
}
