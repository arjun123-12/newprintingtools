'use client';

import React, { useState } from 'react';
import { Eye, Monitor, Printer, ChevronDown, Info } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { softProofService } from '@/services/colorManagement/softProofService';
import { iccProfileService } from '@/services/colorManagement/iccProfileService';
import { PrintColorProfile } from '@/services/colorManagement/types';

interface PrintPreviewToggleProps {
  canvasManager?: CanvasManager | null;
  className?: string;
}

export const PrintPreviewToggle: React.FC<PrintPreviewToggleProps> = ({
  canvasManager,
  className = '',
}) => {
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(() =>
    softProofService.isPrintPreviewActive()
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() =>
    softProofService.getActiveProfileId()
  );
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDisclaimerVisible, setIsDisclaimerVisible] = useState(false);

  const profiles = iccProfileService.getAllProfiles();
  const currentProfile = iccProfileService.getProfile(selectedProfileId);

  const handleToggle = async (mode: 'screen' | 'print') => {
    const shouldEnable = mode === 'print';
    if (shouldEnable === isPreviewActive) return;

    const canvas = canvasManager?.getCanvas();
    if (!canvas) return;

    const success = await softProofService.setPrintPreview(canvas, shouldEnable, selectedProfileId);
    setIsPreviewActive(shouldEnable && success);
  };

  const handleSelectProfile = async (profile: PrintColorProfile) => {
    setSelectedProfileId(profile.id);
    softProofService.setActiveProfileId(profile.id);
    setIsProfileMenuOpen(false);

    if (isPreviewActive) {
      const canvas = canvasManager?.getCanvas();
      if (canvas) {
        // Refresh proofing with newly selected profile
        await softProofService.setPrintPreview(canvas, false);
        await softProofService.setPrintPreview(canvas, true, profile.id);
      }
    }
  };

  return (
    <div className={`flex items-center gap-1 bg-gray-100/90 p-0.5 rounded-lg text-xs select-none relative ${className}`}>
      {/* Screen View (RGB) Button */}
      <button
        type="button"
        onClick={() => handleToggle('screen')}
        title="Screen View: Original digital RGB artwork"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
          !isPreviewActive
            ? 'bg-white text-gray-900 shadow-2xs'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <Monitor className="w-3.5 h-3.5 text-blue-600" />
        <span className="hidden sm:inline">Screen View</span>
      </button>

      {/* Print Preview (CMYK Soft Proof) Button */}
      <button
        type="button"
        onClick={() => handleToggle('print')}
        title="Print Preview: Non-destructive CMYK soft-proof simulation based on ICC profile"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
          isPreviewActive
            ? 'bg-purple-600 text-white shadow-2xs'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <Printer className={`w-3.5 h-3.5 ${isPreviewActive ? 'text-white' : 'text-purple-600'}`} />
        <span>Print Preview</span>
      </button>

      {/* Profile Selector Badge / Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          title={`Active Print Profile: ${currentProfile.name}. Click to change profile.`}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium border transition ${
            isPreviewActive
              ? 'border-purple-300 bg-purple-50 text-purple-900'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="max-w-[100px] truncate hidden md:inline">{currentProfile.name}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {isProfileMenuOpen && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
              Select Print ICC Profile
            </div>
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProfile(p)}
                  className={`w-full text-left p-2 rounded-lg text-xs transition flex flex-col ${
                    selectedProfileId === p.id
                      ? 'bg-purple-50 text-purple-950 font-bold border border-purple-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{p.name}</span>
                    {p.totalAreaCoverage && (
                      <span className="text-[10px] text-gray-400 font-mono">TAC {p.totalAreaCoverage}%</span>
                    )}
                  </div>
                  {p.description && (
                    <span className="text-[10px] text-gray-400 font-normal mt-0.5 leading-snug">
                      {p.description}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Disclaimer notice */}
            <div className="mt-2 pt-2 border-t border-gray-100 px-2 text-[10px] text-gray-500 leading-relaxed flex items-start gap-1">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span>
                Print Preview approximates the selected print profile. Actual output can vary with printer, ink, paper and display calibration.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
