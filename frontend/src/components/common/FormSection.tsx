'use client';

import React, { ReactNode } from 'react';

export interface FormSectionProps {
  id?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  id,
  title,
  description,
  badge,
  action,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
}) => {
  return (
    <section
      id={id}
      className={`bg-white rounded-xl border border-gray-200/90 shadow-xs overflow-hidden transition-all ${className}`}
    >
      <div
        className={`px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/40 ${headerClassName}`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>

        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
};

export default FormSection;
