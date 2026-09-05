'use client';

import React from 'react';
import { FormSection, ArtworkFileUpload } from '@/components/admin/shared';
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
      <ArtworkFileUpload
        name="thumbnail_url"
        label="Thumbnail Artwork Preview"
        value={formData.thumbnail_url}
        onChange={(url) =>
          setFormData((prev) => ({ ...prev, thumbnail_url: url }))
        }
        onRemove={() =>
          setFormData((prev) => ({ ...prev, thumbnail_url: '' }))
        }
        aspectRatio="square"
        multiple={false}
        helperText="JPG, PNG, SVG, PDF, TIF, TIFF preview card image."
      />
    </FormSection>
  );
};

export default TemplateThumbnail;
