import React, { useCallback, useState } from 'react';
import {
  LayoutList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  searchPlacesWithFallback,
  getPlaceDetails,
  calculateCommuteTimes,
} from '../services/mapsService';
import { calculateWeightedScore, getCommuteScore, formatDuration, SCORE_CONFIG } from '../utils/scoring';
import type { BatchRow, DestinationCommute } from '../types';

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortField =
  | 'score'
  | 'average'
  | `dest:${string}`;

interface SortConfig { field: SortField; dir: 'asc' | 'desc' }

function sortRows(rows: BatchRow[], config: SortConfig): BatchRow[] {
  const done = rows.filter(r => r.status === 'done');
  const rest = rows.filter(r => r.status !== 'done');

  const sorted = [...done].sort((a, b) => {
    let va = 0, vb = 0;

    if (config.field === 'score') {
      va = a.weightedScore;
      vb = b.weightedScore;
    } else if (config.field === 'average') {
      va = a.averageBestSeconds;
      vb = b.averageBestSeconds;
    } else if (config.field.startsWith('dest:')) {
      const destId = config.field.slice(5);
      va = a.destinations.find(d => d.destination.id === destId)?.bestDurationSeconds ?? Infinity;
      vb = b.destinations.find(d => d.destination.id === destId)?.bestDurationSeconds ?? Infinity;
    }

    return config.dir === 'asc' ? va - vb : vb - va;
  });

  return [...sorted, ...rest];
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCsv(rows: BatchRow[], destIds: string[], destNames: string[]) {
  const header = ['Apartment', 'Resolved address', ...destNames, 'Avg best (min)', 'Score (0-100)'];
  const lines = rows
    .filter(r => r.status === 'done' && r.place)
    .map(r => {
      const destCols = destIds.map(id => {
        const dc = r.destinations.find(d => d.destination.id === id);
        return dc ? Math.round(dc.bestDurationSeconds / 60).toString() : '';
      });
      return [
        `"${r.inputText}"`,
        `"${r.place!.formattedAddress}"`,
        ...destCols,
        Math.round(r.averageBestSeconds / 60).toString(),
        r.weightedScore.toString(),
      ].join(',');
    });

  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'housing-comparison.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// SortIcon helper
// ---------------------------------------------------------------------------

const SortIcon: React.FC<{ field: SortField; current: SortConfig }> = ({ field, current }) => {
  if (current.field !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
  return current.dir === 'desc'
    ? <ArrowDown className="w-3 h-3 text-blue-500" />
    : <ArrowUp className="w-3 h-3 text-blue-500" />;
};

// ---------------------------------------------------------------------------
// Row status icon
// ---------------------------------------------------------------------------

const StatusIcon: React.FC<{ status: BatchRow['status'] }> = ({ status }) => {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />;
};

// ---------------------------------------------------------------------------
// Best cell highlight
// ---------------------------------------------------------------------------

function bestForColumn(rows: BatchRow[], field: SortField): number {
  const vals = rows
    .filter(r => r.status === 'done')
    .map(r => {
      if (field === 'score') return r.weightedScore;
      if (field === 'average') return r.averageBestSeconds;
      if (field.startsWith('dest:')) {
        const id = field.slice(5);
        return r.destinations.find(d => d.destination.id === id)?.bestDurationSeconds ?? Infinity;
      }
      return Infinity;
    });
  if (!vals.length) return -Infinity;
  return field === 'score' ? Math.max(...vals) : Math.min(...vals);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const BatchPage: React.FC = () => {
  const { activeDestinations, enabledModes } = useAppContext();

  const [input, setInput] = useState('');
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'score', dir: 'desc' });
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // ---------------------------------------------------------------------------
  // Processing
  // ---------------------------------------------------------------------------

  const processLine = useCallback(
    async (text: string, id: string): Promise<BatchRow> => {
      // Stage 1: resolve place
      let base: BatchRow = {
        id,
        inputText: text,
        place: null,
        error: null,
        destinations: [],
        averageBestSeconds: 0,
        weightedScore: 0,
        status: 'resolving',
      };

      try {
        const preds = await searchPlacesWithFallback(text);
        if (!preds.length) {
          return { ...base, error: 'No matching place found', status: 'error' };
        }
        const place = await getPlaceDetails(preds[0].placeId);
        if (!place) {
          return { ...base, error: 'Could not resolve place details', status: 'error' };
        }
        base = { ...base, place, status: 'calculating' };
      } catch (err) {
        return { ...base, error: 'Search failed', status: 'error' };
      }

      // Stage 2: commute calculation
      try {
        const destAddresses = activeDestinations.map(d => d.address);
        const matrix = await calculateCommuteTimes(base.place!.latLng, destAddresses, enabledModes);

        const destCommutes: DestinationCommute[] = activeDestinations.map((dest, i) => {
          const legs = matrix[i];
          const ok = legs.filter(l => l.status === 'OK').map(l => l.durationSeconds);
          const preferred = legs
            .filter(l => l.status === 'OK' && (l.mode === 'driving' || l.mode === 'transit'))
            .map(l => l.durationSeconds);
          const best = (preferred.length ? preferred : ok).reduce(
            (mn, v) => Math.min(mn, v),
            Infinity
          );
          return {
            destination: dest,
            legs,
            bestDurationSeconds: best,
            score: getCommuteScore(best === Infinity ? 99999 : best),
          };
        });

        const finite = destCommutes.filter(d => d.bestDurationSeconds < Infinity);
        const avg = finite.length
          ? finite.reduce((s, d) => s + d.bestDurationSeconds, 0) / finite.length
          : 0;

        return {
          ...base,
          destinations: destCommutes,
          averageBestSeconds: avg,
          weightedScore: calculateWeightedScore(destCommutes),
          status: 'done',
        };
      } catch {
        return { ...base, error: 'Commute calculation failed', status: 'error' };
      }
    },
    [activeDestinations, enabledModes]
  );

  const handleRun = useCallback(async () => {
    const lines = input
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) return;
    if (!activeDestinations.length) return;

    setRunning(true);
    setProgress({ done: 0, total: lines.length });

    // Initialise rows as pending
    const initial: BatchRow[] = lines.map((text, i) => ({
      id: `row-${i}-${Date.now()}`,
      inputText: text,
      place: null,
      error: null,
      destinations: [],
      averageBestSeconds: 0,
      weightedScore: 0,
      status: 'pending',
    }));
    setRows(initial);

    // Process 3 at a time
    const CONCURRENCY = 3;
    const results: BatchRow[] = [...initial];

    for (let i = 0; i < lines.length; i += CONCURRENCY) {
      const batch = lines.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((text, j) => processLine(text, initial[i + j].id))
      );
      batchResults.forEach((r, j) => {
        results[i + j] = r;
      });
      setRows([...results]);
      setProgress(p => ({ ...p, done: Math.min(p.total, i + CONCURRENCY) }));
    }

    setRunning(false);
  }, [input, activeDestinations, enabledModes, processLine]);

  // ---------------------------------------------------------------------------
  // Sort toggle
  // ---------------------------------------------------------------------------

  const toggleSort = (field: SortField) => {
    setSortConfig(c =>
      c.field === field
        ? { field, dir: c.dir === 'desc' ? 'asc' : 'desc' }
        : { field, dir: field === 'score' ? 'desc' : 'asc' }
    );
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const doneRows = rows.filter(r => r.status === 'done');
  const errorRows = rows.filter(r => r.status === 'error');
  const displayRows = sortRows(rows, sortConfig);

  const bestScore = bestForColumn(rows, 'score');
  const bestAvg   = bestForColumn(rows, 'average');
  const bestPerDest: Record<string, number> = {};
  activeDestinations.forEach(d => {
    bestPerDest[d.id] = bestForColumn(rows, `dest:${d.id}`);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-4 sm:px-6 py-8 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <LayoutList className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Batch Comparison</h1>
        </div>
        <p className="text-sm text-gray-500">
          Paste a list of apartment names or addresses — one per line. The app resolves each
          location and computes commute times to all enabled destinations.
        </p>
      </div>

      {/* No destinations warning */}
      {activeDestinations.length === 0 && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            No destinations are enabled. Enable at least one in Settings before running a batch.
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Apartment list (one per line)
          </label>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            9 AM weekday commute
          </span>
        </div>
        <textarea
          className="w-full h-36 text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none
                     placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white"
          placeholder={"Peabody Terrace, Cambridge\n10 Akron St, Somerville\nThe Lofts at Harvard Square\n123 Main St, Allston, MA"}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={running}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {input.split('\n').filter(l => l.trim()).length} apartments ·{' '}
            {activeDestinations.length} destination{activeDestinations.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleRun}
            disabled={running || !input.trim() || !activeDestinations.length}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress.done} / {progress.total}
              </>
            ) : (
              <>
                <LayoutList className="w-4 h-4" />
                Resolve &amp; Compare
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {doneRows.length} resolved
              </span>
              {errorRows.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  {errorRows.length} failed
                </span>
              )}
            </div>
            {doneRows.length > 0 && (
              <button
                onClick={() =>
                  exportCsv(
                    rows,
                    activeDestinations.map(d => d.id),
                    activeDestinations.map(d => d.shortLabel)
                  )
                }
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 min-w-[180px]">
                    Apartment
                  </th>
                  {activeDestinations.map(d => (
                    <th
                      key={d.id}
                      className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap"
                      onClick={() => toggleSort(`dest:${d.id}`)}
                    >
                      <div className="flex items-center gap-1 justify-center">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.shortLabel}
                        <SortIcon field={`dest:${d.id}`} current={sortConfig} />
                      </div>
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap"
                    onClick={() => toggleSort('average')}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      Avg
                      <SortIcon field="average" current={sortConfig} />
                    </div>
                  </th>
                  <th
                    className="px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap"
                    onClick={() => toggleSort('score')}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      Score
                      <SortIcon field="score" current={sortConfig} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRows.map(row => {
                  const isDone = row.status === 'done';
                  const isError = row.status === 'error';
                  const scoreConfig = isDone ? SCORE_CONFIG[getCommuteScore(row.averageBestSeconds)] : null;

                  return (
                    <tr
                      key={row.id}
                      className={[
                        'transition-colors',
                        isDone ? 'hover:bg-gray-50' : '',
                        isError ? 'bg-red-50/40' : '',
                      ].join(' ')}
                    >
                      {/* Apartment cell */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={row.status} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">
                              {row.inputText}
                            </p>
                            {isDone && row.place && (
                              <p className="text-xs text-gray-400 truncate">
                                {row.place.formattedAddress}
                              </p>
                            )}
                            {isError && (
                              <p className="text-xs text-red-500">{row.error}</p>
                            )}
                            {!isDone && !isError && (
                              <p className="text-xs text-gray-400">
                                {row.status === 'resolving' ? 'Looking up…' : 'Calculating…'}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Per-destination commute cells */}
                      {activeDestinations.map(dest => {
                        if (!isDone) {
                          return (
                            <td key={dest.id} className="px-3 py-3 text-center text-gray-200">
                              —
                            </td>
                          );
                        }
                        const dc = row.destinations.find(d => d.destination.id === dest.id);
                        const secs = dc?.bestDurationSeconds ?? Infinity;
                        const isBest = secs === bestPerDest[dest.id];
                        return (
                          <td
                            key={dest.id}
                            className={[
                              'px-3 py-3 text-center text-sm font-medium',
                              isBest ? 'text-emerald-700 font-semibold' : 'text-gray-700',
                            ].join(' ')}
                          >
                            {secs < Infinity ? formatDuration(secs) : '—'}
                            {isBest && (
                              <span className="ml-1 text-[10px] text-emerald-600">★</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Avg cell */}
                      <td
                        className={[
                          'px-3 py-3 text-center text-sm',
                          isDone && row.averageBestSeconds === bestAvg
                            ? 'font-semibold text-emerald-700'
                            : 'text-gray-600',
                        ].join(' ')}
                      >
                        {isDone ? formatDuration(row.averageBestSeconds) : '—'}
                      </td>

                      {/* Score cell */}
                      <td className="px-3 py-3 text-center">
                        {isDone && scoreConfig ? (
                          <span
                            className={[
                              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
                              scoreConfig.textColor,
                              scoreConfig.bgColor,
                              scoreConfig.borderColor,
                            ].join(' ')}
                          >
                            {row.weightedScore}
                            {row.weightedScore === bestScore && (
                              <span className="text-[10px]">★</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Unresolved section */}
          {errorRows.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs font-semibold text-red-700 mb-1">
                {errorRows.length} address{errorRows.length > 1 ? 'es' : ''} could not be resolved
              </p>
              <ul className="space-y-0.5">
                {errorRows.map(r => (
                  <li key={r.id} className="text-xs text-red-600">
                    &quot;{r.inputText}&quot; — {r.error}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-500 mt-2">
                Try adding more context, e.g. "Peabody Terrace Cambridge" or a full address.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
