import React, { useRef } from 'react';
import { Heart, Trash2, BarChart2, Bus, Clock } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useAppContext } from '../context/AppContext';
import { formatDuration, SCORE_CONFIG, getCommuteScore } from '../utils/scoring';
import type { Destination, SavedApartment } from '../types';

// ---------------------------------------------------------------------------
// FavoritesPage
// ---------------------------------------------------------------------------

export const FavoritesPage: React.FC = () => {
  const { favoritesArray } = useFavorites();
  const { activeDestinations } = useAppContext();

  if (favoritesArray.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 px-4">
        <Heart className="w-10 h-10 opacity-20" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">No saved apartments yet</p>
          <p className="text-xs mt-1 text-gray-400 max-w-xs">
            Click the heart icon on any apartment in Batch Comparison to save it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
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
        </div>

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
  const hasDone = apt.destinations.length > 0;

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
          <p className="text-[10px] text-gray-300 mt-1">
            Saved {new Date(apt.savedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Score badge */}
          {hasDone && (
            <span className={[
              'text-xs font-semibold px-2 py-0.5 rounded-full border',
              scoreCfg.textColor, scoreCfg.bgColor, scoreCfg.borderColor,
            ].join(' ')}>
              {apt.weightedScore}
            </span>
          )}

          {/* Compare toggle — disabled when no commute data */}
          {hasDone ? (
            <button
              onClick={() => inCompare ? removeFromCompare(apt.id) : addToCompare(apt)}
              title={inCompare ? 'Remove from compare' : 'Add to compare (max 5)'}
              className={[
                'p-1.5 rounded-lg border text-xs font-medium transition-all',
                inCompare
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-600',
              ].join(' ')}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              disabled
              title="Calculate commutes in Batch first"
              className="p-1.5 rounded-lg border text-xs font-medium bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Remove from favorites */}
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
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dest.color }}
                    />
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
        <p className="text-xs text-gray-400 italic">
          No commute data — saved before commutes were calculated.
        </p>
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
