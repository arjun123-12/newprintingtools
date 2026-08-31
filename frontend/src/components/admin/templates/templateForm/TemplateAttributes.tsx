'use client';

import React from 'react';
import { FormSection } from '@/components/admin/shared';
import { TemplateFormData } from './types';
import { AdvancedAttributesBuilder } from '@/components/admin/products/productForm/AdvancedAttributesBuilder';
import { FrontendOptionPreview } from '@/components/admin/products/productForm/FrontendOptionPreview';

interface TemplateAttributesProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
}

export const TemplateAttributes: React.FC<TemplateAttributesProps> = ({
  formData,
  setFormData,
}) => {
  const attributes = formData.attributes || [];
  const quantityBreaks = [100, 250, 500, 1000, 2000];

  return (
    <FormSection
      title="Template Printing Options & Storefront Configurator"
      description="Configure customizable print specifications (Paper Stock, Sides, Dimensions, Coating) linked to this design template."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Advanced Attributes Builder */}
        <div className="lg:col-span-2 space-y-6">
          <AdvancedAttributesBuilder
            attributes={attributes}
            onChange={(newAttrs) => setFormData((prev) => ({ ...prev, attributes: newAttrs }))}
            quantityBreaks={quantityBreaks}
          />
        </div>

        {/* Right 1 Col: Live Storefront Option Preview Widget */}
        <div className="lg:col-span-1">
          <FrontendOptionPreview
            productName={formData.name || 'Design Template'}
            basePrice={29.99}
            attributes={attributes}
            quantityBreaks={quantityBreaks}
          />
        </div>
      </div>
    </FormSection>
  );
};

export default TemplateAttributes;
