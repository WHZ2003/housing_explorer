import React from 'react';
import { Car, Train, Footprints, Bus, ChevronRight } from 'lucide-react';
import type { DestinationCommute, TravelMode } from '../types';
import { SCORE_CONFIG, formatDuration, formatDistance } from '../utils/scoring';
import { en } from '../i18n/en';

interface Props {
  commute: DestinationCommute;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

const MODE_ICON: Record<TravelMode, React.ReactNode> = {
  driving: <Car className="w-3.5 h-3.5" />,
  transit: <Train className="w-3.5 h-3.5" />,
  walking: <Footprints className="w-3.5 h-3.5" />,
};

const MODE_LABEL: Record<TravelMode, string> = {
  driving: en.travel.driving,
  transit: en.travel.transit,
  walking: en.travel.walking,
};

export const ResultCard: React.FC<Props> = ({ commute, rank, isSelected, onSelect }) => {
  const { destination, legs, bestDurationSeconds, score, m2, harvardShuttle } = commute;
  const cfg = SCORE_CONFIG[score];

  const m2IsViable = m2 != null && m2.totalSeconds < Infinity;
  const m2IsBetter = m2IsViable && m2!.totalSeconds < bestDurationSeconds;

  const harvardIsViable = harvardShuttle != null && harvardShuttle.totalSeconds < Infinity;
  const harvardIsBetter = harvardIsViable && harvardShuttle!.totalSeconds < bestDurationSeconds &&
    (!m2IsViable || harvardShuttle!.totalSeconds < m2!.totalSeconds);

  const bestShuttleSeconds = Math.min(
    m2IsViable ? m2!.totalSeconds : Infinity,
    harvardIsViable ? harvardShuttle!.totalSeconds : Infinity,
  );
  const overallBest = Math.min(bestDurationSeconds, bestShuttleSeconds);

  return (
    <button
      onClick={onSelect}
      className={[
        'card w-full text-left p-4 transition-all duration-150 cursor-pointer',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: destination.color }}
          >
            {rank}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{destination.name}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{destination.address}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={[
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              cfg.textColor, cfg.bgColor, cfg.borderColor,
            ].join(' ')}
          >
            {cfg.label}
          </span>
          <ChevronRight
            className={[
              'w-4 h-4 transition-transform',
              isSelected ? 'rotate-90 text-blue-500' : 'text-gray-300',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Standard mode rows */}
      <div className="space-y-1.5 border-t border-gray-50 pt-3">
        {legs.map((leg) => {
          const ok = leg.status === 'OK';
          return (
            <div key={leg.mode} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500">
                <span className={ok ? 'text-gray-400' : 'text-gray-300'}>{MODE_ICON[leg.mode]}</span>
                <span className="text-xs text-gray-500">{MODE_LABEL[leg.mode]}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                {ok ? (
                  <>
                    <span className="text-sm font-semibold text-gray-800">
                      {formatDuration(leg.durationSeconds)}
                    </span>
                    {leg.distanceMeters !== undefined && (
                      <span className="text-xs text-gray-400 w-14 text-right">
                        {formatDistance(leg.distanceMeters)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-300 italic">
                    {leg.mode === 'walking' && bestDurationSeconds > 30 * 60
                      ? 'Too far to walk'
                      : en.travel.notAvailable}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* M2 shuttle row */}
        {m2IsViable && (
          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <Bus className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs text-violet-700 font-medium">M2 Shuttle</span>
              <span className="text-[10px] text-gray-400">
                walk {m2!.walkToMinutes}m → {m2!.boardStopName} → {m2!.alightStopName} → walk {m2!.walkFromMinutes}m
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {m2IsBetter && !harvardIsBetter && (
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                  Best
                </span>
              )}
              <span className="text-sm font-semibold text-violet-700">
                {formatDuration(m2!.totalSeconds)}
              </span>
            </div>
          </div>
        )}

        {/* Harvard shuttle row */}
        {harvardIsViable && (
          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <Bus className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-700 font-medium">Harvard Shuttle</span>
              <span className="text-[10px] text-gray-400">
                walk {harvardShuttle!.walkToMinutes}m → Hv Sq → SEC → walk {harvardShuttle!.walkFromMinutes}m
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {harvardIsBetter && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  Best
                </span>
              )}
              <span className="text-sm font-semibold text-emerald-700">
                {formatDuration(harvardShuttle!.totalSeconds)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Best time footer */}
      <div className="mt-3 pt-2.5 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">Best commute</span>
        <div className="flex items-center gap-1.5">
          {(m2IsBetter || harvardIsBetter) && (
            <Bus className={`w-3 h-3 ${harvardIsBetter ? 'text-emerald-600' : 'text-violet-500'}`} />
          )}
          <span className="text-sm font-bold text-gray-900">
            {formatDuration(overallBest)}
          </span>
        </div>
      </div>
    </button>
  );
};
