'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PreflightReport, PreflightCheckItem } from '../utils/preflightCheck';
import { CanvasManager } from '../canvas/CanvasManager';

interface PreflightBadgeProps {
  report: PreflightReport;
  canvasManager: CanvasManager | null;
}

export const PreflightBadge: React.FC<PreflightBadgeProps> = ({
  report,
  canvasManager,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSelectOffending = (check: PreflightCheckItem) => {
    if (!canvasManager || !check.offendingObjectIds || check.offendingObjectIds.length === 0) return;
    const firstId = check.offendingObjectIds[0];
    canvasManager.selectObjectById(firstId);
  };

  const getHeaderStyle = () => {
    if (report.overallStatus === 'error') {
      return {
        bg: 'bg-rose-600',
        title: 'PRINT ERRORS',
        badge: `${report.issuesCount} Alert${report.issuesCount > 1 ? 's' : ''}`,
        badgeBg: 'bg-rose-700/90 text-white',
      };
    }
    if (report.overallStatus === 'warning') {
      return {
        bg: 'bg-amber-600',
        title: 'PRINT WARNINGS',
        badge: `${report.issuesCount} Alert${report.issuesCount > 1 ? 's' : ''}`,
        badgeBg: 'bg-amber-700/90 text-white',
      };
    }
    return {
      bg: 'bg-[#00875a]', // Exact Canva/Print Preflight Emerald Green
      title: 'READY FOR PRINT',
      badge: 'Check',
      badgeBg: 'bg-[#006644] text-white',
    };
  };

  const header = getHeaderStyle();

  // Exactly match user screenshot layout:
  // Col 1: Safe Margin, Bleed Area, Missing Images, Missing QR
  // Col 2: Trim Line, Low Resolution, Missing Logo, Empty Text
  const col1Ids = ['safe-margin', 'bleed-area', 'trim-line'];
  // const col2Ids = [];

  const getCheckById = (id: string): PreflightCheckItem => {
    return report.checks.find((c) => c.id === id) || { id: id as any, label: id, status: 'pass' };
  };

  const renderCheckRow = (item: PreflightCheckItem) => {
    const isPass = item.status === 'pass';
    const isWarning = item.status === 'warning';
    const isError = item.status === 'error';

    return (
      <div
        key={item.id}
        onClick={() => !isPass && handleSelectOffending(item)}
        title={item.message || item.label}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-lg transition text-[11px] font-semibold select-none ${!isPass
          ? 'bg-amber-50 text-amber-900 cursor-pointer hover:bg-amber-100 ring-1 ring-amber-200'
          : 'text-gray-800 hover:bg-gray-50'
          }`}
      >
        {/* Exact Green Circular Checkmark or Alert icon */}
        {isPass ? (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-[#00875a] flex items-center justify-center flex-shrink-0">
            <svg
              className="w-2.5 h-2.5 text-[#00875a]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isWarning ? (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-amber-600 bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-amber-700">!</span>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-rose-600 bg-rose-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-rose-700">×</span>
          </div>
        )}

        <span className="truncate tracking-tight">{item.label}</span>
      </div>
    );
  };

  return (
    <div className="w-[250px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Top Header Card Banner */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`${header.bg} text-white px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors`}
      >
        <div className="flex items-center gap-2">
          {report.overallStatus === 'ready' ? (
            <ShieldCheck className="w-4 h-4 text-white" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-white" />
          )}
          <span className="font-extrabold text-xs tracking-wider uppercase drop-shadow-2xs">
            {header.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${header.badgeBg}`}>
            {header.badge}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-white opacity-90" />
          ) : (
            <ChevronUp className="w-4 h-4 text-white opacity-90" />
          )}
        </div>
      </div>

      {/* Expanded Checklist Body (Exactly 2 columns matching user reference) */}
      {isExpanded && (
        <div className="p-3.5 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {/* Column 1 */}
            <div className="space-y-1">
              {col1Ids.map((id) => renderCheckRow(getCheckById(id)))}
            </div>

            {/* Column 2 */}
            {/* <div className="space-y-1">
              {col2Ids.map((id) => renderCheckRow(getCheckById(id)))}
            </div> */}
          </div>

          {/* Advice alert footnote if any check failed */}
          {report.issuesCount > 0 && (
            <div className="pt-2 border-t border-gray-100 text-[10px] text-amber-800 bg-amber-50/70 p-2 rounded-lg leading-tight">
              <span className="font-bold block mb-0.5">Print Quality Warning:</span>
              {report.checks
                .filter((c) => c.status !== 'pass')
                .map((c) => (
                  <div key={c.id}>
                    • <strong>{c.label}:</strong> {c.message}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
