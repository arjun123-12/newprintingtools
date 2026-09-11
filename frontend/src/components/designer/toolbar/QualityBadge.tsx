import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { getQualityBadgeDetails } from '../utils/imageQuality';

export interface QualityBadgeProps {
  effectiveDpi: number;
  qualityLevel: 'excellent' | 'acceptable' | 'low' | 'enhancing' | 'unavailable';
  targetDpi?: number;
  isUpscaling?: boolean;
  onEnhanceClick?: () => void;
  className?: string;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  effectiveDpi,
  qualityLevel,
  targetDpi = 300,
  isUpscaling = false,
  onEnhanceClick,
  className = '',
}) => {
  const currentStatus = isUpscaling ? 'enhancing' : qualityLevel;
  const badge = getQualityBadgeDetails(currentStatus);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-semibold border shadow-2xs transition-all ${badge.badgeBg} ${badge.badgeBorder} ${className}`}
      title={badge.description}
    >
      <span className={`w-2 h-2 rounded-full ${badge.dotColor} ${isUpscaling ? 'animate-ping' : ''}`} />

      <span>{effectiveDpi > 0 ? `${effectiveDpi} DPI` : badge.label}</span>

      {currentStatus === 'excellent' && <CheckCircle className="w-3 h-3 text-emerald-600" />}

      {currentStatus === 'low' && <AlertTriangle className="w-3 h-3 text-rose-600" />}

      {currentStatus === 'acceptable' && <Sparkles className="w-3 h-3 text-amber-600" />}

      {isUpscaling && <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />}

      {(currentStatus === 'low' || currentStatus === 'acceptable') && onEnhanceClick && !isUpscaling && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnhanceClick();
          }}
          className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-bold shadow-xs transition flex items-center gap-1"
          title="Enhance this image locally using Real-ESRGAN"
        >
          <Sparkles className="w-2 h-2" />
          <span>Enhance</span>
        </button>
      )}
    </div>
  );
};
