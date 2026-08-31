'use client';

import React, { forwardRef, InputHTMLAttributes } from 'react';

export interface AdminCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  containerClassName?: string;
}

export const AdminCheckbox = forwardRef<HTMLInputElement, AdminCheckboxProps>(
  (
    {
      label,
      description,
      className = '',
      containerClassName = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `check-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className={`flex items-start gap-2.5 py-1 ${containerClassName}`}>
        <div className="flex items-center h-5">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            disabled={disabled}
            className={`
              h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 focus:ring-2
              transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
              ${className}
            `}
            {...props}
          />
        </div>
        <div className="flex flex-col select-none">
          <label
            htmlFor={checkboxId}
            className={`text-xs font-semibold cursor-pointer ${disabled ? 'text-gray-400' : 'text-gray-800'}`}
          >
            {label}
          </label>
          {description && (
            <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
    );
  }
);

AdminCheckbox.displayName = 'AdminCheckbox';
export default AdminCheckbox;
