'use client';

import React, { useRef } from 'react';
import { FormSection, ImageUploader } from '@/components/admin/shared';
import { ProductFormData } from './types';
import { Plus, Trash2, Star } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

interface ProductMediaProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductMedia: React.FC<ProductMediaProps> = ({
  formData,
  setFormData,
}) => {
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleAddGalleryImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setFormData((prev) => ({
            ...prev,
            gallery_images: [...prev.gallery_images, dataUrl],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index),
    }));
  };

  const setAsFeatured = (imgUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      featured_image_url: imgUrl,
    }));
  };

  return (
    <FormSection
      title="Product Media"
      description="Upload the featured main image and additional product gallery photos or print mockups."
    >
      <div className="space-y-6">
        {/* Main Featured Image */}
        <div>
          <ImageUploader
            label="Featured Image (Main Listing Image)"
            value={formData.featured_image_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, featured_image_url: url }))}
            onRemove={() => setFormData((prev) => ({ ...prev, featured_image_url: '' }))}
            aspectRatio="square"
            helperText="The primary product photograph shown on catalog cards and cart previews."
          />
        </div>

        {/* Gallery Images */}
        <div className="space-y-2 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-gray-700 select-none">
                Gallery Images ({formData.gallery_images.length})
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Additional perspectives, close-ups of paper textures, or finish effects.
              </p>
            </div>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Images</span>
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => {
                handleAddGalleryImages(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {formData.gallery_images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
              {formData.gallery_images.map((imgUrl, index) => {
                const isFeatured = formData.featured_image_url === imgUrl;
                return (
                  <div
                    key={index}
                    className={`relative group rounded-xl border overflow-hidden bg-gray-50 aspect-square flex items-center justify-center transition-all ${isFeatured ? 'ring-2 ring-blue-600 border-blue-600' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formatImageUrl(imgUrl)}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-full object-contain p-1 rounded-lg"
                    />

                    {isFeatured && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        Featured
                      </span>
                    )}

                    <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2 backdrop-blur-2xs">
                      {!isFeatured && (
                        <button
                          type="button"
                          onClick={() => setAsFeatured(imgUrl)}
                          title="Set as featured"
                          className="p-1.5 bg-white text-gray-700 hover:text-blue-600 rounded-lg shadow-sm transition-colors text-[10px] font-semibold"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(index)}
                        title="Delete image"
                        className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
            >
              <p className="text-xs font-semibold text-gray-700">No gallery images uploaded yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Click to browse multiple photos or mockups</p>
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
};

export default ProductMedia;
