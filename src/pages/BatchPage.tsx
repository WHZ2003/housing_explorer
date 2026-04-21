import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Clipboard, Search, X, Check, MapPin, Loader2,
  AlertCircle, CheckCircle2, Clock, ArrowUpDown, ArrowUp,
  ArrowDown, Download, Bus, Pencil, Trash2, Eye, BarChart2,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useFavorites } from '../context/FavoritesContext';
import { FavoriteButton } from '../components/FavoriteButton';
import {
  searchPlacesWithFallback,
  getPlaceDetails,
  getPlaceTypeLabel,
  calculateCommuteTimes,
  nextWeekday9AM,
} from '../services/mapsService';
import { estimateM2Commute } from '../services/m2CommuteService';
import { estimateHarvardShuttle } from '../services/harvardShuttleService';
import { calculateWeightedScore, getCommuteScore, formatDuration, SCORE_CONFIG } from '../utils/scoring';
import { BatchMapView } from '../components/BatchMapView';
import type {
  ApartmentEntry,
  ApartmentConfirmStatus,
  DestinationCommute,
  LatLng,
  PlacePrediction,
  SelectedPlace,
} from '../types';

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortField = 'score' | 'average' | `dest:${string}`;
interface SortConfig { field: SortField; dir: 'asc' | 'desc' }

function sortApartments(rows: ApartmentEntry[], cfg: SortConfig): ApartmentEntry[] {
  const done = rows.filter(r => r.commuteStatus === 'done' && r.confirmStatus === 'confirmed');
  const rest = rows.filter(r => !(r.commuteStatus === 'done' && r.confirmStatus === 'confirmed'));
  const sorted = [...done].sort((a, b) => {
    let va = 0, vb = 0;
    if (cfg.field === 'score') { va = a.weightedScore; vb = b.weightedScore; }
    else if (cfg.field === 'average') { va = a.averageBestSeconds; vb = b.averageBestSeconds; }
    else if (cfg.field.startsWith('dest:')) {
      const id = cfg.field.slice(5);
      va = a.destinations.find(d => d.destination.id === id)?.bestDurationSeconds ?? Infinity;
      vb = b.destinations.find(d => d.destination.id === id)?.bestDurationSeconds ?? Infinity;
    }
    return cfg.dir === 'asc' ? va - vb : vb - va;
  });
  return [...sorted, ...rest];
}

