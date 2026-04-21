import type { CommuteScore, DestinationCommute } from '../types';

/** Thresholds in seconds for commute quality labels. */
const THRESHOLDS = {
  excellent: 20 * 60, // < 20 min
  good:      35 * 60, // 20–35 min
  acceptable: 50 * 60, // 35–50 min
  // > 50 min → 'far'
} as const;

export function getCommuteScore(seconds: number): CommuteScore {
  if (seconds < THRESHOLDS.excellent) return 'excellent';
  if (seconds < THRESHOLDS.good)      return 'good';
  if (seconds < THRESHOLDS.acceptable) return 'acceptable';
  return 'far';
}

export type ScoreConfig = {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
};

export const SCORE_CONFIG: Record<CommuteScore, ScoreConfig> = {
  excellent: {
    label:       'Excellent',
    textColor:   'text-emerald-700',
    bgColor:     'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor:    'bg-emerald-500',
  },
  good: {
    label:       'Good',
    textColor:   'text-blue-700',
    bgColor:     'bg-blue-50',
    borderColor: 'border-blue-200',
    dotColor:    'bg-blue-500',
  },
  acceptable: {
    label:       'Acceptable',
    textColor:   'text-amber-700',
    bgColor:     'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor:    'bg-amber-500',
  },
  far: {
    label:       'Far',
    textColor:   'text-red-700',
    bgColor:     'bg-red-50',
    borderColor: 'border-red-200',
    dotColor:    'bg-red-500',
  },
};

/**
 * Weighted score: 0 (worst) → 100 (best).
 * Weights are raw numbers (any positive value) and are normalised here.
 * 0 min → 100 pts, 60 min → 0 pts (linear clamp).
 */
export function calculateWeightedScore(destinations: DestinationCommute[]): number {
  const active = destinations.filter(d => d.bestDurationSeconds < Infinity);
  const totalWeight = active.reduce((s, d) => s + d.destination.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSeconds = active.reduce(
    (s, d) => s + d.bestDurationSeconds * d.destination.weight,
    0
  );
  const avgSeconds = weightedSeconds / totalWeight;

  const score = Math.max(0, Math.min(100, 100 - (avgSeconds / 3600) * 100));
  return Math.round(score);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}
