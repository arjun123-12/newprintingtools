'use client';

import React from 'react';

interface BrushCapsPopoverProps {
  strokeLineCap?: 'round' | 'square' | 'butt';
  strokeLineJoin?: 'round' | 'bevel' | 'miter';
  onChangeCap: (cap: 'round' | 'square' | 'butt') => void;
  onChangeJoin?: (join: 'round' | 'bevel' | 'miter') => void;
  onClose: () => void;
}

export const BrushCapsPopover: React.FC<BrushCapsPopoverProps> = ({
  strokeLineCap = 'round',
  strokeLineJoin = 'round',
  onChangeCap,
  onChangeJoin,
  onClose,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5"
    >
      {/* End Caps */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
          Stroke End Caps
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(['round', 'square', 'butt'] as const).map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => {
                onChangeCap(cap);
              }}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold capitalize border transition ${
                strokeLineCap === cap
                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cap}
            </button>
          ))}
        </div>
      </div>

      {/* Joins */}
      {onChangeJoin && (
        <div className="space-y-1.5 border-t border-gray-100 pt-2.5">
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
            Corner Joins
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['round', 'bevel', 'miter'] as const).map((join) => (
              <button
                key={join}
                type="button"
                onClick={() => {
                  onChangeJoin(join);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold capitalize border transition ${
                  strokeLineJoin === join
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {join}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
