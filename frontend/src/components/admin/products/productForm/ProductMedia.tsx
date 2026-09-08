'use client';

import React, { useState } from 'react';
import { FormSection, ArtworkFileUpload } from '@/components/admin/shared';
import { ProductFormData, ProductSideItem } from './types';
import { ProductSidesPreview } from './ProductSidesPreview';
import { Layers, Plus, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

interface ProductMediaProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  sideIndex: number;
  onSelectSide?: (index: number) => void;
}

export const ProductMedia: React.FC<ProductMediaProps> = ({
  formData,
  setFormData,
  sideIndex,
  onSelectSide,
}) => {
  const side = formData.sides[sideIndex] || formData.sides[0];
  const isFront = sideIndex === 0;

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Helper to extract a single clean string URL from ArtworkFileUpload's val
  const extractUrl = (rawVal: any): string | undefined => {
    if (!rawVal) return undefined;
    if (Array.isArray(rawVal)) {
      return rawVal.length > 0 && typeof rawVal[0] === 'string' && rawVal[0].trim().length > 0
        ? rawVal[0].trim()
        : undefined;
    }
    if (typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  };

  // Upload file immediately to server to get permanent storage URL
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      const res = await fetch(`${API_URL}/designer/uploads/canvas-image`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: uploadFormData,
      });

      const json = await res.json();
      if (json.success && json.data?.url) {
        setFormData((prev) => {
          const newSides = [...prev.sides];
          if (newSides[sideIndex]) {
            newSides[sideIndex] = {
              ...newSides[sideIndex],
              background_image_url: json.data.url,
            };
          }
          return { ...prev, sides: newSides };
        });
      } else {
        throw new Error(json.message || 'Server upload failed');
      }
    } catch (err: any) {
      console.warn('Direct upload error (will fallback to submit upload):', err);
      // Even if direct upload fails, local preview remains set via onChange
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to quickly add Back Side (2-sided product)
  const handleAddBackSide = () => {
    setFormData((prev) => {
      const nextNumber = prev.sides.length + 1;
      const newSide: ProductSideItem = {
        side_number: nextNumber,
        name: nextNumber === 2 ? 'Back' : `Side ${nextNumber}`,
        type: nextNumber === 2 ? 'back' : 'inside',
        sort_order: nextNumber,
        is_active: true,
        print_areas: prev.sides[0]?.print_areas?.map((pa, idx) => ({
          ...pa,
          id: `area_back_${Date.now()}_${idx}`,
          name: pa.name.replace(/front/i, 'Back'),
        })) || [],
      };

      return {
        ...prev,
        sides_count: nextNumber,
        sides: [...prev.sides, newSide],
      };
    });

    if (onSelectSide) {
      onSelectSide(formData.sides.length);
    }
  };

  return (
    <div className="space-y-6">
      <FormSection
        title={`${side?.name || `Side ${sideIndex + 1}`} Media & Mockup`}
        description={`Upload the ${isFront ? 'featured main artwork and ' : ''}background mockup or design layer for this side.`}
      >
        <div className="space-y-6">
          {/* Quick Side Switcher / Tab Bar */}
          <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Configure Side:</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {formData.sides.map((s, idx) => {
                  const isCurrent = idx === sideIndex;
                  return (
                    <button
                      key={s.id || idx}
                      type="button"
                      onClick={() => onSelectSide?.(idx)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {s.name || `Side ${idx + 1}`}
                      {s.background_image_url && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.sides.length === 1 && (
              <button
                type="button"
                onClick={handleAddBackSide}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Back Side</span>
              </button>
            )}
          </div>

          {/* Main Featured Image (Only for Front) */}
          {isFront && (
            <div>
              <ArtworkFileUpload
                name="featured_image"
                label="Featured Artwork (Main Listing Image)"
                description="The primary product photograph or artwork shown on catalog cards and cart previews."
                value={formData.featured_image_url}
                onChange={(val) => {
                  const clean = extractUrl(val);
                  setFormData((prev) => ({ ...prev, featured_image_url: clean || '' }));
                }}
                onRemove={() =>
                  setFormData((prev) => ({ ...prev, featured_image_url: '' }))
                }
                aspectRatio="square"
                multiple={false}
                required={true}
              />
            </div>
          )}

          {/* Side Background / Mockup Upload */}
          <div className={isFront ? 'border-t border-gray-100 pt-5' : ''}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {isUploading && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading to server…
                  </span>
                )}
                {side?.background_image_url && !isUploading && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    <Sparkles className="w-3 h-3" />
                    Mockup Attached
                  </span>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <ArtworkFileUpload
              name={`side_${sideIndex}_media`}
              label={`${side?.name || `Side ${sideIndex + 1}`} Background / Mockup`}
              description="Background design layer, preview mockup, or paper texture for this side."
              value={side?.background_image_url ? [side.background_image_url] : []}
              onFileChange={handleFileUpload}
              onChange={(val) => {
                const clean = extractUrl(val);
                setFormData((prev) => {
                  const newSides = [...prev.sides];
                  if (newSides[sideIndex]) {
                    newSides[sideIndex] = {
                      ...newSides[sideIndex],
                      background_image_url: clean,
                    };
                  }
                  return { ...prev, sides: newSides };
                });
              }}
              onRemove={() => {
                setFormData((prev) => {
                  const newSides = [...prev.sides];
                  if (newSides[sideIndex]) {
                    newSides[sideIndex] = {
                      ...newSides[sideIndex],
                      background_image_url: undefined,
                    };
                  }
                  return { ...prev, sides: newSides };
                });
              }}
              onSetFeatured={
                isFront
                  ? (featuredUrl) =>
                      setFormData((prev) => ({
                        ...prev,
                        featured_image_url: featuredUrl,
                      }))
                  : undefined
              }
              featuredValue={isFront ? formData.featured_image_url : undefined}
              multiple={false}
            />
          </div>
        </div>
      </FormSection>

      {/* Live Sides Preview Section (Front & Back) */}
      <ProductSidesPreview
        formData={formData}
        setFormData={setFormData}
        activeSideIndex={sideIndex}
        onSelectSide={onSelectSide}
      />
    </div>
  );
};

export default ProductMedia;
