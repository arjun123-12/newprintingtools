import React, { useState, useRef, useEffect } from 'react';
import { Folder, Check, X, ChevronDown, Plus, Star, Loader2, Sparkles } from 'lucide-react';

export interface CategoryItemOption {
  id: string;
  name: string;
  slug?: string;
}

export interface MultiCategorySelectProps {
  label?: string;
  categories: CategoryItemOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  primaryId?: string;
  onSetPrimary?: (id: string) => void;
  onCreateCategory?: (name: string) => Promise<CategoryItemOption | null>;
  required?: boolean;
  error?: string;
  helperText?: string;
  loading?: boolean;
  placeholder?: string;
}

export const MultiCategorySelect: React.FC<MultiCategorySelectProps> = ({
  label = 'Assigned Categories',
  categories,
  selectedIds = [],
  onChange,
  primaryId,
  onSetPrimary,
  onCreateCategory,
  required = false,
  error,
  helperText,
  loading = false,
  placeholder = 'Select categories to assign…',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategoryObjects = selectedIds
    .map((id) => categories.find((c) => String(c.id) === String(id)))
    .filter((c): c is CategoryItemOption => Boolean(c));

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  const handleToggleCategory = (id: string) => {
    const isSelected = selectedIds.some((selectedId) => String(selectedId) === String(id));
    let nextIds: string[];

    if (isSelected) {
      nextIds = selectedIds.filter((selectedId) => String(selectedId) !== String(id));
      if (primaryId && String(primaryId) === String(id) && onSetPrimary) {
        onSetPrimary(nextIds.length > 0 ? nextIds[0] : '');
      }
    } else {
      nextIds = [...selectedIds, id];
      if ((!primaryId || selectedIds.length === 0) && onSetPrimary) {
        onSetPrimary(id);
      }
    }

    onChange(nextIds);
  };

  const handleRemoveCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIds = selectedIds.filter((selectedId) => String(selectedId) !== String(id));
    if (primaryId && String(primaryId) === String(id) && onSetPrimary) {
      onSetPrimary(nextIds.length > 0 ? nextIds[0] : '');
    }
    onChange(nextIds);
  };

  const handleCreateNewCategory = async (nameToCreate: string) => {
    const trimmed = nameToCreate.trim();
    if (!trimmed || !onCreateCategory || isCreating) return;

    try {
      setIsCreating(true);
      setCreateError(null);
      const created = await onCreateCategory(trimmed);
      if (created) {
        setSearchFilter('');
        setShowInlineInput(false);
        setInlineCategoryName('');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create category');
    } finally {
      setIsCreating(false);
    }
  };

  const canShowSearchCreate =
    onCreateCategory &&
    searchFilter.trim().length > 0 &&
    !categories.some((c) => c.name.toLowerCase() === searchFilter.trim().toLowerCase());

  return (
    <div className="w-full space-y-1.5" ref={dropdownRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="flex items-center text-xs font-semibold text-gray-700 select-none">
            <span>{label}</span>
            {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
            {selectedCategoryObjects.length > 0 && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                {selectedCategoryObjects.length} selected
              </span>
            )}
          </label>
          {onCreateCategory && !showInlineInput && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setShowInlineInput(true);
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" />
              <span>New Category</span>
            </button>
          )}
        </div>
      )}

      {/* Selected category badges */}
      {selectedCategoryObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50/80 border border-gray-200 rounded-xl mb-1.5">
          {selectedCategoryObjects.map((cat) => {
            const isPrimary = primaryId && String(primaryId) === String(cat.id);
            return (
              <span
                key={cat.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                  isPrimary
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <Folder className={`w-3.5 h-3.5 shrink-0 ${isPrimary ? 'text-blue-200' : 'text-blue-500'}`} />
                <span>{cat.name}</span>

                {isPrimary ? (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-extrabold px-1 py-0.2 bg-blue-700/80 text-blue-100 rounded"
                    title="Primary Category"
                  >
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    Primary
                  </span>
                ) : onSetPrimary ? (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(cat.id)}
                    className="text-[10px] text-gray-400 hover:text-blue-600 font-normal hover:underline ml-0.5"
                    title="Set as primary category"
                  >
                    Set Primary
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => handleRemoveCategory(cat.id, e)}
                  className={`p-0.5 rounded-md hover:bg-black/10 transition-colors ${
                    isPrimary ? 'text-blue-100 hover:text-white' : 'text-gray-400 hover:text-rose-600'
                  }`}
                  title={`Remove ${cat.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown toggle trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={loading}
          className={`w-full flex items-center justify-between px-3 py-2 text-left bg-white border rounded-xl text-xs transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
            error ? 'border-rose-500 bg-rose-50/20' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate text-gray-700">
            <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className={selectedIds.length === 0 ? 'text-gray-400 font-normal' : 'font-medium text-gray-800'}>
              {loading ? 'Loading categories…' : selectedIds.length === 0 ? placeholder : 'Add / remove categories…'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-80 flex flex-col">
            <div className="p-2 border-b border-gray-100 bg-gray-50/60">
              <input
                type="text"
                placeholder="Filter or type new category name…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {canShowSearchCreate && (
              <div className="p-2 border-b border-gray-100 bg-blue-50/50">
                <button
                  type="button"
                  onClick={() => handleCreateNewCategory(searchFilter)}
                  disabled={isCreating}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Add &ldquo;{searchFilter.trim()}&rdquo; as new category</span>
                  </div>
                  {isCreating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                  ) : (
                    <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      Create
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="overflow-y-auto divide-y divide-gray-50 p-1 custom-scrollbar max-h-48">
              {filteredCategories.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  {searchFilter ? 'No matching category found.' : 'No categories available.'}
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const isChecked = selectedIds.some((id) => String(id) === String(category.id));
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleToggleCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition-colors ${
                        isChecked
                          ? 'bg-blue-50/70 text-blue-900 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="truncate">{category.name}</span>
                        {category.slug && (
                          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                            /{category.slug}
                          </span>
                        )}
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with "+ Add New Category" action */}
            {onCreateCategory && (
              <div className="p-2 border-t border-gray-100 bg-gray-50/80">
                {showInlineInput ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Enter new category name…"
                        value={inlineCategoryName}
                        onChange={(e) => setInlineCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateNewCategory(inlineCategoryName);
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateNewCategory(inlineCategoryName)}
                        disabled={!inlineCategoryName.trim() || isCreating}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                      >
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineInput(false);
                          setInlineCategoryName('');
                          setCreateError(null);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {createError && (
                      <p className="text-[11px] text-rose-600 font-medium">{createError}</p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineInput(true);
                      setInlineCategoryName(searchFilter.trim());
                      setCreateError(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50/50 rounded-lg border border-dashed border-blue-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add New Category</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium animate-in fade-in duration-150">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-gray-500 leading-relaxed">{helperText}</p>
      ) : null}
    </div>
  );
};

export default MultiCategorySelect;
