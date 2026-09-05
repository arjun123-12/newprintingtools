'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { DocumentSettings } from '@/types/designer';

// "cm" is supported by this form for display only. DocumentSettings uses
// the application's canonical UnitType, so values are saved as millimetres.
type DisplayUnit = 'mm' | 'cm' | 'in';

interface CustomBannerSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: DocumentSettings;
  onApply: (settings: Partial<DocumentSettings>) => void;
}

interface BannerPreset {
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

const PRESETS: BannerPreset[] = [
  { name: 'Standard Pull-Up Banner', widthMm: 850, heightMm: 2000, description: 'Standard trade show roll-up banner' },
  { name: 'Wide Pull-Up Banner', widthMm: 1200, heightMm: 2000, description: 'Wide format exhibition roll-up' },
  { name: 'Vinyl Banner 2m × 1m', widthMm: 2000, heightMm: 1000, description: 'Standard outdoor event vinyl banner' },
  { name: 'Vinyl Banner 3m × 1m', widthMm: 3000, heightMm: 1000, description: 'Wide road/fence banner' },
  { name: 'Large Street Banner 4m × 1.2m', widthMm: 4000, heightMm: 1200, description: 'Building facade or fence banner' },
  { name: 'Mesh Fence Banner 3m × 1.5m', widthMm: 3000, heightMm: 1500, description: 'Wind-resistant construction/event mesh' },
  { name: 'Table Cloth Banner', widthMm: 1800, heightMm: 750, description: 'Fitted display table runner/cover' },
  { name: 'Teardrop Flying Flag', widthMm: 750, heightMm: 2200, description: 'Medium outdoor wind feather flag' },
];

const UNIT_LABELS: Record<DisplayUnit, string> = {
  mm: 'Millimeters (mm)',
  cm: 'Centimeters (cm)',
  in: 'Inches (in)',
};

function convertUnit(value: number, from: DisplayUnit, to: DisplayUnit): number {
  if (from === to) return value;

  const millimeters = from === 'mm' ? value : from === 'cm' ? value * 10 : value * 25.4;
  const converted = to === 'mm' ? millimeters : to === 'cm' ? millimeters / 10 : millimeters / 25.4;

  return Number(converted.toFixed(to === 'in' ? 3 : 2));
}

function validNumber(value: unknown, fallback: number, allowZero = false): number {
  const number = Number(value);
  const valid = Number.isFinite(number) && (allowZero ? number >= 0 : number > 0);
  return valid ? number : fallback;
}

export const CustomBannerSizeModal: React.FC<CustomBannerSizeModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onApply,
}) => {
  const [unit, setUnit] = useState<DisplayUnit>('mm');
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(65);
  const [bleed, setBleed] = useState(3);
  const [safeArea, setSafeArea] = useState(3);
  const [dpi, setDpi] = useState(300);
  const [error, setError] = useState('');

  // Refresh the form every time a different backend template is selected,
  // including while this modal is already open.
  useEffect(() => {
    if (!isOpen) return;

    const safeUnit: DisplayUnit = currentSettings.unit === 'in' ? 'in' : 'mm';

    setUnit(safeUnit);
    setWidth(validNumber(currentSettings.width, 100));
    setHeight(validNumber(currentSettings.height, 65));
    setBleed(validNumber(currentSettings.bleed, 3, true));
    setSafeArea(validNumber(currentSettings.safeArea, 3, true));
    setDpi(validNumber(currentSettings.dpi, 300));
    setError('');
  }, [
    isOpen,
    currentSettings.width,
    currentSettings.height,
    currentSettings.unit,
    currentSettings.bleed,
    currentSettings.safeArea,
    currentSettings.dpi,
  ]);

  const selectedPreset = useMemo(
    () =>
      PRESETS.find(
        (preset) =>
          Math.abs(convertUnit(width, unit, 'mm') - preset.widthMm) < 0.01 &&
          Math.abs(convertUnit(height, unit, 'mm') - preset.heightMm) < 0.01
      ),
    [height, unit, width]
  );

  if (!isOpen) return null;

  const handleUnitChange = (nextUnit: DisplayUnit) => {
    setWidth((value) => convertUnit(value, unit, nextUnit));
    setHeight((value) => convertUnit(value, unit, nextUnit));
    setBleed((value) => convertUnit(value, unit, nextUnit));
    setSafeArea((value) => convertUnit(value, unit, nextUnit));
    setUnit(nextUnit);
  };

  const handlePreset = (preset: BannerPreset) => {
    setWidth(convertUnit(preset.widthMm, 'mm', unit));
    setHeight(convertUnit(preset.heightMm, 'mm', unit));
    setError('');
  };

  const handleApply = () => {
    if (width <= 0 || height <= 0) {
      setError('Width and height must be greater than zero.');
      return;
    }

    if (bleed < 0 || safeArea < 0) {
      setError('Bleed and inside trim cannot be negative.');
      return;
    }

    // Keep one canonical storage unit. "cm" remains available in the UI,
    // but it is never assigned to DocumentSettings.unit.
    onApply({
      width: convertUnit(width, unit, 'mm'),
      height: convertUnit(height, unit, 'mm'),
      unit: 'mm',
      dpi,
      bleed: convertUnit(bleed, unit, 'mm'),
      safeArea: convertUnit(safeArea, unit, 'mm'),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-600/20 bg-blue-600/10 text-blue-600">
              <Maximize2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Custom Banner &amp; Artwork Size</h2>
              <p className="text-xs text-gray-500">Values loaded from the selected template</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Measurement Unit</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(UNIT_LABELS) as DisplayUnit[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleUnitChange(item)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${unit === item ? 'border-blue-600 bg-blue-600 text-white shadow-xs' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                >
                  {UNIT_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberField label={`Width (${unit})`} hint="Horizontal" min={0.01} value={width} onChange={setWidth} />
            <NumberField label={`Height (${unit})`} hint="Vertical" min={0.01} value={height} onChange={setHeight} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberField label={`Bleed (${unit})`} min={0} max={50} value={bleed} onChange={setBleed} accent="text-red-500" />
            <NumberField label={`Inside Trim (${unit})`} min={0} max={100} value={safeArea} onChange={setSafeArea} accent="text-emerald-600" />
          </div>

          <NumberField label="Resolution (DPI)" min={72} max={1200} step={1} value={dpi} onChange={setDpi} />

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>}

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Standard Commercial Banner Presets</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`rounded-xl border p-3 text-left transition ${selectedPreset?.name === preset.name ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50/60'}`}
                >
                  <p className="text-xs font-bold text-gray-900">{preset.name}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{preset.widthMm} × {preset.heightMm} mm ({preset.description})</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100">Cancel</button>
          <button type="button" onClick={handleApply} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Apply Artwork Dimensions</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface NumberFieldProps {
  label: string;
  hint?: string;
  min: number;
  max?: number;
  step?: number | 'any';
  value: number;
  accent?: string;
  onChange: (value: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  hint,
  min,
  max,
  step = 'any',
  value,
  accent = 'text-gray-700',
  onChange,
}) => (
  <div className="space-y-1.5">
    <label className={`flex justify-between text-xs font-semibold ${accent}`}>
      <span>{label}</span>
      {hint && <span className="text-[11px] font-normal text-gray-400">{hint}</span>}
    </label>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-sm font-semibold text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
    />
  </div>
);

export default CustomBannerSizeModal;
