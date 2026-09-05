'use client';

import React from 'react';
import { FormSection, ArtworkFileUpload } from '@/components/admin/shared';
import { ProductFormData } from './types';

interface ProductMediaProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductMedia: React.FC<ProductMediaProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <FormSection
      title="Product Media"
      description="Upload the featured main artwork/photo and additional gallery photos or mockups."
    >
      <div className="space-y-6">
        {/* Main Featured Image */}
        <div>
          <ArtworkFileUpload
            name="featured_image"
            label="Featured Artwork (Main Listing Image)"
            description="The primary product photograph or artwork shown on catalog cards and cart previews."
            value={formData.featured_image_url}
            onChange={(val) =>
              setFormData((prev) => ({ ...prev, featured_image_url: val }))
            }
            onRemove={() =>
              setFormData((prev) => ({ ...prev, featured_image_url: '' }))
            }
            aspectRatio="square"
            multiple={false}
            required={true}
          />
        </div>

        {/* Gallery Images */}
        <div className="border-t border-gray-100 pt-5">
          <ArtworkFileUpload
            name="gallery_images"
            label="Gallery Artwork"
            description="Additional perspectives, paper textures, close-ups, or print mockups."
            value={formData.gallery_images}
            onChange={(val) =>
              setFormData((prev) => ({ ...prev, gallery_images: val }))
            }
            onSetFeatured={(featuredUrl) =>
              setFormData((prev) => ({
                ...prev,
                featured_image_url: featuredUrl,
              }))
            }
            featuredValue={formData.featured_image_url}
            multiple={true}
          />
        </div>
      </div>
    </FormSection>
  );
};

export default ProductMedia;
