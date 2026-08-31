'use client';

import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface FormActionsProps {
  onCancel?: () => void;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
  cancelLabel?: string;
  saveDraftLabel?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  disabled?: boolean;
  extraActions?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  onSaveDraft,
  onSubmit,
  cancelLabel = 'Cancel',
  saveDraftLabel = 'Save Draft',
  submitLabel = 'Save Product',
  isSubmitting = false,
  isSavingDraft = false,
  disabled = false,
  extraActions,
  sticky = true,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-xs
        ${sticky ? 'sticky bottom-4 z-20 backdrop-blur-md bg-white/95' : ''}
        ${className}
      `}
    >
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {onCancel && (
          <button
            type="button"
            disabled={disabled || isSubmitting || isSavingDraft}
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
        {extraActions}
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {onSaveDraft && (
          <button
            type="button"
            disabled={disabled || isSubmitting || isSavingDraft}
            onClick={onSaveDraft}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
          >
            {isSavingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />}
            <span>{isSavingDraft ? 'Saving Draft…' : saveDraftLabel}</span>
          </button>
        )}

        <button
          type={onSubmit ? 'button' : 'submit'}
          disabled={disabled || isSubmitting || isSavingDraft}
          onClick={onSubmit}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
          <span>{isSubmitting ? 'Saving…' : submitLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default FormActions;
