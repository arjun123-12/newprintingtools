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
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition text-[11px] font-semibold select-none ${!isPass
          ? 'bg-amber-50 text-amber-900 cursor-pointer hover:bg-amber-100 ring-1 ring-amber-200'
          : 'text-gray-800 hover:bg-gray-50'
          }`}
      >
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
        ) : item.status === 'warning' ? (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-amber-600 bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-amber-700">!</span>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-rose-600 bg-rose-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-rose-700">×</span>
          </div>
        )}

        <span className="truncate tracking-tight">{item.label}</span>
        {!isPass && item.offendingObjectIds && (
          <span className="ml-auto text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
            {item.offendingObjectIds.length}
          </span>
        )}
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
    <div className="w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
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

      {/* Expanded Body */}
      {isExpanded && (
        <div className="bg-white max-h-[360px] overflow-y-auto custom-scrollbar">
          {/* Zone Check Summary */}
          <div className="p-3 space-y-1 border-b border-gray-100">
            {col1Ids.map((id) => renderCheckRow(getCheckById(id)))}
          </div>

          {/* Detailed Alert Messages per Object */}
          {report.alertMessages.length > 0 && (
            <div className="p-3 space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Artwork Alerts ({report.alertMessages.length})
              </span>

              {report.alertMessages.map((alert, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectAlert(alert)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition hover:shadow-md ${getAlertColors(alert.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${getAlertIconColor(alert.severity)}`}>
                      {getAlertIcon(alert)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold leading-tight truncate">
                        {alert.title}
                      </p>
                      <p className="text-[10px] mt-0.5 leading-snug opacity-80">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Clear Message */}
          {report.alertMessages.length === 0 && report.isReadyForPrint && (
            <div className="p-4 text-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-gray-800">All artwork is within safe boundaries</p>
              <p className="text-[10px] text-gray-500">Your design is ready for commercial print.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
