import React, { useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Clock,
  Star,
  Download,
} from 'lucide-react';
import type { CommuteResult } from '../types';
import { SCORE_CONFIG, formatDuration } from '../utils/scoring';
import { en } from '../i18n/en';

interface Props {
  result: CommuteResult;
}

export const SummaryPanel: React.FC<Props> = ({ result }) => {
  const {
    averageBestSeconds,
    overallScore,
    shortestCommute,
    longestCommute,
    weightedScore,
    destinations,
    originAddress,
  } = result;

  const cfg = SCORE_CONFIG[overallScore];

  const exportCsv = useCallback(() => {
    const header = [
      'Destination',
      'Address',
      'Driving (min)',
      'Transit (min)',
      'Walking (min)',
      'Best (min)',
      'Score',
    ].join(',');

    const rows = destinations.map((d) => {
      const get = (mode: string) => {
        const leg = d.legs.find((l) => l.mode === mode);
        return leg?.status === 'OK'
          ? String(Math.round(leg.durationSeconds / 60))
          : 'N/A';
      };
      return [
        `"${d.destination.name}"`,
        `"${d.destination.address}"`,
        get('driving'),
        get('transit'),
        get('walking'),
        d.bestDurationSeconds < Infinity
          ? String(Math.round(d.bestDurationSeconds / 60))
          : 'N/A',
        SCORE_CONFIG[d.score].label,
      ].join(',');
    });

    const csv = [
      `# Harvard Housing Commute Explorer`,
      `# Origin: ${originAddress}`,
      '',
      header,
      ...rows,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commute-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [destinations, originAddress]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{en.summary.title}</h2>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {en.summary.exportCsv}
        </button>
      </div>

      {/* Overall score */}
      <div
        className={[
          'flex items-center justify-between rounded-xl px-4 py-3 border',
          cfg.bgColor,
          cfg.borderColor,
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5">
          <Star className={`w-4 h-4 ${cfg.textColor}`} />
          <span className={`text-sm font-semibold ${cfg.textColor}`}>
            {en.summary.overallScore}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xl font-bold ${cfg.textColor}`}>
            {weightedScore}
            <span className="text-xs font-medium opacity-70">/100</span>
          </span>
          <span
            className={[
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              cfg.textColor,
              cfg.bgColor,
              cfg.borderColor,
            ].join(' ')}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-3">
        <StatRow
          icon={<Clock className="w-4 h-4 text-gray-400" />}
          label={en.summary.averageCommute}
          value={formatDuration(averageBestSeconds)}
        />
        <StatRow
          icon={<TrendingDown className="w-4 h-4 text-emerald-500" />}
          label={en.summary.fastest}
          value={shortestCommute.destination.shortLabel}
          sub={formatDuration(shortestCommute.bestDurationSeconds)}
          accent="emerald"
        />
        <StatRow
          icon={<TrendingUp className="w-4 h-4 text-red-400" />}
          label={en.summary.slowest}
          value={longestCommute.destination.shortLabel}
          sub={formatDuration(longestCommute.bestDurationSeconds)}
          accent="red"
        />
      </div>

      {/* Destination weight breakdown */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Weight breakdown
        </p>
        {(() => {
          const totalW = destinations.reduce((s, d) => s + d.destination.weight, 0);
          return destinations.map((d) => (
            <div key={d.destination.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.destination.color }}
              />
              <span className="text-xs text-gray-600 flex-1">{d.destination.shortLabel}</span>
              <span className="text-xs text-gray-400">
                {totalW > 0 ? Math.round((d.destination.weight / totalW) * 100) : 0}%
              </span>
              <span className="text-xs font-medium text-gray-700 w-14 text-right">
                {d.bestDurationSeconds < Infinity
                  ? formatDuration(d.bestDurationSeconds)
                  : 'N/A'}
              </span>
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'red';
}

const StatRow: React.FC<StatRowProps> = ({ icon, label, value, sub, accent }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
    <span className="flex-shrink-0">{icon}</span>
    <span className="text-xs text-gray-500 flex-1">{label}</span>
    <div className="flex items-center gap-2">
      {sub && (
        <span
          className={`text-xs font-medium ${
            accent === 'emerald'
              ? 'text-emerald-600'
              : accent === 'red'
              ? 'text-red-500'
              : 'text-gray-400'
          }`}
        >
          {sub}
        </span>
      )}
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  </div>
);
