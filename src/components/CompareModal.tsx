import React from 'react';
import { X, Bus, BarChart2, Heart, AlertCircle } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useAppContext } from '../context/AppContext';
import { formatDuration, SCORE_CONFIG, getCommuteScore } from '../utils/scoring';
import type { SavedApartment } from '../types';

interface Props {
  onClose: () => void;
}

export const CompareModal: React.FC<Props> = ({ onClose }) => {
  const {
    compareItems, removeFromCompare, clearCompare,
    isFavorite, addFavoriteFromSnapshot,
    favorites,
  } = useFavorites();
  const { activeDestinations } = useAppContext();

  if (!compareItems.length) return null;

  const savedCount  = compareItems.filter(a => isFavorite(a.id)).length;
  const unsavedCount = compareItems.length - savedCount;

  const handleSaveAll = () => {
    compareItems.forEach(apt => addFavoriteFromSnapshot(apt));
  };

  // Always show the latest note from favorites (live), fall back to snapshot note.
  const liveNote = (apt: SavedApartment) => favorites[apt.id]?.note ?? apt.note;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-5xl max-h-[88vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">Compare Apartments</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">{compareItems.length} / 5 selected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Bulk save to favorites */}
            {unsavedCount > 0 && (
              <button
                onClick={handleSaveAll}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Heart className="w-3 h-3" />
                Save all to Favorites
              </button>
            )}
            <button
              onClick={clearCompare}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Row-label column */}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide min-w-[130px] sticky left-0 bg-gray-50 border-r border-gray-100">
                  Attribute
                </th>
                {compareItems.map(apt => {
                  const alreadySaved = isFavorite(apt.id);
                  return (
                    <th key={apt.id} className="px-4 py-3 min-w-[175px] align-top border-r border-gray-50 last:border-r-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
                            {apt.place?.name ?? apt.inputLabel}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5 font-normal leading-tight">
                            {apt.place?.formattedAddress ?? apt.inputLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                          {/* Per-apartment save to favorites */}
                          <button
                            onClick={() => addFavoriteFromSnapshot(apt)}
                            title={alreadySaved ? 'Already in favorites' : 'Save to favorites'}
                            className={[
                              'p-0.5 rounded transition-colors',
                              alreadySaved
                                ? 'text-rose-400 cursor-default'
                                : 'text-gray-300 hover:text-rose-500',
                            ].join(' ')}
                          >
                            <Heart className={['w-3 h-3', alreadySaved ? 'fill-current' : ''].join(' ')} />
                          </button>
                          {/* Remove from compare */}
                          <button
                            onClick={() => removeFromCompare(apt.id)}
                            title="Remove from compare"
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* ── Avg commute ── */}
              <CompareRow label="Avg commute">
                {compareItems.map(apt => {
                  if (!apt.averageBestSeconds) return <NoDataCell key={apt.id} />;
                  const bestAvg = Math.min(...compareItems.filter(c => c.averageBestSeconds > 0).map(c => c.averageBestSeconds));
                  const isBest  = apt.averageBestSeconds === bestAvg;
                  return (
                    <td key={apt.id} className="px-4 py-3 text-center border-r border-gray-50 last:border-r-0">
                      <span className={['text-sm font-semibold', isBest ? 'text-emerald-700' : 'text-gray-700'].join(' ')}>
                        {formatDuration(apt.averageBestSeconds)}
                        {isBest && <span className="ml-0.5 text-[11px]"> ★</span>}
                      </span>
                    </td>
                  );
                })}
              </CompareRow>

              {/* ── Score ── */}
              <CompareRow label="Score" shaded>
                {compareItems.map(apt => {
                  if (!apt.weightedScore) return <NoDataCell key={apt.id} shaded />;
                  const bestScore = Math.max(...compareItems.filter(c => c.weightedScore > 0).map(c => c.weightedScore));
                  const cfg = SCORE_CONFIG[getCommuteScore(apt.averageBestSeconds)];
                  return (
                    <td key={apt.id} className="px-4 py-3 text-center border-r border-gray-50 last:border-r-0">
                      <span className={[
                        'inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border',
                        cfg.textColor, cfg.bgColor, cfg.borderColor,
                      ].join(' ')}>
                        {apt.weightedScore}
                        {apt.weightedScore === bestScore && <span className="text-[10px]">★</span>}
                      </span>
                    </td>
                  );
                })}
              </CompareRow>

              {/* ── Per-destination commute rows ── */}
              {activeDestinations.map((dest, di) => (
                <CompareRow key={dest.id} shaded={di % 2 === 0} label={
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dest.color }} />
                    {dest.shortLabel}
                  </span>
                }>
                  {compareItems.map(apt => {
                    if (apt.destinations.length === 0) return <NoDataCell key={apt.id} shaded={di % 2 === 0} />;

                    const dc = apt.destinations.find(d => d.destination.id === dest.id);
                    if (!dc) return <td key={apt.id} className="px-4 py-3 text-center text-gray-300 border-r border-gray-50 last:border-r-0">—</td>;

                    const secs     = dc.bestDurationSeconds;
                    const m2Secs   = dc.m2?.totalSeconds    ?? Infinity;
                    const harvSecs = dc.harvardShuttle?.totalSeconds ?? Infinity;
                    const bestSecs = Math.min(secs, m2Secs, harvSecs);
                    const m2Beats   = m2Secs   < secs && m2Secs   <= harvSecs;
                    const harvBeats = harvSecs  < secs && harvSecs  < m2Secs;
                    const allBests  = compareItems
                      .filter(c => c.destinations.length > 0)
                      .map(c => {
                        const d = c.destinations.find(dd => dd.destination.id === dest.id);
                        return Math.min(
                          d?.bestDurationSeconds ?? Infinity,
                          d?.m2?.totalSeconds    ?? Infinity,
                          d?.harvardShuttle?.totalSeconds ?? Infinity,
                        );
                      });
                    const isBest = bestSecs === Math.min(...allBests) && bestSecs < Infinity;

                    return (
                      <td key={apt.id} className="px-4 py-3 text-center border-r border-gray-50 last:border-r-0">
                        {bestSecs < Infinity ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={['text-sm', isBest ? 'font-semibold text-emerald-700' : 'font-medium text-gray-700'].join(' ')}>
                              {formatDuration(bestSecs)}{isBest && ' ★'}
                            </span>
                            {m2Beats && (
                              <span className="flex items-center gap-0.5 text-[10px] text-violet-500 font-medium">
                                <Bus className="w-2.5 h-2.5" /> M2
                              </span>
                            )}
                            {harvBeats && (
                              <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                                <Bus className="w-2.5 h-2.5" /> Harv
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </CompareRow>
              ))}

              {/* ── M2 shuttle ── */}
              <CompareRow label="M2 Shuttle">
                {compareItems.map(apt => {
                  if (apt.destinations.length === 0) return <NoDataCell key={apt.id} />;
                  const available = apt.destinations.some(d => d.m2 != null);
                  return (
                    <td key={apt.id} className="px-4 py-3 text-center border-r border-gray-50 last:border-r-0">
                      <span className={['text-xs font-medium', available ? 'text-violet-600' : 'text-gray-300'].join(' ')}>
                        {available ? '✓ Available' : '—'}
                      </span>
                    </td>
                  );
                })}
              </CompareRow>

              {/* ── Harvard shuttle ── */}
              <CompareRow label="Harvard Shuttle" shaded>
                {compareItems.map(apt => {
                  if (apt.destinations.length === 0) return <NoDataCell key={apt.id} shaded />;
                  const available = apt.destinations.some(d => d.harvardShuttle != null);
                  return (
                    <td key={apt.id} className="px-4 py-3 text-center border-r border-gray-50 last:border-r-0">
                      <span className={['text-xs font-medium', available ? 'text-emerald-600' : 'text-gray-300'].join(' ')}>
                        {available ? '✓ Available' : '—'}
                      </span>
                    </td>
                  );
                })}
              </CompareRow>

              {/* ── Notes (live from favorites) ── */}
              <CompareRow label="Notes">
                {compareItems.map(apt => {
                  const note = liveNote(apt);
                  return (
                    <td key={apt.id} className="px-4 py-3 align-top border-r border-gray-50 last:border-r-0">
                      {note
                        ? <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{note}</p>
                        : <span className="text-xs text-gray-300 italic">No notes · add on Saved page</span>}
                    </td>
                  );
                })}
              </CompareRow>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 bg-gray-50 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-400">
            ★ best in row · notes sync live from Saved page · compare list resets on page reload
          </p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const CompareRow: React.FC<{
  label: React.ReactNode;
  shaded?: boolean;
  children: React.ReactNode;
}> = ({ label, shaded, children }) => (
  <tr className={shaded ? 'bg-gray-50/60' : ''}>
    <td className={[
      'px-4 py-3 text-xs font-medium text-gray-500 sticky left-0 border-r border-gray-100',
      shaded ? 'bg-gray-50' : 'bg-white',
    ].join(' ')}>
      {label}
    </td>
    {children}
  </tr>
);

const NoDataCell: React.FC<{ shaded?: boolean }> = ({ shaded }) => (
  <td className={['px-4 py-3 text-center border-r border-gray-50 last:border-r-0', shaded ? 'bg-gray-50/60' : ''].join(' ')}>
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-500">
      <AlertCircle className="w-3 h-3" /> No data
    </span>
  </td>
);
