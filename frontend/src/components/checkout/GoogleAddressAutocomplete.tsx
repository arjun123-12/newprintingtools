'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Check, Sparkles, Navigation } from 'lucide-react';
import { checkoutService } from '@/services/checkoutService';

declare global {
  interface Window {
    google?: any;
  }
}

export interface SelectedAustralianAddress {
  address_line_1: string;
  address_line_2?: string;
  city: string; // Suburb
  state: string; // State code (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
  postcode: string; // 4-digit postcode
  formatted_address: string;
}

interface GoogleAddressAutocompleteProps {
  value?: string;
  onChange?: (val: string) => void;
  onAddressSelect: (address: SelectedAustralianAddress) => void;
  onManualEntryClick?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  error?: string;
  id?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  source: 'google' | 'locations';
  suburb?: string;
  state?: string;
  postcode?: string;
}

// Global script loading state
let isGoogleScriptLoading = false;
let isGoogleScriptLoaded = false;

export default function GoogleAddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'e.g. 142 Collins Street or 3 Catrina Avenue',
  className = '',
  disabled = false,
  required = false,
  inputRef,
  error,
  id,
}: GoogleAddressAutocompleteProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  // Local state for uncontrolled or controlled input
  const [internalQuery, setInternalQuery] = useState(value || '');
  const activeQuery = value !== undefined ? value : internalQuery;

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [scriptReady, setScriptReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const effectiveInputRef = inputRef || localInputRef;

  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const dummyElementRef = useRef<HTMLDivElement | null>(null);

  // Initialize or refresh Google Autocomplete Session Token
  const refreshSessionToken = useCallback(() => {
    if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteSessionToken) {
      const token = new window.google.maps.places.AutocompleteSessionToken();
      setSessionToken(token);
      return token;
    }
    return null;
  }, []);

  // Dynamically load Google Maps Places script if API key is provided
  useEffect(() => {
    if (!apiKey) return;

    if (window.google?.maps?.places) {
      setScriptReady(true);
      refreshSessionToken();
      return;
    }

    if (isGoogleScriptLoaded) {
      setScriptReady(true);
      refreshSessionToken();
      return;
    }

    if (isGoogleScriptLoading) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          isGoogleScriptLoaded = true;
          setScriptReady(true);
          refreshSessionToken();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    isGoogleScriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGoogleScriptLoading = false;
      isGoogleScriptLoaded = true;
      setScriptReady(true);
      refreshSessionToken();
    };

    script.onerror = () => {
      isGoogleScriptLoading = false;
      console.warn('Failed to load Google Maps Places script.');
    };

    document.head.appendChild(script);
  }, [apiKey, refreshSessionToken]);

  // Initialize AutocompleteService and PlacesService
  useEffect(() => {
    if (!scriptReady || typeof window === 'undefined' || !window.google?.maps?.places) {
      return;
    }

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }

    if (!placesServiceRef.current) {
      if (!dummyElementRef.current) {
        dummyElementRef.current = document.createElement('div');
      }
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyElementRef.current);
    }
  }, [scriptReady]);

  // Click outside listener to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle user typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (value === undefined) {
      setInternalQuery(val);
    }
    onChange?.(val);
  };

  // Query Places API or fallback locations with debouncing
  useEffect(() => {
    const trimmed = activeQuery.trim();

    if (!trimmed || trimmed.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(async () => {
      // 1. If Google Places is ready, query Google Places API
      if (scriptReady && autocompleteServiceRef.current) {
        let activeToken = sessionToken;
        if (!activeToken) {
          activeToken = refreshSessionToken();
        }

        autocompleteServiceRef.current.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'au' }, // Strictly restricted to Australia
            types: ['address'],
            sessionToken: activeToken,
          },
          async (results: any[], status: any) => {
            setIsLoading(false);

            if (
              status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
              Array.isArray(results) &&
              results.length > 0
            ) {
              const formatted: PlacePrediction[] = results.map((r) => ({
                place_id: r.place_id,
                description: r.description,
                main_text: r.structured_formatting?.main_text || r.description,
                secondary_text: r.structured_formatting?.secondary_text || 'Australia',
                source: 'google',
              }));
              setPredictions(formatted);
              setIsOpen(true);
              setHighlightedIndex(-1);
            } else {
              // Fallback to CouriersPlease / Australian Locations directory
              queryFallbackLocations(trimmed);
            }
          }
        );
      } else {
        // No Google Places key or script not loaded: query Australian Locations API directly
        await queryFallbackLocations(trimmed);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [activeQuery, scriptReady, sessionToken, refreshSessionToken]);

  const queryFallbackLocations = async (trimmed: string) => {
    try {
      const locs = await checkoutService.searchLocations(trimmed);
      setIsLoading(false);
      if (Array.isArray(locs) && locs.length > 0) {
        const mapped: PlacePrediction[] = locs.slice(0, 6).map((l, idx) => ({
          place_id: `loc_${l.Postcode}_${l.Suburb}_${idx}`,
          description: `${trimmed}, ${l.Suburb} ${l.State} ${l.Postcode}`,
          main_text: trimmed,
          secondary_text: `${l.Suburb}, ${l.State} ${l.Postcode}`,
          source: 'locations',
          suburb: l.Suburb,
          state: l.State,
          postcode: l.Postcode,
        }));
        setPredictions(mapped);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } else {
        setPredictions([]);
        setIsOpen(false);
      }
    } catch {
      setIsLoading(false);
      setPredictions([]);
      setIsOpen(false);
    }
  };

  // Handle Place Selection
  const handleSelectPrediction = (prediction: PlacePrediction) => {
    if (prediction.source === 'locations') {
      // Selected from Australian Locations directory
      setIsLoading(false);
      setIsOpen(false);
      const streetPart = prediction.main_text || activeQuery.trim();
      if (value === undefined) {
        setInternalQuery(streetPart);
      }
      onChange?.(streetPart);

      onAddressSelect({
        address_line_1: streetPart,
        city: prediction.suburb || '',
        state: prediction.state || 'NSW',
        postcode: prediction.postcode || '',
        formatted_address: prediction.description,
      });
      return;
    }

    if (!placesServiceRef.current || !prediction.place_id) {
      return;
    }

    setIsLoading(true);
    setIsOpen(false);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address'],
        sessionToken: sessionToken,
      },
      (place: any, status: any) => {
        setIsLoading(false);
        refreshSessionToken();

        if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && place) {
          const extracted = parseAustralianAddressComponents(
            place.address_components || [],
            place.formatted_address || prediction.description
          );

          if (value === undefined) {
            setInternalQuery(extracted.address_line_1);
          }
          onChange?.(extracted.address_line_1);

          onAddressSelect(extracted);
        }
      }
    );
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) {
      if (e.key === 'ArrowDown' && predictions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
          handleSelectPrediction(predictions[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case 'Tab':
        setIsOpen(false);
        break;

      default:
        break;
    }
  };

  const handleClear = () => {
    if (value === undefined) {
      setInternalQuery('');
    }
    onChange?.('');
    setPredictions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    effectiveInputRef.current?.focus();
  };

  const hasGoogleResults = predictions.some((p) => p.source === 'google');

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Field with MapPin Icon */}
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />

        <input
          ref={effectiveInputRef as any}
          id={id}
          type="text"
          required={required}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="australian-address-autocomplete-list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `address-option-${highlightedIndex}` : undefined
          }
          disabled={disabled}
          value={activeQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (predictions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-9 pr-16 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
            error
              ? 'border-red-400 bg-red-50/50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        />

        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-sky-500" />}

          {activeQuery && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="hidden sm:inline-flex text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            AU
          </span>
        </div>
      </div>

      {/* Predictions Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div
          id="australian-address-autocomplete-list"
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="max-h-60 overflow-y-auto">
            {predictions.map((p, index) => {
              const isSelected = index === highlightedIndex;
              return (
                <div
                  key={p.place_id}
                  id={`address-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelectPrediction(p)}
                  className={`px-3.5 py-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50/90 text-sky-950 font-medium'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <MapPin
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors ${
                      isSelected ? 'text-sky-600' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold truncate leading-tight">
                      {p.main_text}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {p.secondary_text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer attribution and keyboard tips */}
          <div className="px-3.5 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 select-none">
            <span className="flex items-center gap-1 text-[9px]">
              <span>Use</span>
              <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-[8px] font-mono shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-[8px] font-mono shadow-2xs">
                ↓
              </kbd>
              <span>to navigate,</span>
              <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-[8px] font-mono shadow-2xs">
                Enter
              </kbd>
              <span>to select</span>
            </span>

            {hasGoogleResults ? (
              /* Official Google Attribution */
              <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-slate-400 font-medium">Powered by</span>
                <svg className="h-2.5 w-auto" viewBox="0 0 272 92" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.33 22.25 22.18zm-9.74 0c0-7.98-5.79-13.6-12.51-13.6-6.73 0-12.52 5.62-12.52 13.6 0 7.9 5.79 13.6 12.52 13.6 6.72 0 12.51-5.7 12.51-13.6z" fill="#EA4335"/>
                  <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.33 22.25 22.18zm-9.74 0c0-7.98-5.79-13.6-12.51-13.6-6.73 0-12.52 5.62-12.52 13.6 0 7.9 5.79 13.6 12.52 13.6 6.72 0 12.51-5.7 12.51-13.6z" fill="#FBBC05"/>
                  <path d="M209.75 26.34v41.25c0 16.97-10.08 23.94-22.09 23.94-11.26 0-18.06-7.56-20.66-13.69l8.57-3.57c1.51 3.7 5.21 8.07 12.09 8.07 7.9 0 12.77-4.87 12.77-14.12v-3.44h-.34c-2.35 2.94-6.89 5.55-12.6 5.55-12.01 0-22.93-10.5-22.93-23.77 0-13.44 10.92-23.94 22.93-23.94 5.71 0 10.25 2.61 12.6 5.46h.34v-3.95h9.32v.21zm-8.65 21.09c0-7.81-5.21-13.61-12.01-13.61-6.8 0-12.6 5.79-12.6 13.61 0 7.73 5.79 13.52 12.6 13.52 6.8 0 12.01-5.79 12.01-13.52z" fill="#4285F4"/>
                  <path d="M225.75 3.18v66.18h-9.58V3.18h9.58z" fill="#34A853"/>
                  <path d="M261.27 54.49l7.64 5.12c-2.44 3.61-8.32 9.75-18.48 9.75-12.52 0-21.84-9.66-21.84-22.18 0-13.19 9.41-22.18 20.83-22.18 11.51 0 17.14 9.16 18.98 14.12l1.01 2.52-29.23 12.1c2.27 4.45 5.79 6.72 10.75 6.72 4.96 0 8.32-2.44 10.34-6.04v-.01zm-21.67-8.07l19.57-8.15c-1.09-2.77-4.37-4.71-8.32-4.71-4.96 0-10.75 4.37-11.25 12.86z" fill="#EA4335"/>
                  <path d="M35.61 41.52v9.33h22.6c-.67 5.29-2.44 9.16-5.21 11.93-3.28 3.28-8.4 6.89-17.39 6.89-13.78 0-24.53-11.09-24.53-24.87s10.75-24.87 24.53-24.87c7.48 0 12.85 2.94 16.88 6.8l6.64-6.64C53.51 4.54 45.86.84 35.61.84 16.29.84.5 16.55.5 35.87s15.79 35.03 35.11 35.03c10.42 0 18.23-3.44 24.36-9.75 6.3-6.3 8.32-15.21 8.32-22.35 0-2.27-.17-4.37-.5-6.3H35.61v-.02z" fill="#4285F4"/>
                </svg>
              </div>
            ) : (
              <span className="text-[9px] text-slate-400">Australia Delivery Directory</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Parses raw Google Places address_components array into Australian address structure.
 */
function parseAustralianAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  formattedAddress: string
): SelectedAustralianAddress {
  let streetNumber = '';
  let route = '';
  let suburb = '';
  let state = 'NSW';
  let postcode = '';

  for (const component of components) {
    const types = component.types || [];

    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    } else if (types.includes('route')) {
      route = component.long_name;
    } else if (
      types.includes('locality') ||
      types.includes('sublocality') ||
      types.includes('sublocality_level_1') ||
      types.includes('postal_town')
    ) {
      if (!suburb) suburb = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      // Short name is AU state code: NSW, VIC, QLD, WA, SA, TAS, ACT, NT
      state = component.short_name.toUpperCase();
    } else if (types.includes('postal_code')) {
      postcode = component.long_name.replace(/\D/g, '').slice(0, 4);
    }
  }

  // Construct Line 1
  let addressLine1 = `${streetNumber} ${route}`.trim();
  if (!addressLine1 && formattedAddress) {
    // Fallback: take first part before the first comma
    addressLine1 = formattedAddress.split(',')[0]?.trim() || '';
  }

  // If suburb was not found in locality, try administrative_area_level_2
  if (!suburb) {
    for (const component of components) {
      if (component.types?.includes('administrative_area_level_2')) {
        suburb = component.long_name;
        break;
      }
    }
  }

  // Fallback AU states map
  const VALID_AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  if (!VALID_AU_STATES.includes(state)) {
    state = 'NSW';
  }

  return {
    address_line_1: addressLine1,
    city: suburb,
    state,
    postcode,
    formatted_address: formattedAddress,
  };
}
