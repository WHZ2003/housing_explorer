import { useState, useCallback } from 'react';
import type {
  AppError,
  AppStatus,
  CommuteResult,
  Destination,
  DestinationCommute,
  SelectedPlace,
  TravelMode,
} from '../types';
import { calculateCommuteTimes, nextWeekday9AM } from '../services/mapsService';
import { estimateM2Commute } from '../services/m2CommuteService';
import { estimateHarvardShuttle } from '../services/harvardShuttleService';
import { calculateWeightedScore, getCommuteScore } from '../utils/scoring';

export function useCommuteData(
  destinations: Destination[],
  enabledModes: TravelMode[]
) {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [result, setResult] = useState<CommuteResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const calculate = useCallback(
    async (place: SelectedPlace) => {
      setStatus('loading');
      setError(null);
      setResult(null);

      const activeDests = destinations.filter(d => d.enabled);
      if (!activeDests.length) {
        setError({ type: 'unknown', message: 'No destinations are enabled. Enable at least one in Settings.' });
        setStatus('error');
        return;
      }

      try {
        const departure = nextWeekday9AM();
        const destAddresses = activeDests.map(d => d.address);
        const matrix = await calculateCommuteTimes(place.latLng, destAddresses, enabledModes);

        const destinationCommutes: DestinationCommute[] = activeDests.map((dest, i) => {
          const legs = matrix[i];

          const okSeconds = legs.filter(l => l.status === 'OK').map(l => l.durationSeconds);
          const preferredSeconds = legs
            .filter(l => l.status === 'OK' && (l.mode === 'driving' || l.mode === 'transit'))
            .map(l => l.durationSeconds);
          const candidates = preferredSeconds.length > 0 ? preferredSeconds : okSeconds;
          const best = candidates.length > 0 ? Math.min(...candidates) : Infinity;

          // Shuttle options (synchronous, no API call)
          const destLatLng = { lat: dest.lat, lng: dest.lng };
          const m2 = estimateM2Commute(place.latLng, destLatLng, departure);
          const harvardShuttle = estimateHarvardShuttle(place.latLng, destLatLng);

          return {
            destination: dest,
            legs,
            bestDurationSeconds: best,
            score: getCommuteScore(best === Infinity ? 99999 : best),
            m2: m2 ?? null,
            harvardShuttle: harvardShuttle ?? null,
          };
        });

        const finite = destinationCommutes.filter(d => d.bestDurationSeconds < Infinity);
        const avg = finite.reduce((s, d) => s + d.bestDurationSeconds, 0) / (finite.length || 1);

        const sorted = [...destinationCommutes].sort(
          (a, b) => a.bestDurationSeconds - b.bestDurationSeconds
        );

        setResult({
          originAddress: place.formattedAddress,
          originLatLng: place.latLng,
          destinations: destinationCommutes,
          averageBestSeconds: avg,
          overallScore: getCommuteScore(avg),
          shortestCommute: sorted[0],
          longestCommute: sorted[sorted.length - 1],
          weightedScore: calculateWeightedScore(destinationCommutes),
        });
        setStatus('success');
      } catch (err) {
        console.error('[Commute] Calculation failed:', err);
        setError({
          type: 'routing',
          message: 'Failed to retrieve commute times. The routing service may be temporarily unavailable.',
        });
        setStatus('error');
      }
    },
    [destinations, enabledModes]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, calculate, reset };
}
