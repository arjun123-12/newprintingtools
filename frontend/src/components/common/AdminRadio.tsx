'use client';

import React from 'react';

export interface RadioOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface AdminRadioGroupProps {
  name: string;
  label?: string;
  options: RadioOption[];
  value: string | number;
  onChange: (val: string | number) => void;
  layout?: 'vertical' | 'horizontal' | 'cards';
  disabled?: boolean;
  containerClassName?: string;
}

export const AdminRadioGroup: React.FC<AdminRadioGroupProps> = ({
  name,
  label,
  options,
  value,
  onChange,
  layout = 'vertical',
  disabled = false,
  containerClassName = '',
}) => {
  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <span className="block text-xs font-semibold text-gray-700 select-none">
          {label}
        </span>
      )}

      <div
        className={`
          ${layout === 'vertical' ? 'space-y-2' : ''}
          ${layout === 'horizontal' ? 'flex flex-wrap gap-4' : ''}
          ${layout === 'cards' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3' : ''}
        `}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const isDisabled = disabled || opt.disabled;

          if (layout === 'cards') {
            return (
              <label
                key={opt.value}
                className={`
                  relative flex flex-col p-3.5 border rounded-xl cursor-pointer transition-all duration-150 select-none
                  ${isSelected ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-600 shadow-xs' : 'border-gray-200 bg-white hover:border-gray-300'}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{opt.label}</span>
                  <input
                    type="radio"
                    name={name}
                    value={opt.value}
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => !isDisabled && onChange(opt.value)}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500/20"
                  />
                </div>
                {opt.description && (
                  <p className="text-[11px] text-gray-500 mt-1">{opt.description}</p>
                )}
              </label>
            );
          }

          return (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 cursor-pointer select-none ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => !isDisabled && onChange(opt.value)}
                className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500/20"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-800">{opt.label}</span>
                {opt.description && (
                  <span className="text-[11px] text-gray-500">{opt.description}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default AdminRadioGroup;
