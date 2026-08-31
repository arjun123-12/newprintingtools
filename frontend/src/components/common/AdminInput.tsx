'use client';

import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface AdminInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  prefixText?: string;
  suffixText?: string;
  containerClassName?: string;
}

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  (
    {
      label,
      helperText,
      error,
      prefixIcon,
      suffixIcon,
      prefixText,
      suffixText,
      className = '',
      containerClassName = '',
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center text-xs font-semibold text-gray-700 select-none"
          >
            <span>{label}</span>
            {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center rounded-lg shadow-2xs transition-all">
          {prefixIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
              {prefixIcon}
            </div>
          )}

          {prefixText && (
            <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs rounded-l-lg select-none h-[38px]">
              {prefixText}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={`
              w-full h-[38px] px-3 text-sm text-gray-900 bg-white border rounded-lg
              placeholder:text-gray-400 transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
              ${prefixIcon ? 'pl-9' : ''}
              ${suffixIcon ? 'pr-9' : ''}
              ${prefixText ? 'rounded-l-none' : ''}
              ${suffixText ? 'rounded-r-none' : ''}
              ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />

          {suffixText && (
            <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-xs rounded-r-lg select-none h-[38px]">
              {suffixText}
            </span>
          )}

          {suffixIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-gray-400">
              {suffixIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

AdminInput.displayName = 'AdminInput';
export default AdminInput;
