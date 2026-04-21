import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Search,
  X,
  RotateCcw,
  Loader2,
  MapPin,
  CheckCircle2,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { searchPlacesWithFallback, getPlaceDetails, getPlaceTypeLabel } from '../services/mapsService';
import type { AppStatus, Destination, PlacePrediction, SelectedPlace } from '../types';
import { en } from '../i18n/en';

interface Props {
  status: AppStatus;
  mapsLoaded: boolean;
  selectedPlace: SelectedPlace | null;
  onPlaceSelected: (place: SelectedPlace) => void;
  onCalculate: () => void;
  onReset: () => void;
  destinations: Destination[];
}

// ---------------------------------------------------------------------------
// Highlight matched substrings in the prediction's main text
// ---------------------------------------------------------------------------

function HighlightedText({
  text,
  matches,
}: {
  text: string;
  matches: Array<{ offset: number; length: number }>;
}) {
  if (!matches.length) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const { offset, length } of matches) {
    if (offset > cursor) parts.push(text.slice(cursor, offset));
    parts.push(
      <span key={offset} className="font-semibold text-gray-900">
        {text.slice(offset, offset + length)}
      </span>
    );
    cursor = offset + length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const InputCard: React.FC<Props> = ({
  status,
  mapsLoaded,
  selectedPlace,
  onPlaceSelected,
  onCalculate,
  onReset,
  destinations,
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  // Tracks whether the user chose a result or is still typing unconfirmed text
  const [needsSelection, setNeedsSelection] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCalculating = status === 'loading';
  const hasResult = status === 'success' || status === 'error';

  // ── Debounced search ──────────────────────────────────────────────────────

  const runSearch = useCallback(
    async (q: string) => {
      if (!mapsLoaded || q.trim().length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        setNoResults(false);
        return;
      }

      setIsSearching(true);
      setNoResults(false);

      try {
        const results = await searchPlacesWithFallback(q);
        setPredictions(results);
        setNoResults(results.length === 0);
        setShowDropdown(true);
        setActiveIndex(-1);
      } finally {
        setIsSearching(false);
      }
    },
    [mapsLoaded]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Select a prediction → fetch details ───────────────────────────────────

  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setShowDropdown(false);
      setIsLoadingDetails(true);
      setNeedsSelection(false);
      setQuery(prediction.description);

      try {
        const place = await getPlaceDetails(prediction.placeId);
        if (place) {
          onPlaceSelected(place);
        }
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [onPlaceSelected]
  );

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && predictions[activeIndex]) {
        handleSelectPrediction(predictions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // ── Clear selection / input ───────────────────────────────────────────────

  const handleClearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowDropdown(false);
    setNeedsSelection(false);
    setNoResults(false);
    inputRef.current?.focus();
  };

  const handleReset = () => {
    handleClearInput();
    onReset();
  };

  // When input changes, mark that user is typing (no confirmed place yet)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setNeedsSelection(true);
    // Clear selected place context in parent if user modifies text
    // (parent will reset on next onPlaceSelected call)
  };

  // ── Calculate guard ───────────────────────────────────────────────────────

  const handleCalculate = () => {
    if (!selectedPlace) {
      // User typed text but didn't pick a result
      setNeedsSelection(true);
      setShowDropdown(true);
      inputRef.current?.focus();
      return;
    }
    onCalculate();
  };

  const canCalculate = Boolean(selectedPlace) && !isCalculating && !isLoadingDetails;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Search Housing Location</h2>
        {hasResult && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {en.input.reset}
          </button>
        )}
      </div>

      {/* ── Search input + dropdown ── */}
      <div className="relative">
        {/* Input */}
        <div
          className={[
            'flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 transition-all',
            showDropdown
              ? 'border-blue-400 ring-2 ring-blue-100'
              : needsSelection && !selectedPlace
              ? 'border-amber-400 ring-2 ring-amber-50'
              : 'border-gray-200 hover:border-gray-300',
          ].join(' ')}
        >
          {isSearching || isLoadingDetails ? (
            <Loader2 className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (predictions.length > 0) setShowDropdown(true);
            }}
            placeholder="e.g. Peabody Terrace, 10 Akron St, Longwood…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            disabled={isCalculating}
            autoComplete="off"
            spellCheck={false}
          />
          {query && !isCalculating && (
            <button
              type="button"
              onClick={handleClearInput}
              className="text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Needs-selection hint */}
        {needsSelection && !selectedPlace && !showDropdown && query.trim().length > 0 && (
          <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            Please select a location from the dropdown results
          </p>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200
                       rounded-xl shadow-xl overflow-hidden"
          >
            {noResults ? (
              <div className="px-4 py-5 text-center space-y-1">
                <p className="text-sm font-medium text-gray-600">No results found</p>
                <p className="text-xs text-gray-400">
                  Try: an address, building name, neighborhood, or add "Cambridge" to your query
                </p>
                <p className="text-xs text-gray-400 italic pt-1">
                  e.g. "Peabody Terrace Cambridge" · "apartments near Harvard"
                </p>
                <p className="text-[11px] text-gray-300 pt-2">
                  Check DevTools console for API status details
                </p>
              </div>
            ) : (
              <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
                {predictions.map((p, i) => (
                  <PredictionItem
                    key={p.placeId}
                    prediction={p}
                    isActive={i === activeIndex}
                    onSelect={() => handleSelectPrediction(p)}
                    onHover={() => setActiveIndex(i)}
                  />
                ))}
              </ul>
            )}

            {!mapsLoaded && (
              <div className="px-4 py-3 border-t border-gray-50 text-center">
                <p className="text-xs text-gray-400">
                  Maps API not loaded — check your API key
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Selected place confirmation card ── */}
      {selectedPlace && !showDropdown && (
        <SelectedPlaceCard place={selectedPlace} onClear={handleClearInput} />
      )}

      {/* ── Hint when no place is selected yet ── */}
      {!selectedPlace && !query && mapsLoaded && (
        <div className="text-xs text-gray-400 leading-relaxed space-y-1">
          <p>{en.input.hint}</p>
          <p>
            Works with:{' '}
            <span className="text-gray-500">apartment names</span> ·{' '}
            <span className="text-gray-500">street addresses</span> ·{' '}
            <span className="text-gray-500">neighborhoods</span> ·{' '}
            <span className="text-gray-500">"housing near Harvard"</span>
          </p>
        </div>
      )}

      {/* ── Calculate button ── */}
      <button
        type="button"
        onClick={handleCalculate}
        disabled={!canCalculate}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isCalculating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {en.input.calculating}
          </>
        ) : (
          en.input.calculate
        )}
      </button>

      {/* ── Destination quick-reference ── */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Calculating to
        </p>
        <div className="grid grid-cols-2 gap-2">
          {destinations.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-xs text-gray-600 truncate">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Prediction dropdown item
// ---------------------------------------------------------------------------

interface PredictionItemProps {
  prediction: PlacePrediction;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}

const PredictionItem: React.FC<PredictionItemProps> = ({
  prediction,
  isActive,
  onSelect,
  onHover,
}) => {
  const typeLabel = getPlaceTypeLabel(prediction.types);
  const isAddressType =
    prediction.types.includes('street_address') ||
    prediction.types.includes('route');

  return (
    <li
      role="option"
      aria-selected={isActive}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent input blur before click registers
        onSelect();
      }}
      onMouseEnter={onHover}
      className={[
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        isActive ? 'bg-blue-50' : 'hover:bg-gray-50',
      ].join(' ')}
    >
      {/* Icon */}
      <div
        className={[
          'mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
          isActive ? 'bg-blue-100' : 'bg-gray-100',
        ].join(' ')}
      >
        {isAddressType ? (
          <MapPin className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
        ) : (
          <Building2 className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 leading-snug truncate">
          <HighlightedText
            text={prediction.mainText}
            matches={prediction.matchedSubstrings}
          />
        </p>
        {prediction.secondaryText && (
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {prediction.secondaryText}
          </p>
        )}
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
          {typeLabel}
        </span>
        <ChevronRight className="w-3 h-3 text-gray-300" />
      </div>
    </li>
  );
};

// ---------------------------------------------------------------------------
// Selected place confirmation card
// ---------------------------------------------------------------------------

interface SelectedPlaceCardProps {
  place: SelectedPlace;
  onClear: () => void;
}

const SelectedPlaceCard: React.FC<SelectedPlaceCardProps> = ({ place, onClear }) => {
  const typeLabel = getPlaceTypeLabel(place.types);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {typeLabel}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed truncate">
          {place.formattedAddress}
        </p>
        <p className="text-[11px] text-gray-400 mt-1 font-mono">
          {place.latLng.lat.toFixed(5)}°N,&nbsp;
          {Math.abs(place.latLng.lng).toFixed(5)}°W
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-1"
        aria-label="Clear selected location"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
