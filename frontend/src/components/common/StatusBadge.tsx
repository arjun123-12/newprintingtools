'use client';

import React from 'react';

export type StatusType =
  | 'active'
  | 'inactive'
  | 'draft'
  | 'published'
  | 'archived'
  | 'completed'
  | 'pending'
  | 'failed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  className = '',
}) => {
  const norm = String(status).toLowerCase();
  const displayLabel = label || norm.charAt(0).toUpperCase() + norm.slice(1);

  const getVariant = () => {
    switch (norm) {
      case 'active':
      case 'published':
      case 'completed':
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dot-emerald-500';
      case 'draft':
      case 'pending':
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dot-amber-500';
      case 'archived':
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200 dot-gray-400';
      case 'failed':
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dot-rose-500';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dot-blue-500';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dot-gray-400';
    }
  };

  const variantClass = getVariant();
  const dotColor = variantClass.split(' ').find((c) => c.startsWith('dot-'))?.replace('dot-', 'bg-') || 'bg-gray-400';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-full border select-none
        ${size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}
        ${variantClass.replace(/dot-\w+-\d+/, '')}
        ${className}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;
