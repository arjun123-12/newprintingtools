'use client';

import React from 'react';

export interface AdminSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const AdminSwitch: React.FC<AdminSwitchProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className = '',
  id,
}) => {
  const switchId = id || `switch-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`flex items-start justify-between gap-4 py-2 ${className}`}>
      <div className="flex flex-col">
        <label
          htmlFor={switchId}
          className={`text-xs font-semibold select-none cursor-pointer ${disabled ? 'text-gray-400' : 'text-gray-800'}`}
        >
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
};

export default AdminSwitch;