function bestVal(rows: ApartmentEntry[], field: SortField): number {
  const vals = rows
    .filter(r => r.commuteStatus === 'done')
    .map(r => {
      if (field === 'score') return r.weightedScore;
      if (field === 'average') return r.averageBestSeconds;
      if (field.startsWith('dest:')) {
        const id = field.slice(5);
        const dc = r.destinations.find(d => d.destination.id === id);
        if (!dc) return Infinity;
        return Math.min(
          dc.bestDurationSeconds,
          dc.m2?.totalSeconds ?? Infinity,
          dc.harvardShuttle?.totalSeconds ?? Infinity,
        );
      }
      return Infinity;
    });
  if (!vals.length) return field === 'score' ? -Infinity : Infinity;
  return field === 'score' ? Math.max(...vals) : Math.min(...vals);
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCsv(apartments: ApartmentEntry[], destIds: string[], destLabels: string[]) {
  const header = ['Apartment', 'Address', ...destLabels, 'M2 available', 'Avg (min)', 'Score'];
  const rows = apartments
    .filter(a => a.commuteStatus === 'done' && a.place)
    .map(a => {
      const destCols = destIds.map(id => {
        const dc = a.destinations.find(d => d.destination.id === id);
        return dc?.bestDurationSeconds && dc.bestDurationSeconds < Infinity
          ? String(Math.round(dc.bestDurationSeconds / 60))
          : '';
      });
      const hasM2 = a.destinations.some(d => d.m2 != null);
      return [
        `"${a.inputLabel}"`,
        `"${a.place!.formattedAddress}"`,
        ...destCols,
        hasM2 ? 'Yes' : 'No',
        Math.round(a.averageBestSeconds / 60),
        a.weightedScore,
      ].join(',');
    });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'housing-comparison.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------

const SortIcon: React.FC<{ field: SortField; current: SortConfig }> = ({ field, current }) => {
  if (current.field !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
  return current.dir === 'desc'
    ? <ArrowDown className="w-3 h-3 text-blue-500" />
    : <ArrowUp className="w-3 h-3 text-blue-500" />;
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const ConfirmBadge: React.FC<{ status: ApartmentConfirmStatus }> = ({ status }) => {
  if (status === 'confirmed')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed</span>;
  if (status === 'needs_review')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Review</span>;
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Not found</span>;
};

// ---------------------------------------------------------------------------
// Highlight matched substrings
// ---------------------------------------------------------------------------

function HighlightedText({ text, matches }: { text: string; matches: Array<{ offset: number; length: number }> }) {
  if (!matches.length) return <span>{text}</span>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const { offset, length } of matches) {
    if (offset > cursor) parts.push(text.slice(cursor, offset));
    parts.push(<span key={offset} className="font-semibold text-gray-900">{text.slice(offset, offset + length)}</span>);
    cursor = offset + length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { mapsLoaded: boolean }

export const BatchPage: React.FC<Props> = ({ mapsLoaded }) => {
  const { activeDestinations, enabledModes } = useAppContext();
  const { addToCompare, removeFromCompare, isInCompare } = useFavorites();

  // ── Apartment list ──────────────────────────────────────────────────────

  const [apartments, setApartments] = useState<ApartmentEntry[]>([]);

  // ── Add mode ────────────────────────────────────────────────────────────

  const [addMode, setAddMode] = useState<'manual' | 'bulk'>('manual');

  // ── Manual add flow ─────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery]       = useState('');
  const [suggestions, setSuggestions]       = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showSuggestions, setShowSuggestions]   = useState(false);
  const [noResults, setNoResults]           = useState(false);
  const [activeIndex, setActiveIndex]       = useState(-1);

  // pendingPlace = place being confirmed right now
  const [pendingPlace, setPendingPlace]     = useState<SelectedPlace | null>(null);
  // pendingReviewId = if reviewing an existing entry (not adding new)
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [adjustMode, setAdjustMode]         = useState(false);

  // ── Bulk flow ────────────────────────────────────────────────────────────

  const [bulkText, setBulkText]           = useState('');
  const [isResolvingBulk, setIsResolvingBulk] = useState(false);
  const [bulkProgress, setBulkProgress]   = useState({ done: 0, total: 0 });

  // ── Map / table ──────────────────────────────────────────────────────────

  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcProgress, setCalcProgress]   = useState({ done: 0, total: 0 });
  const [sortConfig, setSortConfig]       = useState<SortConfig>({ field: 'score', dir: 'desc' });

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounced search ─────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    if (!mapsLoaded || q.trim().length < 2) {
      setSuggestions([]); setShowSuggestions(false); setNoResults(false); return;
    }
    setIsSearching(true); setNoResults(false);
    try {
      const results = await searchPlacesWithFallback(q);
      setSuggestions(results);
      setNoResults(results.length === 0);
      setShowSuggestions(true);
      setActiveIndex(-1);
    } finally {
      setIsSearching(false);
    }
  }, [mapsLoaded]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, runSearch]);

  // ── Close dropdown on outside click ──────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Select a prediction → fetch details ──────────────────────────────────

  const handleSelectPrediction = useCallback(async (pred: PlacePrediction) => {
    setShowSuggestions(false);
    setIsLoadingDetails(true);
    setSearchQuery(pred.description);
    try {
      const place = await getPlaceDetails(pred.placeId);
      if (place) { setPendingPlace(place); setAdjustMode(false); }
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // ── Keyboard nav ─────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) handleSelectPrediction(suggestions[activeIndex]); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  };

  // ── Confirm + add apartment ───────────────────────────────────────────────

  const handleConfirmAdd = useCallback(() => {
    if (!pendingPlace) return;

    if (pendingReviewId) {
      // Updating an existing entry
      setApartments(prev => prev.map(a =>
        a.id === pendingReviewId
          ? { ...a, place: pendingPlace, confirmStatus: 'confirmed', resolveError: null, commuteStatus: 'idle', destinations: [] }
          : a
      ));
    } else {
      // Adding new entry
      const entry: ApartmentEntry = {
        id: `apt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        inputLabel: searchQuery.trim() || pendingPlace.name,
        place: pendingPlace,
        confirmStatus: 'confirmed',
        source: 'manual',
        resolveError: null,
        candidates: suggestions,
        commuteStatus: 'idle',
        destinations: [],
        averageBestSeconds: 0,
        weightedScore: 0,
        commuteError: null,
      };
      setApartments(prev => [...prev, entry]);
    }

    setPendingPlace(null);
    setPendingReviewId(null);
    setAdjustMode(false);
    setSearchQuery('');
    setSuggestions([]);
  }, [pendingPlace, pendingReviewId, searchQuery, suggestions]);

  const handleCancelPending = useCallback(() => {
    setPendingPlace(null);
    setPendingReviewId(null);
    setAdjustMode(false);
    if (!pendingReviewId) { setSearchQuery(''); setSuggestions([]); }
  }, [pendingReviewId]);

  const handlePendingMoved = useCallback((latLng: LatLng) => {
    setPendingPlace(p => p ? {
      ...p,
      latLng,
      formattedAddress: `${latLng.lat.toFixed(5)}°N, ${Math.abs(latLng.lng).toFixed(5)}°W (adjusted)`,
    } : null);
  }, []);

  // ── Open review panel for an existing entry ───────────────────────────────

  const handleReviewEntry = useCallback((apt: ApartmentEntry) => {
    if (!apt.place) return;
    setPendingPlace(apt.place);
    setPendingReviewId(apt.id);
    setSearchQuery(apt.inputLabel);
    setAdjustMode(false);
    setAddMode('manual');
  }, []);

  // ── Quick-confirm (mark confirmed without map) ────────────────────────────

  const handleQuickConfirm = useCallback((id: string) => {
    setApartments(prev => prev.map(a =>
      a.id === id ? { ...a, confirmStatus: 'confirmed' } : a
    ));
  }, []);

  const handleRemoveApartment = useCallback((id: string) => {
    setApartments(prev => prev.filter(a => a.id !== id));
    if (pendingReviewId === id) { setPendingPlace(null); setPendingReviewId(null); }
  }, [pendingReviewId]);

  // ── Bulk paste resolve ────────────────────────────────────────────────────

  const handleBulkResolve = useCallback(async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    setIsResolvingBulk(true);
    setBulkProgress({ done: 0, total: lines.length });

    const CONCURRENCY = 3;
    const newEntries: ApartmentEntry[] = [];

    for (let i = 0; i < lines.length; i += CONCURRENCY) {
      const batch = lines.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (text) => {
        const id = `apt-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const base: ApartmentEntry = {
          id, inputLabel: text, place: null, confirmStatus: 'unconfirmed', source: 'bulk',
          resolveError: null, candidates: [], commuteStatus: 'idle',
          destinations: [], averageBestSeconds: 0, weightedScore: 0, commuteError: null,
        };
        try {
          const preds = await searchPlacesWithFallback(text);
          if (!preds.length) return { ...base, resolveError: 'No matching place found' };
          const place = await getPlaceDetails(preds[0].placeId);
          if (!place) return { ...base, resolveError: 'Could not resolve place details' };
          return { ...base, place, confirmStatus: 'needs_review' as const, candidates: preds };
        } catch {
          return { ...base, resolveError: 'Search failed' };
        }
      }));
      newEntries.push(...results);
      setBulkProgress(p => ({ ...p, done: Math.min(p.total, i + CONCURRENCY) }));
    }

    setApartments(prev => [...prev, ...newEntries]);
    setIsResolvingBulk(false);
    setBulkText('');
    // Switch to list view to show results
    setAddMode('manual');
  }, [bulkText]);

  // ── Calculate commutes ────────────────────────────────────────────────────

  const computeApartmentCommutes = useCallback(async (apt: ApartmentEntry): Promise<ApartmentEntry> => {
    if (!apt.place) return apt;
    try {
      const departure = nextWeekday9AM();
      const destAddresses = activeDestinations.map(d => d.address);
      const matrix = await calculateCommuteTimes(apt.place.latLng, destAddresses, enabledModes);

      const destCommutes: DestinationCommute[] = activeDestinations.map((dest, i) => {
        const legs = matrix[i];
        const ok = legs.filter(l => l.status === 'OK').map(l => l.durationSeconds);
        const preferred = legs.filter(l => l.status === 'OK' && (l.mode === 'driving' || l.mode === 'transit')).map(l => l.durationSeconds);
        const best = (preferred.length ? preferred : ok).reduce((mn, v) => Math.min(mn, v), Infinity);

        const destLatLng = { lat: dest.lat, lng: dest.lng };
        const m2 = estimateM2Commute(apt.place!.latLng, destLatLng, departure);
        const harvardShuttle = estimateHarvardShuttle(apt.place!.latLng, destLatLng);
        return {
          destination: dest, legs,
          bestDurationSeconds: best,
          score: getCommuteScore(best === Infinity ? 99999 : best),
          m2: m2 ?? null,
          harvardShuttle: harvardShuttle ?? null,
        };
      });

      const finite = destCommutes.filter(d => d.bestDurationSeconds < Infinity);
      const avg = finite.length ? finite.reduce((s, d) => s + d.bestDurationSeconds, 0) / finite.length : 0;

      return { ...apt, destinations: destCommutes, averageBestSeconds: avg, weightedScore: calculateWeightedScore(destCommutes), commuteStatus: 'done', commuteError: null };
    } catch {
      return { ...apt, commuteStatus: 'error', commuteError: 'Commute calculation failed' };
    }
  }, [activeDestinations, enabledModes]);

  const handleCalculate = useCallback(async () => {
    const toCalc = apartments.filter(a => a.confirmStatus === 'confirmed' && a.commuteStatus === 'idle' && a.place);
    if (!toCalc.length) return;

    setIsCalculating(true);
    setCalcProgress({ done: 0, total: toCalc.length });

    const CONCURRENCY = 3;
    for (let i = 0; i < toCalc.length; i += CONCURRENCY) {
      const batch = toCalc.slice(i, i + CONCURRENCY);
      // Mark as calculating
      setApartments(prev => prev.map(a => batch.find(b => b.id === a.id) ? { ...a, commuteStatus: 'calculating' } : a));
      const results = await Promise.all(batch.map(a => computeApartmentCommutes(a)));
      setApartments(prev => prev.map(a => results.find(r => r.id === a.id) ?? a));
      setCalcProgress(p => ({ ...p, done: Math.min(p.total, i + CONCURRENCY) }));
    }
    setIsCalculating(false);
  }, [apartments, computeApartmentCommutes]);

  // ── Sort toggle ───────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    setSortConfig(c => c.field === field
      ? { field, dir: c.dir === 'desc' ? 'asc' : 'desc' }
      : { field, dir: field === 'score' ? 'desc' : 'asc' });
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const confirmedWithResults = apartments.filter(a => a.confirmStatus === 'confirmed' && a.commuteStatus === 'done');
  const pendingCalc = apartments.filter(a => a.confirmStatus === 'confirmed' && a.commuteStatus === 'idle' && a.place);
  const needsReview = apartments.filter(a => a.confirmStatus === 'needs_review');

  const sortedResults = sortApartments(confirmedWithResults, sortConfig);
  const bestScore = bestVal(confirmedWithResults, 'score');
  const bestAvg   = bestVal(confirmedWithResults, 'average');
  const bestPerDest: Record<string, number> = {};
  activeDestinations.forEach(d => { bestPerDest[d.id] = bestVal(confirmedWithResults, `dest:${d.id}`); });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Main row: sidebar + map ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Sidebar ── */}
        <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-3">

            {/* Header */}
            <div>
              <h1 className="text-base font-bold text-gray-900">Batch Comparison</h1>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> All commutes use 9:00 AM weekday departure
              </p>
            </div>

            {/* No destinations warning */}
            {activeDestinations.length === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">No destinations enabled. Go to Settings to enable at least one.</p>
              </div>
            )}

            {/* ── Mode tabs ── */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
              <button
                onClick={() => setAddMode('manual')}
                className={['flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all',
                  addMode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'].join(' ')}
              >
                <Plus className="w-3.5 h-3.5" /> Add One
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                className={['flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all',
                  addMode === 'bulk' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'].join(' ')}
              >
                <Clipboard className="w-3.5 h-3.5" /> Bulk Paste
              </button>
            </div>

            {/* ── Add One panel ── */}
            {addMode === 'manual' && !pendingPlace && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Search for an apartment, building, or address to add it to your comparison list.</p>

                {/* Search box */}
                <div className="relative">
                  <div className={['flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-all',
                    showSuggestions ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'].join(' ')}>
                    {(isSearching || isLoadingDetails) ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" /> : <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
                      placeholder="e.g. Peabody Terrace, 10 Akron St…"
                      className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }} className="text-gray-300 hover:text-gray-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown */}
                  {showSuggestions && (
                    <div ref={dropdownRef} className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                      {noResults ? (
                        <div className="px-4 py-4 text-center">
                          <p className="text-sm text-gray-500">No results. Try adding "Cambridge" or a full address.</p>
                        </div>
                      ) : (
                        <ul className="max-h-56 overflow-y-auto py-1">
                          {suggestions.map((p, i) => (
                            <li
                              key={p.placeId}
                              onMouseDown={e => { e.preventDefault(); handleSelectPrediction(p); }}
                              onMouseEnter={() => setActiveIndex(i)}
                              className={['flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                                i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'].join(' ')}
                            >
                              <div className={['mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0',
                                i === activeIndex ? 'bg-blue-100' : 'bg-gray-100'].join(' ')}>
                                <MapPin className={`w-3 h-3 ${i === activeIndex ? 'text-blue-600' : 'text-gray-400'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 truncate">
                                  <HighlightedText text={p.mainText} matches={p.matchedSubstrings} />
                                </p>
                                {p.secondaryText && <p className="text-xs text-gray-400 truncate">{p.secondaryText}</p>}
                              </div>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                                {getPlaceTypeLabel(p.types)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Pending confirmation panel ── */}
            {pendingPlace && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{pendingPlace.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{pendingPlace.formattedAddress}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">
                      {pendingPlace.latLng.lat.toFixed(5)}°N, {Math.abs(pendingPlace.latLng.lng).toFixed(5)}°W
                    </p>
                  </div>
                </div>
                <p className="text-xs text-amber-700">Is this the right location? Verify on the map, drag the pin to adjust, or click the map if "Adjust" mode is on.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmAdd}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {pendingReviewId ? 'Confirm update' : 'Confirm & add'}
                  </button>
                  <button
                    onClick={() => setAdjustMode(v => !v)}
                    className={['flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all',
                      adjustMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'].join(' ')}
                  >
                    <Pencil className="w-3 h-3" />
                    Adjust
                  </button>
                  <button
                    onClick={handleCancelPending}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Bulk paste panel ── */}
            {addMode === 'bulk' && !pendingPlace && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Paste apartment names or addresses (one per line). Each entry will be resolved and marked for your review.
                </p>
                <textarea
                  className="w-full h-32 text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white"
                  placeholder={"Peabody Terrace, Cambridge\n10 Akron St, Somerville\nLongwood Towers"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  disabled={isResolvingBulk}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {bulkText.split('\n').filter(l => l.trim()).length} entries
                  </span>
                  <button
                    onClick={handleBulkResolve}
                    disabled={isResolvingBulk || !bulkText.trim() || !activeDestinations.length}
                    className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    {isResolvingBulk ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}</>
                    ) : (
                      <><Search className="w-3.5 h-3.5" /> Resolve all</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Apartment list ── */}
            {apartments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Shortlist ({apartments.length})
                  </p>
                  {needsReview.length > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      {needsReview.length} need review
                    </span>
                  )}
                </div>

                {apartments.map((apt, idx) => (
                  <div
                    key={apt.id}
                    className={['flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors',
                      apt.id === selectedApartmentId ? 'border-violet-300 bg-violet-50' : 'border-gray-100 bg-gray-50',
                      apt.confirmStatus === 'unconfirmed' ? 'opacity-60' : ''].join(' ')}
                    onClick={() => setSelectedApartmentId(apt.id)}
                  >
                    {/* Number badge */}
                    <div className={['w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5',
                      apt.confirmStatus === 'confirmed' ? 'bg-violet-600' : apt.confirmStatus === 'needs_review' ? 'bg-amber-500' : 'bg-gray-300'].join(' ')}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {apt.place?.name ?? apt.inputLabel}
                        </p>
                        <ConfirmBadge status={apt.confirmStatus} />
                        {apt.commuteStatus === 'calculating' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                        {apt.commuteStatus === 'done' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </div>
                      {apt.place && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{apt.place.formattedAddress}</p>
                      )}
                      {apt.resolveError && (
                        <p className="text-[11px] text-red-500 mt-0.5">{apt.resolveError}</p>
                      )}
                      {apt.commuteError && (
                        <p className="text-[11px] text-red-500 mt-0.5">{apt.commuteError}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {/* Favorite toggle */}
                      <FavoriteButton apartment={apt} />

                      {/* Compare toggle — only when commute is done */}
                      {apt.commuteStatus === 'done' && (() => {
                        const inCmp = isInCompare(apt.id);
                        return (
                          <button
                            onClick={e => { e.stopPropagation(); inCmp ? removeFromCompare(apt.id) : addToCompare(apt); }}
                            title={inCmp ? 'Remove from compare' : 'Add to compare'}
                            className={['p-1 rounded transition-colors', inCmp ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-400'].join(' ')}
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}

                      {apt.confirmStatus === 'needs_review' && apt.place && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); handleQuickConfirm(apt.id); }}
                            title="Confirm as-is"
                            className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleReviewEntry(apt); }}
                            title="Review on map"
                            className="p-1 text-amber-500 hover:text-amber-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {apt.confirmStatus === 'confirmed' && apt.place && (
                        <button
                          onClick={e => { e.stopPropagation(); handleReviewEntry(apt); }}
                          title="Edit location"
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveApartment(apt.id); }}
                        title="Remove"
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Calculate button */}
                {pendingCalc.length > 0 && (
                  <button
                    onClick={handleCalculate}
                    disabled={isCalculating || !activeDestinations.length}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    {isCalculating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {calcProgress.done}/{calcProgress.total}</>
                    ) : (
                      <>Calculate commutes for {pendingCalc.length} apartment{pendingCalc.length !== 1 ? 's' : ''}</>
                    )}
                  </button>
                )}
              </div>
            )}

            {apartments.length === 0 && !pendingPlace && (
              <div className="text-center py-8 text-gray-400">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No apartments yet.</p>
                <p className="text-xs mt-1">Add apartments one by one or paste a bulk list.</p>
              </div>
            )}

          </div>
        </div>

        {/* ── Map ── */}
        <div className="flex-1 min-w-0 min-h-0">
          <BatchMapView
            mapsLoaded={mapsLoaded}
            destinations={activeDestinations}
            apartments={apartments}
            pendingPlace={pendingPlace}
            adjustMode={adjustMode}
            selectedApartmentId={selectedApartmentId}
            onPendingMoved={handlePendingMoved}
            onApartmentSelect={setSelectedApartmentId}
          />
        </div>
      </div>

      {/* ── Comparison table (below map+sidebar, only when results exist) ── */}
      {confirmedWithResults.length > 0 && (
        <div className="border-t border-gray-200 bg-white flex-shrink-0 max-h-[42vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 sticky top-0 bg-white z-10">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Comparison — {confirmedWithResults.length} apartment{confirmedWithResults.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => exportCsv(confirmedWithResults, activeDestinations.map(d => d.id), activeDestinations.map(d => d.shortLabel))}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 min-w-[160px] sticky left-0 bg-gray-50">
                    Apartment
                  </th>
                  {activeDestinations.map(d => (
                    <th
                      key={d.id}
                      className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap"
                      onClick={() => toggleSort(`dest:${d.id}`)}
                    >
                      <div className="flex items-center gap-1 justify-center">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        {d.shortLabel}
                        <SortIcon field={`dest:${d.id}`} current={sortConfig} />
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap" onClick={() => toggleSort('average')}>
                    <div className="flex items-center gap-1 justify-center">Avg <SortIcon field="average" current={sortConfig} /></div>
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap" onClick={() => toggleSort('score')}>
                    <div className="flex items-center gap-1 justify-center">Score <SortIcon field="score" current={sortConfig} /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedResults.map(apt => {
                  const scoreCfg = SCORE_CONFIG[getCommuteScore(apt.averageBestSeconds)];
                  return (
                    <tr
                      key={apt.id}
                      className={['transition-colors hover:bg-gray-50 cursor-pointer',
                        apt.id === selectedApartmentId ? 'bg-violet-50' : ''].join(' ')}
                      onClick={() => setSelectedApartmentId(apt.id)}
                    >
                      {/* Apartment name + action icons */}
                      <td className="px-4 py-3 sticky left-0 bg-inherit">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[150px]">{apt.place?.name ?? apt.inputLabel}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[150px]">{apt.place?.formattedAddress}</p>
                        <div className="flex items-center gap-0.5 mt-1" onClick={e => e.stopPropagation()}>
                          <FavoriteButton apartment={apt} />
                          {(() => {
                            const inCmp = isInCompare(apt.id);
                            return (
                              <button
                                onClick={() => inCmp ? removeFromCompare(apt.id) : addToCompare(apt)}
                                title={inCmp ? 'Remove from compare' : 'Add to compare'}
                                className={['p-1 rounded transition-colors', inCmp ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-400'].join(' ')}
                              >
                                <BarChart2 className="w-3 h-3" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Per-destination */}
                      {activeDestinations.map(dest => {
                        const dc   = apt.destinations.find(d => d.destination.id === dest.id);
                        const secs = dc?.bestDurationSeconds ?? Infinity;
                        const m2Secs   = dc?.m2?.totalSeconds ?? Infinity;
                        const harvSecs = dc?.harvardShuttle?.totalSeconds ?? Infinity;
                        const bestSecs = Math.min(secs, m2Secs, harvSecs);
                        const m2Beats   = m2Secs < secs && m2Secs <= harvSecs;
                        const harvBeats = harvSecs < secs && harvSecs < m2Secs;
                        const isBest = bestSecs === bestPerDest[dest.id];

                        return (
                          <td key={dest.id} className="px-3 py-3 text-center">
                            {bestSecs < Infinity ? (
                              <div className={['inline-flex flex-col items-center', isBest ? 'text-emerald-700' : 'text-gray-700'].join(' ')}>
                                <span className={['text-sm font-medium', isBest ? 'font-semibold' : ''].join(' ')}>
                                  {formatDuration(bestSecs)}
                                  {isBest && <span className="ml-0.5 text-[10px]">★</span>}
                                </span>
                                {m2Beats && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-violet-500 font-medium mt-0.5">
                                    <Bus className="w-2.5 h-2.5" /> M2
                                  </span>
                                )}
                                {harvBeats && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium mt-0.5">
                                    <Bus className="w-2.5 h-2.5" /> Harv
                                  </span>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}

                      {/* Avg */}
                      <td className={['px-3 py-3 text-center text-sm',
                        apt.averageBestSeconds === bestAvg ? 'font-semibold text-emerald-700' : 'text-gray-600'].join(' ')}>
                        {formatDuration(apt.averageBestSeconds)}
                      </td>

                      {/* Score */}
                      <td className="px-3 py-3 text-center">
                        <span className={['inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
                          scoreCfg.textColor, scoreCfg.bgColor, scoreCfg.borderColor].join(' ')}>
                          {apt.weightedScore}
                          {apt.weightedScore === bestScore && <span className="text-[10px]">★</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
