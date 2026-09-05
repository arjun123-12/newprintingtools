'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Scissors,
  Shield,
  Frame,
  ExternalLink,
} from 'lucide-react';
import { PreflightReport, PreflightCheckItem, AlertMessage } from '../utils/preflightCheck';
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

  const handleSelectAlert = (alert: AlertMessage) => {
    if (!canvasManager || !alert.objectIds || alert.objectIds.length === 0) return;
    canvasManager.selectObjectById(alert.objectIds[0]);
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
      bg: 'bg-[#00875a]',
      title: 'READY FOR PRINT',
      badge: 'All Clear',
      badgeBg: 'bg-[#006644] text-white',
    };
  };

  const header = getHeaderStyle();

  const col1Ids = ['safe-margin', 'trim-line', 'bleed-area'];

  const getCheckById = (id: string): PreflightCheckItem => {
    return report.checks.find((c) => c.id === id) || { id: id as any, label: id, status: 'pass' };
  };

  const renderCheckRow = (item: PreflightCheckItem) => {
    const isPass = item.status === 'pass';

    return (
      <div
        key={item.id}
        onClick={() => !isPass && handleSelectOffending(item)}
        title={item.message || item.label}
        className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${!isPass
          ? 'text-amber-700 cursor-pointer hover:text-amber-800'
          : 'text-gray-700'
          }`}
      >
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isPass ? 'bg-[#00875a]/10' : (item.status === 'warning' ? 'bg-amber-100' : 'bg-rose-100')}`}>
          {isPass ? (
            <svg className="w-3 h-3 text-[#00875a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : item.status === 'warning' ? (
            <span className="text-[10px] font-bold text-amber-700">!</span>
          ) : (
            <span className="text-[10px] font-bold text-rose-700">×</span>
          )}
        </div>
        <span className="whitespace-nowrap tracking-tight">{item.label}</span>
      </div>
    );
  };

  const getAlertIcon = (alert: AlertMessage) => {
    switch (alert.icon) {
      case 'safe': return <Shield className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'trim': return <Scissors className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'bleed': return <Frame className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'overflow': return <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />;
    }
  };

  const getAlertColors = (severity: AlertMessage['severity']) => {
    switch (severity) {
      case 'danger':
        return 'bg-rose-50 border-rose-200 text-rose-900';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getAlertIconColor = (severity: AlertMessage['severity']) => {
    switch (severity) {
      case 'danger': return 'text-rose-600';
      case 'warning': return 'text-amber-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center mt-2 pb-4">
      <div className="flex items-center justify-center gap-6 py-3 select-none w-full border-t border-gray-200 bg-transparent">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full ${header.bg} flex items-center justify-center shadow-sm`}>
            {report.overallStatus === 'ready' ? (
              <ShieldCheck className="w-3 h-3 text-white" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-white" />
            )}
          </div>
          <span className={`font-extrabold text-[12px] tracking-widest uppercase ${report.overallStatus === 'ready' ? 'text-[#00875a]' : (report.overallStatus === 'warning' ? 'text-amber-600' : 'text-rose-600')}`}>
            {header.title}
          </span>
        </div>

        <div className="h-5 w-px bg-gray-300"></div>

        {/* Checklist Items */}
        <div className="flex items-center gap-6">
          {col1Ids.map((id) => renderCheckRow(getCheckById(id)))}
        </div>
      </div>

      {/* Detailed Alert Messages per Object */}
      {report.alertMessages.length > 0 && (
        <div className="hidden w-full max-w-4xl px-4 flex flex-wrap justify-center gap-2 mt-1">
          {report.alertMessages.map((alert, i) => (
            <div
              key={i}
              onClick={() => handleSelectAlert(alert)}
              className={`p-2 rounded-lg border cursor-pointer transition hover:shadow-md max-w-xs flex items-start gap-2 ${getAlertColors(alert.severity)}`}
            >
              <div className={`mt-0.5 ${getAlertIconColor(alert.severity)}`}>
                {getAlertIcon(alert)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold leading-tight truncate">
                  {alert.title}
                </p>
                <p className="text-[10px] mt-0.5 leading-snug opacity-80 line-clamp-2">
                  {alert.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
