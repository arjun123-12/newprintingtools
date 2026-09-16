'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Scissors,
  Shield,
  Frame,
  ExternalLink,
  X,
} from 'lucide-react';
import { PreflightReport, PreflightCheckItem, AlertMessage } from '../utils/preflightCheck';
import { CanvasManager } from '../canvas/CanvasManager';

interface PreflightBadgeProps {
  report: PreflightReport;
  canvasManager: CanvasManager | null;
  className?: string;
}

export const PreflightBadge: React.FC<PreflightBadgeProps> = ({
  report,
  canvasManager,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectOffending = (check: PreflightCheckItem) => {
    if (!canvasManager || !check.offendingObjectIds || check.offendingObjectIds.length === 0) return;
    const firstId = check.offendingObjectIds[0];
    canvasManager.selectObjectById(firstId);
  };

  const handleSelectAlert = (alert: AlertMessage) => {
    if (!canvasManager || !alert.objectIds || alert.objectIds.length === 0) return;
    canvasManager.selectObjectById(alert.objectIds[0]);
  };

  const isError = report.overallStatus === 'error';
  const isWarning = report.overallStatus === 'warning';
  const isReady = report.overallStatus === 'ready';

  const getHeaderStyle = () => {
    if (isError) {
      return {
        bg: 'bg-rose-600',
        title: 'PRINT ERRORS',
        badge: `${report.issuesCount} Alert${report.issuesCount > 1 ? 's' : ''}`,
        badgeBg: 'bg-rose-700/90 text-white',
        border: 'border-rose-300',
        btnBg: 'bg-rose-50 hover:bg-rose-100 text-rose-800',
        dotBg: 'bg-rose-600 text-white',
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-600',
        title: 'PRINT WARNINGS',
        badge: `${report.issuesCount} Alert${report.issuesCount > 1 ? 's' : ''}`,
        badgeBg: 'bg-amber-700/90 text-white',
        border: 'border-amber-300',
        btnBg: 'bg-amber-50 hover:bg-amber-100 text-amber-800',
        dotBg: 'bg-amber-500 text-white',
      };
    }
    return {
      bg: 'bg-[#00875a]',
      title: 'READY FOR PRINT',
      badge: 'All Clear',
      badgeBg: 'bg-[#006644] text-white',
      border: 'border-emerald-200',
      btnBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800',
      dotBg: 'bg-emerald-600 text-white',
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
      <button
        key={item.id}
        type="button"
        disabled={isPass}
        onClick={() => !isPass && handleSelectOffending(item)}
        title={item.message || item.label}
        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
          isPass
            ? 'bg-gray-50/70 border-gray-100 text-gray-700'
            : item.status === 'warning'
              ? 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/70 cursor-pointer'
              : 'bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-100/70 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center ${
              isPass
                ? 'bg-[#00875a]/10'
                : item.status === 'warning'
                  ? 'bg-amber-100'
                  : 'bg-rose-100'
            }`}
          >
            {isPass ? (
              <svg
                className="w-2.5 h-2.5 text-[#00875a]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : item.status === 'warning' ? (
              <span className="text-[9px] font-bold text-amber-700">!</span>
            ) : (
              <span className="text-[9px] font-bold text-rose-700">×</span>
            )}
          </div>
          <span className="font-semibold">{item.label}</span>
        </div>

        <span className="text-[11px] font-medium opacity-75">
          {isPass ? 'OK' : item.status === 'warning' ? 'Warning' : 'Error'}
        </span>
      </button>
    );
  };

  const getAlertIcon = (alert: AlertMessage) => {
    switch (alert.icon) {
      case 'safe':
        return <Shield className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'trim':
        return <Scissors className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'bleed':
        return <Frame className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'overflow':
        return <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />;
    }
  };

  const getAlertColors = (severity: AlertMessage['severity']) => {
    switch (severity) {
      case 'danger':
        return 'bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-900';
      case 'warning':
        return 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-900';
      case 'info':
        return 'bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 hover:bg-gray-100/80 border-gray-200 text-gray-900';
    }
  };

  const getAlertIconColor = (severity: AlertMessage['severity']) => {
    switch (severity) {
      case 'danger':
        return 'text-rose-600';
      case 'warning':
        return 'text-amber-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      {/* Small Trigger Pill Button on the Right Side */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={header.title}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-2xs transition cursor-pointer ${header.border} ${header.btnBg}`}
      >
        <div className={`w-4 h-4 rounded-full ${header.dotBg} flex items-center justify-center text-[10px] font-bold shadow-2xs`}>
          {isReady ? (
            <ShieldCheck className="w-2.5 h-2.5 text-white" />
          ) : isWarning ? (
            '!'
          ) : (
            '×'
          )}
        </div>

        <span className="tracking-tight text-[11px] font-bold">
          {isReady ? 'Print Ready' : isWarning ? 'Print Warnings' : 'Print Errors'}
        </span>

        {report.issuesCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/80 shadow-2xs">
            {report.issuesCount}
          </span>
        )}

        {isOpen ? (
          <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
        ) : (
          <ChevronUp className="w-3 h-3 opacity-60 ml-0.5" />
        )}
      </button>

      {/* Side Pop-Up Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={header.title}
          className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none text-left"
        >
          {/* Header */}
          <div className={`px-4 py-3 ${header.bg} text-white flex items-center justify-between shadow-sm`}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                {isReady ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                )}
              </div>
              <div>
                <h4 className="font-extrabold text-[12px] tracking-wider uppercase leading-none">
                  {header.title}
                </h4>
                <p className="text-[10px] text-white/80 mt-0.5 font-medium">
                  {isReady
                    ? 'All preflight checks pass standard print guidelines'
                    : `${report.issuesCount} item${report.issuesCount > 1 ? 's' : ''} require attention before commercial printing`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-3 bg-white max-h-[70vh] overflow-y-auto">
            {/* Checklist items */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Print Boundary Checklist
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {col1Ids.map((id) => renderCheckRow(getCheckById(id)))}
              </div>
            </div>

            {/* Detailed Alert Cards */}
            {report.alertMessages.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                  <span>Detected Issues</span>
                  <span className="text-[9px] lowercase font-normal text-gray-400">click card to locate element</span>
                </div>
                <div className="space-y-1.5">
                  {report.alertMessages.map((alert, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectAlert(alert)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition shadow-2xs flex items-start gap-2.5 ${getAlertColors(
                        alert.severity
                      )}`}
                    >
                      <div className={`mt-0.5 ${getAlertIconColor(alert.severity)}`}>
                        {getAlertIcon(alert)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold leading-tight">
                          {alert.title}
                        </p>
                        <p className="text-[10px] mt-0.5 leading-relaxed opacity-85">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isReady && (
              <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-emerald-900 text-xs flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  Artwork passes bleed, safe zone, and trim checks. Ready for professional PDF/PSD export.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
