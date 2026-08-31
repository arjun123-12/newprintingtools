'use client';

import React, { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface AdminSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  helperText?: string;
  error?: string;
  placeholder?: string;
  prefixIcon?: ReactNode;
  containerClassName?: string;
}

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  (
    {
      label,
      options = [],
      helperText,
      error,
      placeholder,
      prefixIcon,
      className = '',
      containerClassName = '',
      id,
      disabled,
      required,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="flex items-center text-xs font-semibold text-gray-700 select-none"
          >
            <span>{label}</span>
            {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center rounded-lg shadow-2xs">
          {prefixIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
              {prefixIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            className={`
              w-full h-[38px] px-3 pr-8 text-sm text-gray-900 bg-white border rounded-lg appearance-none
              transition-colors duration-150 cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
              ${prefixIcon ? 'pl-9' : ''}
              ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          <div className="absolute right-3 flex items-center pointer-events-none text-gray-400">
            <ChevronDown className="w-4 h-4" />
          </div>
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

AdminSelect.displayName = 'AdminSelect';
export default AdminSelect;
