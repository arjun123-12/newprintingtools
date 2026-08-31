'use client';

import React, { useState } from 'react';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminCheckbox,
  AdminSwitch,
  AdminNumberInput,
} from '@/components/admin/shared';
import { AttributeItem, AttributeValueItem } from './types';
import { PrintingFieldsToolbar, PrintingFieldPreset } from './PrintingFieldsToolbar';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Sliders,
  Sparkles,
  Layers,
  Copy,
  Info,
} from 'lucide-react';

interface AdvancedAttributesBuilderProps {
  attributes: AttributeItem[];
  onChange: (attributes: AttributeItem[]) => void;
  quantityBreaks?: number[];
  onQuantityBreaksChange?: (breaks: number[]) => void;
}

const SWITCH_TYPES = [
  { value: 'select', label: 'Dropdown Select Box' },
  { value: 'radio', label: 'Radio Button Cards' },
  { value: 'image_swatch', label: 'Image Swatch' },
  { value: 'color', label: 'Color Swatch' },
  { value: 'custom_dimensions', label: 'Custom Dimensions' },
];

export const AdvancedAttributesBuilder: React.FC<AdvancedAttributesBuilderProps> = ({
  attributes = [],
  onChange,
  quantityBreaks = [100, 250, 500, 1000, 2000],
  onQuantityBreaksChange,
}) => {
  const [dependQuantity, setDependQuantity] = useState<boolean>(true);
  const [dependQuantityBreaks, setDependQuantityBreaks] = useState<boolean>(true);
  const [expandedAttrs, setExpandedAttrs] = useState<Record<string, boolean>>({});
  const [activeTabs, setActiveTabs] = useState<Record<string, 'general' | 'pricing' | 'conditional' | 'appearance'>>({});

  const toggleExpand = (attrId: string) => {
    setExpandedAttrs((prev) => ({ ...prev, [attrId]: !prev[attrId] }));
  };

  const handleAddPreset = (preset: PrintingFieldPreset) => {
    // Convert preset values into AttributeValueItem with quantity break price matrices
    const newValues: AttributeValueItem[] = preset.values.map((val, idx) => ({
      id: `val_${Date.now()}_${idx}`,
      label: val.label,
      value: val.value,
      description: val.description || '',
      price_modifier_amount: 0,
      price_modifier_type: 'fixed',
      is_default: idx === 0,
      implicit_value: '',
      enable_conditional_logic: false,
      priceModifiers: val.priceModifiers || {},
    } as any));

    const newAttr: AttributeItem = {
      id: `attr_${Date.now()}`,
      name: preset.name,
      code: preset.code,
      type: preset.type,
      is_required: true,
      values: newValues,
    } as any;

    onChange([...attributes, newAttr]);
    setExpandedAttrs((prev) => ({ ...prev, [newAttr.id]: true }));
  };

  const handleAddCustomAttribute = () => {
    const newAttr: AttributeItem = {
      id: `attr_${Date.now()}`,
      name: 'New Custom Option',
      code: `option_${Date.now()}`,
      type: 'select',
      is_required: false,
      values: [
        {
          id: `val_${Date.now()}_1`,
          label: 'Option Value 1',
          value: 'value_1',
          description: '',
          price_modifier_amount: 0,
          price_modifier_type: 'fixed',
          is_default: true,
          implicit_value: '',
          enable_conditional_logic: false,
          priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 },
        } as any,
      ],
    };

    onChange([...attributes, newAttr]);
    setExpandedAttrs((prev) => ({ ...prev, [newAttr.id]: true }));
  };

  const handleRemoveAttribute = (index: number) => {
    const updated = attributes.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMoveAttribute = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= attributes.length) return;

    const updated = [...attributes];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onChange(updated);
  };

  const updateAttributeField = (attrIndex: number, field: keyof AttributeItem, val: any) => {
    const updated = [...attributes];
    updated[attrIndex] = { ...updated[attrIndex], [field]: val };
    if (field === 'name' && !updated[attrIndex].code) {
      updated[attrIndex].code = String(val).toLowerCase().replace(/[^\w]/g, '_');
    }
    onChange(updated);
  };

  const handleAddValue = (attrIndex: number) => {
    const updated = [...attributes];
    const newValues: any[] = [
      ...updated[attrIndex].values,
      {
        id: `val_${Date.now()}`,
        label: '',
        value: '',
        description: '',
        price_modifier_amount: 0,
        price_modifier_type: 'fixed',
        is_default: false,
        implicit_value: '',
        enable_conditional_logic: false,
        priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 },
      },
    ];
    updated[attrIndex] = { ...updated[attrIndex], values: newValues };
    onChange(updated);
  };

  const handleRemoveValue = (attrIndex: number, valIndex: number) => {
    const updated = [...attributes];
    updated[attrIndex] = {
      ...updated[attrIndex],
      values: updated[attrIndex].values.filter((_, i) => i !== valIndex),
    };
    onChange(updated);
  };

  const updateValueField = (
    attrIndex: number,
    valIndex: number,
    field: string,
    val: any
  ) => {
    const updated = [...attributes];
    const values = [...updated[attrIndex].values] as any[];
    values[valIndex] = { ...values[valIndex], [field]: val };
    if (field === 'label' && !values[valIndex].value) {
      values[valIndex].value = String(val).toLowerCase().replace(/[^\w]/g, '_');
    }
    updated[attrIndex] = { ...updated[attrIndex], values };
    onChange(updated);
  };

  const updateQuantityBreakPrice = (
    attrIndex: number,
    valIndex: number,
    breakQty: number,
    price: number
  ) => {
    const updated = [...attributes];
    const values = [...updated[attrIndex].values] as any[];
    const currentMods = { ...(values[valIndex].priceModifiers || {}) };
    currentMods[breakQty] = price;
    values[valIndex].priceModifiers = currentMods;
    updated[attrIndex] = { ...updated[attrIndex], values };
    onChange(updated);
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* 1. Quick Presets Toolbar (Matching Screenshot 3) */}
      <PrintingFieldsToolbar
        onAddField={handleAddPreset}
        existingCodes={attributes.map((a) => a.code)}
      />

      {/* 2. Global Attributes Settings Bar (Matching Screenshot 1 top) */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Depend quantity:</span>
            <select
              value={dependQuantity ? 'yes' : 'no'}
              onChange={(e) => setDependQuantity(e.target.value === 'yes')}
              className="h-8 px-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:border-blue-600 focus:outline-none"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Depend quantity breaks:</span>
            <select
              value={dependQuantityBreaks ? 'yes' : 'no'}
              onChange={(e) => setDependQuantityBreaks(e.target.value === 'yes')}
              className="h-8 px-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:border-blue-600 focus:outline-none"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddCustomAttribute}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Option</span>
        </button>
      </div>

      {/* 3. Attributes List (Matching Screenshot 1 & 2 Cards) */}
      {attributes.length > 0 ? (
        <div className="space-y-5">
          {attributes.map((attr, attrIdx) => {
            const isExpanded = expandedAttrs[attr.id] !== false;
            const currentTab = activeTabs[attr.id] || 'general';

            return (
              <div
                key={attr.id || attrIdx}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Header with Title & Action Controls */}
                <div className="px-5 py-3.5 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleExpand(attr.id)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                        <span>{attr.name || 'Unnamed Option'}</span>
                        <span className="text-[10px] font-mono font-medium text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {attr.code}
                        </span>
                      </h4>
                    </div>
                  </div>

                  {/* Reorder and Delete Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={attrIdx === 0}
                      onClick={() => handleMoveAttribute(attrIdx, 'up')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={attrIdx === attributes.length - 1}
                      onClick={() => handleMoveAttribute(attrIdx, 'down')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(attrIdx)}
                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-2"
                      title="Delete Option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                {isExpanded && (
                  <div className="p-5 space-y-5">
                    {/* Option General Configuration Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-gray-100">
                      <AdminInput
                        label="Option Name"
                        placeholder="e.g. Paper Stock"
                        value={attr.name}
                        required
                        onChange={(e) => updateAttributeField(attrIdx, 'name', e.target.value)}
                      />

                      <AdminInput
                        label="Option Code"
                        placeholder="e.g. paper_stock"
                        value={attr.code}
                        required
                        onChange={(e) => updateAttributeField(attrIdx, 'code', e.target.value)}
                      />

                      <AdminSelect
                        label="Switch / Display Type"
                        value={attr.type}
                        options={SWITCH_TYPES}
                        onChange={(e) => updateAttributeField(attrIdx, 'type', e.target.value)}
                      />
                    </div>

                    {/* Option Values List with Quantity Breaks Matrix (Matching Screenshot 1) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                          <span>Values & Quantity Price Matrices</span>
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.2 rounded">
                            {attr.values.length} Items
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAddValue(attrIdx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Value</span>
                        </button>
                      </div>

                      {attr.values.map((val: any, valIdx: number) => {
                        return (
                          <div
                            key={val.id || valIdx}
                            className="p-4 bg-gray-50/60 rounded-xl border border-gray-200 space-y-3 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Left Columns: Title, Description, Default */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-700">
                                      Title / Swatch Label
                                    </label>
                                    <label className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(val.is_default)}
                                        onChange={(e) => updateValueField(attrIdx, valIdx, 'is_default', e.target.checked)}
                                        className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500/20"
                                      />
                                      <span>Default</span>
                                    </label>
                                  </div>
                                  <AdminInput
                                    placeholder="e.g. Front side"
                                    value={val.label}
                                    onChange={(e) => updateValueField(attrIdx, valIdx, 'label', e.target.value)}
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-gray-700">
                                    Description / Tooltip
                                  </label>
                                  <AdminInput
                                    placeholder="Option description shown on hover…"
                                    value={val.description || ''}
                                    onChange={(e) => updateValueField(attrIdx, valIdx, 'description', e.target.value)}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveValue(attrIdx, valIdx)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors"
                                title="Remove value"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Quantity Break Price Matrix Table (Matching Screenshot 1) */}
                            {dependQuantityBreaks && (
                              <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                                  Additional Price per Quantity Break
                                </span>

                                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                  <table className="w-full text-center text-xs">
                                    <thead className="bg-gray-50 text-gray-600 font-bold text-[10px] uppercase border-b border-gray-200">
                                      <tr>
                                        <th className="py-2 px-3 text-left w-32 font-semibold">Quantity break</th>
                                        {quantityBreaks.map((breakQty) => (
                                          <th key={breakQty} className="py-2 px-3">
                                            {breakQty}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="py-2 px-3 text-left font-semibold text-gray-700 text-xs bg-gray-50/50 border-r border-gray-200">
                                          Additional Price
                                        </td>
                                        {quantityBreaks.map((breakQty) => {
                                          const currentVal = val.priceModifiers?.[breakQty] ?? 0;
                                          return (
                                            <td key={breakQty} className="p-1 border-r border-gray-100 last:border-r-0">
                                              <input
                                                type="number"
                                                step={0.0001}
                                                placeholder="0.0000"
                                                value={currentVal}
                                                onChange={(e) =>
                                                  updateQuantityBreakPrice(
                                                    attrIdx,
                                                    valIdx,
                                                    breakQty,
                                                    parseFloat(e.target.value) || 0
                                                  )
                                                }
                                                className="w-full h-7 px-1.5 text-center text-xs font-mono text-gray-900 bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded"
                                              />
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Implicit Value & Conditional Logic */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-gray-500">Implicit Value:</span>
                                <input
                                  type="text"
                                  placeholder="e.g. 1"
                                  value={val.implicit_value || ''}
                                  onChange={(e) => updateValueField(attrIdx, valIdx, 'implicit_value', e.target.value)}
                                  className="w-28 h-7 px-2 text-xs bg-white border border-gray-300 rounded focus:border-blue-600 focus:outline-none"
                                />
                              </div>

                              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val.enable_conditional_logic)}
                                  onChange={(e) =>
                                    updateValueField(attrIdx, valIdx, 'enable_conditional_logic', e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500/20"
                                />
                                <span>Enable Attribute Conditional Logic</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white flex flex-col items-center justify-center text-center">
          <Sliders className="w-8 h-8 text-gray-400 mb-2" />
          <h4 className="text-sm font-bold text-gray-800">No print attributes configured yet</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Use the <strong>Printing Fields</strong> toolbar above or click &quot;Add Custom Option&quot; to configure Sides, Paper Stock, Sizes, and Quantity Price matrices.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedAttributesBuilder;
