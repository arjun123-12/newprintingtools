'use client';

import React, { forwardRef, TextareaHTMLAttributes } from 'react';

export interface AdminTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showCharCount?: boolean;
  containerClassName?: string;
}

export const AdminTextarea = forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  (
    {
      label,
      helperText,
      error,
      showCharCount = false,
      maxLength,
      value,
      className = '',
      containerClassName = '',
      id,
      disabled,
      required,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className={`w-full space-y-1.5 ${containerClassName}`}>
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="flex items-center text-xs font-semibold text-gray-700 select-none"
            >
              <span>{label}</span>
              {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
            </label>
          )}

          {showCharCount && maxLength && (
            <span className="text-[11px] text-gray-400">
              {currentLength} / {maxLength}
            </span>
          )}
        </div>

        <div className="relative rounded-lg shadow-2xs">
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            maxLength={maxLength}
            value={value}
            disabled={disabled}
            required={required}
            className={`
              w-full p-3 text-sm text-gray-900 bg-white border rounded-lg resize-y
              placeholder:text-gray-400 transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
              ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />
        </div>

        {error ? (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

AdminTextarea.displayName = 'AdminTextarea';
export default AdminTextarea;
