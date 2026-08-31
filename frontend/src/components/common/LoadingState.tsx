'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading…',
  size = 'md',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center select-none ${className}`}>
      <Loader2 className={`${iconSizes[size]} animate-spin text-blue-600 mb-2`} />
      {message && <p className="text-xs font-medium text-gray-500">{message}</p>}
    </div>
  );
};

export default LoadingState;
