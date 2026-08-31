'use client';

import React from 'react';
import { FormSection, ImageUploader } from '@/components/admin/shared';
import { TemplateFormData } from './types';

interface TemplateThumbnailProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
}

export const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <FormSection
      title="Template Thumbnail & Preview"
      description="Upload a high-resolution preview render or mockup image to showcase this template."
    >
      <ImageUploader
        label="Thumbnail Image Preview"
        value={formData.thumbnail_url}
        onChange={(url) => setFormData((prev) => ({ ...prev, thumbnail_url: url }))}
        onRemove={() => setFormData((prev) => ({ ...prev, thumbnail_url: '' }))}
        aspectRatio="square"
        helperText="PNG, JPG, or WebP preview card image."
      />
    </FormSection>
  );
};

export default TemplateThumbnail;

