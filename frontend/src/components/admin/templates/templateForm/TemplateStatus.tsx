'use client';

import React from 'react';
import { FormSection, AdminSwitch } from '@/components/admin/shared';
import { TemplateFormData } from './types';

interface TemplateStatusProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
}

export const TemplateStatus: React.FC<TemplateStatusProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <FormSection
      title="Publishing & Visibility"
      description="Control whether this starter design template is published and discoverable by customers."
    >
      <AdminSwitch
        label="Template Active / Published"
        description="When active, this template appears in the customer online designer template gallery for this product."
        checked={formData.is_active}
        onChange={(val) => setFormData((prev) => ({ ...prev, is_active: val }))}
      />
    </FormSection>
  );
};

export default TemplateStatus;
