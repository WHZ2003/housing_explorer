import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ResultCard } from './ResultCard';
import type { AppError, AppStatus, CommuteResult, DestinationCommute } from '../types';
import { en } from '../i18n/en';

interface Props {
  status: AppStatus;
  result: CommuteResult | null;
  error: AppError | null;
  selectedDestinationId: string | null;
  onSelectDestination: (id: string | null) => void;
}

export const ResultsSection: React.FC<Props> = ({
  status,
  result,
  error,
  selectedDestinationId,
  onSelectDestination,
}) => {
  if (status === 'loading') {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="card p-4 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 bg-gray-200 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-40" />
                <div className="h-2.5 bg-gray-100 rounded w-56" />
              </div>
              <div className="h-6 w-20 bg-gray-100 rounded-full" />
            </div>
            <div className="space-y-2 pt-3 border-t border-gray-50">
              <div className="h-2.5 bg-gray-100 rounded w-full" />
              <div className="h-2.5 bg-gray-100 rounded w-5/6" />
              <div className="h-2.5 bg-gray-100 rounded w-4/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="card p-5 flex gap-3 items-start border-red-100 bg-red-50">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            {error.type === 'geocoding'
              ? en.errors.geocodingFailed
              : en.errors.routingFailed}
          </p>
          <p className="text-sm text-red-600 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (status !== 'success' || !result) return null;

  // Sort by best commute time for ranking
  const ranked: Array<{ commute: DestinationCommute; rank: number }> =
    [...result.destinations]
      .sort((a, b) => a.bestDurationSeconds - b.bestDurationSeconds)
      .map((c, i) => ({ commute: c, rank: i + 1 }));

  // Restore original order for display (preserve destination order)
  const displayed = result.destinations.map((c) => {
    const r = ranked.find((r) => r.commute.destination.id === c.destination.id)!;
    return r;
  });

  const handleSelect = (id: string) => {
    onSelectDestination(selectedDestinationId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-gray-700">
          Results — {result.originAddress}
        </h2>
        <span className="text-xs text-gray-400">Click a card to show route</span>
      </div>

      {displayed.map(({ commute, rank }) => (
        <ResultCard
          key={commute.destination.id}
          commute={commute}
          rank={rank}
          isSelected={selectedDestinationId === commute.destination.id}
          onSelect={() => handleSelect(commute.destination.id)}
        />
      ))}
    </div>
  );
};
