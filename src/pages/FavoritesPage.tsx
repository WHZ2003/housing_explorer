import React, { useRef, useState } from 'react';
import {
  Heart, Trash2, BarChart2, Bus, Clock,
  RefreshCw, Loader2, ChevronRight, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useAppContext } from '../context/AppContext';
import { useCommuteCalculator } from '../hooks/useCommuteCalculator';
import { formatDuration, SCORE_CONFIG, getCommuteScore } from '../utils/scoring';
import type { Destination, SavedApartment } from '../types';

// ---------------------------------------------------------------------------
// FavoritesPage
// ---------------------------------------------------------------------------

interface Props {
  mapsLoaded: boolean;
  onNavigateToBatch: () => void;
  onOpenCompare: () => void;
}

interface RefreshState {
  running: boolean;
  done: number;
  total: number;
  errors: number;
}

export const FavoritesPage: React.FC<Props> = ({ mapsLoaded, onNavigateToBatch, onOpenCompare }) => {
  const {
    favoritesArray, addToCompare, importFavoritesToBatch,
    updateFavoriteCommutes,
  } = useFavorites();
  const { activeDestinations } = useAppContext();
  const { computeCommutes } = useCommuteCalculator();

  const [refreshState, setRefreshState] = useState<RefreshState | null>(null);
  const [compareAllMsg, setCompareAllMsg] = useState<string | null>(null);
  const refreshAbortRef = useRef(false);

  // ── Refresh All Commutes ────────────────────────────────────────────────

  const handleRefreshAll = async () => {
    if (!mapsLoaded || refreshState?.running) return;
    const toRefresh = favoritesArray.filter(a => a.place != null);
    if (!toRefresh.length) return;

    refreshAbortRef.current = false;
    setRefreshState({ running: true, done: 0, total: toRefresh.length, errors: 0 });

    for (const apt of toRefresh) {
      if (refreshAbortRef.current) break;
      const now = Date.now();
      try {
        const result = await computeCommutes(apt.place!);
        updateFavoriteCommutes(apt.id, result, now);
      } catch {
        setRefreshState(s => s ? { ...s, errors: s.errors + 1 } : s);
      }
      setRefreshState(s => s ? { ...s, done: s.done + 1 } : s);
    }

    setRefreshState(s => s ? { ...s, running: false } : null);
  };

  // ── Compare All ─────────────────────────────────────────────────────────

  const handleCompareAll = () => {
    const eligible = favoritesArray.filter(a => a.destinations.length > 0);
    if (!eligible.length) {
      setCompareAllMsg('No apartments with commute data yet — calculate commutes first.');
      return;
    }
    const toAdd = eligible.slice(0, 5);
    toAdd.forEach(a => addToCompare(a));
    onOpenCompare();
    if (eligible.length > 5) {
      setCompareAllMsg(`Compare limit is 5 — showing the ${toAdd.length} most recently saved.`);
    }
  };

  // ── Import All to Batch ─────────────────────────────────────────────────

  const handleImportToBatch = () => {
    importFavoritesToBatch(favoritesArray);
    onNavigateToBatch();
  };

  // ── Empty state ─────────────────────────────────────────────────────────

  if (favoritesArray.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 px-4">
        <Heart className="w-10 h-10 opacity-20" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">No saved apartments yet</p>
          <p className="text-xs mt-1 text-gray-400 max-w-xs">
            Click the heart icon on any apartment in Batch Comparison to save it here.
            Commute data is computed automatically on save.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const anyWithData = favoritesArray.some(a => a.destinations.length > 0);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-current flex-shrink-0" />
              Saved Apartments
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {favoritesArray.length} saved · most recent first
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Refresh All */}
            <button
              onClick={handleRefreshAll}
              disabled={!mapsLoaded || refreshState?.running}
              title={!mapsLoaded ? 'Maps API not loaded' : 'Recompute commutes for all saved apartments'}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {refreshState?.running
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              {refreshState?.running
                ? `Refreshing ${refreshState.done}/${refreshState.total}…`
                : 'Refresh All Commutes'
              }
            </button>

            {/* Compare All */}
            {anyWithData && (
              <button
                onClick={handleCompareAll}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                  bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Compare All
              </button>
            )}

            {/* Import to Batch */}
            <button
              onClick={handleImportToBatch}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Import All to Batch
            </button>
          </div>
        </div>

        {/* Refresh result banner */}
        {refreshState && !refreshState.running && (
          <div className={[
            'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs',
            refreshState.errors > 0
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800',
          ].join(' ')}>
            {refreshState.errors > 0
              ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              : <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            }
            {refreshState.errors > 0
              ? `Refreshed ${refreshState.total - refreshState.errors} of ${refreshState.total} apartments (${refreshState.errors} failed).`
              : `All ${refreshState.total} apartment commutes refreshed successfully.`
            }
            <button
              onClick={() => setRefreshState(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Compare-all message */}
        {compareAllMsg && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-blue-50 border-blue-200 text-xs text-blue-800">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {compareAllMsg}
            <button onClick={() => setCompareAllMsg(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {/* ── Cards ── */}
        {favoritesArray.map(apt => (
          <FavoriteCard
            key={apt.id}
            apt={apt}
            activeDestinations={activeDestinations}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FavoriteCard
// ---------------------------------------------------------------------------

interface CardProps {
  apt: SavedApartment;
  activeDestinations: Destination[];
}

const FavoriteCard: React.FC<CardProps> = ({ apt, activeDestinations }) => {
  const { removeFavorite, updateNote, addToCompare, removeFromCompare, isInCompare } = useFavorites();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inCompare = isInCompare(apt.id);

  const handleNoteChange = (note: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateNote(apt.id, note), 600);
  };

  const scoreCfg = SCORE_CONFIG[getCommuteScore(apt.averageBestSeconds)];
  const hasDone  = apt.destinations.length > 0;

  return (
    <div className="card p-4 space-y-3.5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {apt.place?.name ?? apt.inputLabel}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {apt.place?.formattedAddress ?? apt.inputLabel}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-gray-300">
              Saved {new Date(apt.savedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
            {apt.commuteUpdatedAt && (
              <p className="text-[10px] text-gray-300">
                · refreshed {new Date(apt.commuteUpdatedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasDone && (
            <span className={[
              'text-xs font-semibold px-2 py-0.5 rounded-full border',
              scoreCfg.textColor, scoreCfg.bgColor, scoreCfg.borderColor,
            ].join(' ')}>
              {apt.weightedScore}
            </span>
          )}

          {/* Compare toggle */}
          <button
            onClick={() => inCompare ? removeFromCompare(apt.id) : addToCompare(apt)}
            disabled={!hasDone}
            title={!hasDone ? 'Calculate commutes first' : inCompare ? 'Remove from compare' : 'Add to compare (max 5)'}
            className={[
              'p-1.5 rounded-lg border text-xs font-medium transition-all',
              !hasDone
                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                : inCompare
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-600',
            ].join(' ')}
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => removeFavorite(apt.id)}
            title="Remove from favorites"
            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Commute grid ── */}
      {hasDone ? (
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Commute
            </span>
            <span className="text-xs font-semibold text-gray-700">
              Avg {formatDuration(apt.averageBestSeconds)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeDestinations.map(dest => {
              const dc = apt.destinations.find(d => d.destination.id === dest.id);
              if (!dc) return null;
              const secs     = dc.bestDurationSeconds;
              const m2Secs   = dc.m2?.totalSeconds    ?? Infinity;
              const harvSecs = dc.harvardShuttle?.totalSeconds ?? Infinity;
              const bestSecs = Math.min(secs, m2Secs, harvSecs);
              const m2Beats   = m2Secs   < secs && m2Secs   <= harvSecs;
              const harvBeats = harvSecs  < secs && harvSecs  < m2Secs;
              return (
                <div key={dest.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dest.color }} />
                    <span className="text-[11px] text-gray-500 truncate">{dest.shortLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(m2Beats || harvBeats) && (
                      <Bus className={`w-2.5 h-2.5 ${harvBeats ? 'text-emerald-600' : 'text-violet-500'}`} />
                    )}
                    <span className="text-xs font-semibold text-gray-800">
                      {bestSecs < Infinity ? formatDuration(bestSecs) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            No commute data — use "Refresh All Commutes" to compute it.
          </p>
        </div>
      )}

      {/* ── Notes ── */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Notes
        </label>
        <textarea
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none placeholder-gray-300 focus:outline-none focus:border-blue-300 bg-white transition-colors leading-relaxed"
          rows={2}
          placeholder="Add your notes… (auto-saves)"
          defaultValue={apt.note}
          onChange={e => handleNoteChange(e.target.value)}
        />
      </div>
    </div>
  );
};
