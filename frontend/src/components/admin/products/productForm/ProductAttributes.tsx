'use client';

import React from 'react';
import { FormSection } from '@/components/admin/shared';
import { ProductFormData } from './types';
import { AdvancedAttributesBuilder } from './AdvancedAttributesBuilder';
import { FrontendOptionPreview } from './FrontendOptionPreview';

interface ProductAttributesProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductAttributes: React.FC<ProductAttributesProps> = ({
  formData,
  setFormData,
}) => {
  const quantityBreaks = formData.pricing_tiers?.length > 0
    ? formData.pricing_tiers.map((t) => t.minQuantity)
    : [100, 250, 500, 1000, 2000];

  return (
    <FormSection
      title="Product Attributes, Options & Dynamic Pricing Matrix"
      description="Configure customizable customer options (Paper Stock, Sides, Size, Finish) with live quantity-break pricing and storefront preview."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Advanced Attributes Builder */}
        <div className="lg:col-span-2 space-y-6">
          <AdvancedAttributesBuilder
            attributes={formData.attributes}
            onChange={(newAttrs) => setFormData((prev) => ({ ...prev, attributes: newAttrs }))}
            quantityBreaks={quantityBreaks}
          />
        </div>

        {/* Right 1 Col: Live Storefront Option Preview Widget */}
        <div className="lg:col-span-1">
          <FrontendOptionPreview
            productName={formData.name}
            basePrice={formData.base_price}
            attributes={formData.attributes}
            quantityBreaks={quantityBreaks}
          />
        </div>
      </div>
    </FormSection>
  );
};

export default ProductAttributes;
