'use client';

import React, { forwardRef, InputHTMLAttributes } from 'react';

export interface AdminNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number | string;
  onChange?: (val: number | '') => void;
  containerClassName?: string;
}

export const AdminNumberInput = forwardRef<HTMLInputElement, AdminNumberInputProps>(
  (
    {
      label,
      helperText,
      error,
      prefix,
      suffix,
      min,
      max,
      step = 1,
      value,
      onChange,
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
        onChange?.('');
      } else {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          onChange?.(num);
        }
      }
    };

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

        <div className="relative flex items-center rounded-lg shadow-2xs">
          {prefix && (
            <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-600 text-xs font-medium rounded-l-lg select-none h-[38px]">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            type="number"
            id={inputId}
            min={min}
            max={max}
            step={step}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            className={`
              w-full h-[38px] px-3 text-sm text-gray-900 bg-white border rounded-lg
              placeholder:text-gray-400 transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
              ${prefix ? 'rounded-l-none' : ''}
              ${suffix ? 'rounded-r-none' : ''}
              ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />

          {suffix && (
            <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-xs rounded-r-lg select-none h-[38px]">
              {suffix}
            </span>
          )}
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

AdminNumberInput.displayName = 'AdminNumberInput';
export default AdminNumberInput;
