import React from 'react';
import { Train, Bus, Footprints, MapPin, Loader2 } from 'lucide-react';
import type { TransitScore, TransitStop, TransitSummary } from '../types';
import { SUBWAY_RADIUS_METERS, BUS_RADIUS_METERS } from '../services/transitService';

const SUBWAY_RADIUS_KM = (SUBWAY_RADIUS_METERS / 1000).toFixed(1);
const BUS_RADIUS_KM    = (BUS_RADIUS_METERS    / 1000).toFixed(1);

interface Props {
  summary: TransitSummary | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Score badge config
// ---------------------------------------------------------------------------

const SCORE_CFG: Record<
  TransitScore,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  excellent: {
    label:  'Excellent Transit',
    text:   'text-emerald-700',
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    dot:    'bg-emerald-500',
  },
  good: {
    label:  'Good Transit',
    text:   'text-blue-700',
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    dot:    'bg-blue-500',
  },
  fair: {
    label:  'Fair Transit',
    text:   'text-amber-700',
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    dot:    'bg-amber-500',
  },
  limited: {
    label:  'Limited Transit',
    text:   'text-red-700',
    bg:     'bg-red-50',
    border: 'border-red-200',
    dot:    'bg-red-400',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const LinePills: React.FC<{ stop: TransitStop }> = ({ stop }) => {
  if (!stop.lines?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {stop.lines.map((line, i) => (
        <span
          key={line}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: stop.lineColors?.[i] ?? '#165788' }}
        >
          {line}
        </span>
      ))}
    </div>
  );
};

const WalkBadge: React.FC<{ stop: TransitStop }> = ({ stop }) => (
  <div className="flex flex-col items-end flex-shrink-0">
    <span className="text-sm font-bold text-gray-800">
      ~{stop.estimatedWalkMinutes} min
    </span>
    <span className="text-[11px] text-gray-400">
      {stop.straightLineMeters < 1000
        ? `${Math.round(stop.straightLineMeters)} m`
        : `${(stop.straightLineMeters / 1000).toFixed(1)} km`}
    </span>
  </div>
);

const StopRow: React.FC<{
  stop: TransitStop;
  icon: React.ReactNode;
  iconBg: string;
}> = ({ stop, icon, iconBg }) => (
  <div className="flex items-start gap-3">
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 leading-snug">{stop.name}</p>
      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
        <Footprints className="w-3 h-3" />
        ~{stop.estimatedWalkMinutes} min walk ·{' '}
        {stop.straightLineMeters < 1000
          ? `${Math.round(stop.straightLineMeters)} m away`
          : `${(stop.straightLineMeters / 1000).toFixed(2)} km away`}
      </p>
      <LinePills stop={stop} />
    </div>
    <WalkBadge stop={stop} />
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="card p-5 space-y-4 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="h-4 bg-gray-200 rounded w-32" />
      <div className="h-6 bg-gray-100 rounded-full w-24" />
    </div>
    {[0, 1].map((i) => (
      <div key={i} className="flex items-start gap-3 pt-3 border-t border-gray-100">
        <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-40" />
          <div className="h-2.5 bg-gray-100 rounded w-28" />
          <div className="h-5 bg-gray-100 rounded-full w-20" />
        </div>
        <div className="space-y-1">
          <div className="h-4 bg-gray-200 rounded w-12" />
          <div className="h-3 bg-gray-100 rounded w-10" />
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const TransitPanel: React.FC<Props> = ({ summary, isLoading }) => {
  if (isLoading) return <LoadingSkeleton />;
  if (!summary) return null;

  const { nearestSubway, nearestBus, subwayCount, busCount, score } = summary;
  const cfg = SCORE_CFG[score];

  const hasAnyData = nearestSubway || nearestBus || subwayCount > 0 || busCount > 0;

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Train className="w-4 h-4 text-gray-400" />
          Transit Access
        </h2>
        <span
          className={[
            'text-xs font-semibold px-2.5 py-1 rounded-full border',
            cfg.text,
            cfg.bg,
            cfg.border,
          ].join(' ')}
        >
          {cfg.label}
        </span>
      </div>

      {!hasAnyData ? (
        <div className="py-4 text-center space-y-1">
          <MapPin className="w-6 h-6 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">No MBTA stops found nearby</p>
          <p className="text-xs text-gray-400">
            Searched within {SUBWAY_RADIUS_KM} km for subway,{' '}
            {BUS_RADIUS_KM} km for bus
          </p>
        </div>
      ) : (
        <>
          {/* Nearest subway */}
          {nearestSubway ? (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                Nearest Subway / Metro
              </p>
              <StopRow
                stop={nearestSubway}
                iconBg="bg-[#e8f0f8]"
                icon={<Train className="w-4 h-4 text-[#165788]" />}
              />
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Nearest Subway / Metro
              </p>
              <p className="text-sm text-gray-400 italic">
                No subway stations within {SUBWAY_RADIUS_KM} km
              </p>
            </div>
          )}

          {/* Nearest bus */}
          {nearestBus ? (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                Nearest Bus Stop
              </p>
              <StopRow
                stop={nearestBus}
                iconBg="bg-emerald-50"
                icon={<Bus className="w-4 h-4 text-emerald-700" />}
              />
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Nearest Bus Stop
              </p>
              <p className="text-sm text-gray-400 italic">
                No bus stops within {BUS_RADIUS_KM} km
              </p>
            </div>
          )}

          {/* Coverage summary */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Coverage within walk radius
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CountBadge
                icon={<Train className="w-3.5 h-3.5 text-[#165788]" />}
                count={subwayCount}
                label="subway stations"
                radiusLabel={`${SUBWAY_RADIUS_KM} km`}
                color="bg-[#e8f0f8] text-[#165788]"
              />
              <CountBadge
                icon={<Bus className="w-3.5 h-3.5 text-emerald-700" />}
                count={busCount}
                label="bus stops"
                radiusLabel={`${BUS_RADIUS_KM} km`}
                color="bg-emerald-50 text-emerald-700"
              />
            </div>
          </div>

          {/* MBTA access interpretation */}
          <AccessNote score={score} nearestSubway={nearestSubway} />
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const CountBadge: React.FC<{
  icon: React.ReactNode;
  count: number;
  label: string;
  radiusLabel: string;
  color: string;
}> = ({ icon, count, label, radiusLabel, color }) => (
  <div className={`rounded-xl px-3 py-2.5 ${color} flex flex-col gap-0.5`}>
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-lg font-bold leading-none">{count}</span>
    </div>
    <p className="text-[11px] font-medium leading-tight">{label}</p>
    <p className="text-[10px] opacity-70">within {radiusLabel}</p>
  </div>
);

const ACCESS_NOTES: Record<TransitScore, string> = {
  excellent:
    'Strong MBTA access — subway is very close. Transit commuting will be easy.',
  good:
    'Good MBTA access — subway is within comfortable walking distance.',
  fair:
    'Moderate MBTA access — subway requires a longer walk. Consider bus connections.',
  limited:
    'Limited subway access from this location. Transit commutes may be less convenient.',
};

const AccessNote: React.FC<{
  score: TransitScore;
  nearestSubway: TransitStop | null;
}> = ({ score, nearestSubway }) => {
  const cfg = SCORE_CFG[score];
  if (!nearestSubway && score === 'limited') return null; // covered by empty state

  return (
    <div
      className={`rounded-xl p-3 border text-xs leading-relaxed ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className="flex gap-1.5 items-start">
        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {ACCESS_NOTES[score]}
      </span>
    </div>
  );
};
