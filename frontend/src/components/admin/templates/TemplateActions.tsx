'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';

export interface TemplateActionsProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TemplateActions: React.FC<TemplateActionsProps> = ({
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          title="Refresh templates"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      )}

      <Link
        href="/admin/templates/new"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <Plus className="w-4 h-4" />
        <span>Add Template</span>
      </Link>
    </div>
  );
};

export default TemplateActions;
