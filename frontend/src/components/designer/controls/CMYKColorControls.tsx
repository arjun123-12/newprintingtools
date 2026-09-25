'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';
import { CMYKColor, GamutWarningState, DEFAULT_PURE_BLACK, DEFAULT_RICH_BLACK } from '@/services/colorManagement/types';
import { colorConversionService, hexToRgb, rgbToHex } from '@/services/colorManagement/colorConversionService';
import { gamutService } from '@/services/colorManagement/gamutService';
import { iccProfileService } from '@/services/colorManagement/iccProfileService';

interface CMYKColorControlsProps {
  currentHex: string;
  onColorChange: (hex: string, cmyk?: CMYKColor) => void;
  activeProfileId?: string;
}

export const CMYKColorControls: React.FC<CMYKColorControlsProps> = ({
  currentHex,
  onColorChange,
  activeProfileId,
}) => {
  const profileId = activeProfileId || iccProfileService.getDefaultProfileId();
  const [cmyk, setCmyk] = useState<CMYKColor>({ c: 0, m: 0, y: 0, k: 100 });
  const [gamutState, setGamutState] = useState<GamutWarningState | null>(null);
  const [isUpdatingFromHex, setIsUpdatingFromHex] = useState(false);

  // Sync CMYK and gamut check when input hex changes from parent
  useEffect(() => {
    let isCancelled = false;
    setIsUpdatingFromHex(true);

    const syncColor = async () => {
      try {
        const rgb = hexToRgb(currentHex);
        const resolvedCmyk = await colorConversionService.rgbToCmykWithIcc(rgb, profileId);
        const gamut = await gamutService.checkGamut(rgb, profileId);

        if (!isCancelled) {
          setCmyk(resolvedCmyk);
          setGamutState(gamut);
        }
      } catch (err) {
        console.warn('[CMYKColorControls] Sync error:', err);
      } finally {
        if (!isCancelled) setIsUpdatingFromHex(false);
      }
    };

    syncColor();
    return () => {
      isCancelled = true;
    };
  }, [currentHex, profileId]);

  const handleChannelChange = async (channel: keyof CMYKColor, valueStr: string) => {
    const rawVal = parseInt(valueStr, 10);
    const val = isNaN(rawVal) ? 0 : Math.max(0, Math.min(100, rawVal));

    const nextCmyk: CMYKColor = {
      ...cmyk,
      [channel]: val,
    };
    setCmyk(nextCmyk);

    // Convert CMYK -> display RGB through ICC and emit
    const displayHex = await colorConversionService.cmykToHexPreview(nextCmyk, profileId);
    onColorChange(displayHex, nextCmyk);

    // Update gamut state
    const rgb = hexToRgb(displayHex);
    const gamut = await gamutService.checkGamut(rgb, profileId);
    setGamutState(gamut);
  };

  const applyPreset = async (preset: CMYKColor) => {
    setCmyk(preset);
    const displayHex = await colorConversionService.cmykToHexPreview(preset, profileId);
    onColorChange(displayHex, preset);

    const rgb = hexToRgb(displayHex);
    const gamut = await gamutService.checkGamut(rgb, profileId);
    setGamutState(gamut);
  };

  const applyClosestPrintableColor = () => {
    if (gamutState && gamutState.closestHex) {
      setCmyk(gamutState.closestCmyk);
      onColorChange(gamutState.closestHex, gamutState.closestCmyk);
      setGamutState({
        ...gamutState,
        isOutOfGamut: false,
      });
    }
  };

  return (
    <div className="space-y-3 pt-2">
      {/* 4 Channel Input Fields (C, M, Y, K in 0-100%) */}
      <div className="grid grid-cols-4 gap-1.5">
        {(['c', 'm', 'y', 'k'] as const).map((channel) => {
          const labels: Record<string, { name: string; color: string; border: string }> = {
            c: { name: 'Cyan', color: 'text-cyan-700', border: 'focus:border-cyan-500' },
            m: { name: 'Magenta', color: 'text-pink-700', border: 'focus:border-pink-500' },
            y: { name: 'Yellow', color: 'text-amber-700', border: 'focus:border-amber-500' },
            k: { name: 'Black', color: 'text-gray-900', border: 'focus:border-gray-800' },
          };
          const info = labels[channel];

          return (
            <div key={channel} className="flex flex-col items-center">
              <label className={`text-[10px] font-black uppercase tracking-wider mb-1 ${info.color}`}>
                {channel.toUpperCase()}
              </label>
              <div className="relative w-full">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cmyk[channel]}
                  onChange={(e) => handleChannelChange(channel, e.target.value)}
                  className={`w-full py-1 px-1.5 text-center text-xs font-bold rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-white text-gray-800 focus:outline-none focus:bg-white shadow-2xs transition ${info.border}`}
                />
                <span className="absolute right-1 top-1 text-[9px] text-gray-400 pointer-events-none font-bold">
                  %
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Black Handling Presets (Pure Black vs Rich Black) */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => applyPreset(DEFAULT_PURE_BLACK)}
          title="Pure Black (C 0, M 0, Y 0, K 100) - Recommended for small black body text to avoid registration blur"
          className="flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-300 transition shadow-2xs text-center"
        >
          Pure K Black
        </button>
        <button
          type="button"
          onClick={() => applyPreset(DEFAULT_RICH_BLACK)}
          title="Rich Black (C 60, M 40, Y 40, K 100) - Recommended for large solid dark backgrounds"
          className="flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/60 text-purple-900 transition shadow-2xs text-center"
        >
          Rich Black
        </button>
      </div>

      {/* Out of Gamut Warning Notification */}
      {gamutState?.isOutOfGamut && (
        <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-start gap-1.5 text-xs font-semibold leading-tight">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-950">⚠ This colour may print differently.</div>
              <div className="text-[10px] text-amber-800 mt-0.5">
                This RGB color exceeds the printable gamut of the selected CMYK ICC profile.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-amber-200/80">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-800 font-medium">Closest:</span>
              <div
                className="w-4 h-4 rounded border border-amber-400 shadow-2xs"
                style={{ backgroundColor: gamutState.closestHex }}
                title={`Closest printable color: ${gamutState.closestHex}`}
              />
              <span className="text-[10px] font-mono font-bold text-amber-900">{gamutState.closestHex}</span>
            </div>

            <button
              type="button"
              onClick={applyClosestPrintableColor}
              className="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-2xs transition"
            >
              Use closest colour
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
