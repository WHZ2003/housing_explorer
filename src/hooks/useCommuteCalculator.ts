import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { calculateCommuteTimes, nextWeekday9AM } from '../services/mapsService';
import { estimateM2Commute } from '../services/m2CommuteService';
import { estimateHarvardShuttle } from '../services/harvardShuttleService';
import { calculateWeightedScore, getCommuteScore } from '../utils/scoring';
import type { DestinationCommute, SelectedPlace } from '../types';

export interface CommuteSnapshot {
  destinations: DestinationCommute[];
  averageBestSeconds: number;
  weightedScore: number;
}

/**
 * Returns a stable `computeCommutes(place)` function that uses the current
 * active destinations and enabled modes from AppContext. Callers are
 * responsible for checking that Maps API is loaded before calling.
 */
export function useCommuteCalculator() {
  const { activeDestinations, enabledModes } = useAppContext();

  const computeCommutes = useCallback(
    async (place: SelectedPlace): Promise<CommuteSnapshot> => {
      const departure = nextWeekday9AM();
      const matrix = await calculateCommuteTimes(
        place.latLng,
        activeDestinations.map(d => d.address),
        enabledModes,
      );

      const destinations: DestinationCommute[] = activeDestinations.map((dest, i) => {
        const legs = matrix[i];
        const okSecs   = legs.filter(l => l.status === 'OK').map(l => l.durationSeconds);
        const preferred = legs
          .filter(l => l.status === 'OK' && (l.mode === 'driving' || l.mode === 'transit'))
          .map(l => l.durationSeconds);
        const best = Math.min(...(preferred.length ? preferred : okSecs), Infinity);
        const destLatLng = { lat: dest.lat, lng: dest.lng };
        return {
          destination: dest,
          legs,
          bestDurationSeconds: best,
          score: getCommuteScore(best >= Infinity ? 99999 : best),
          m2: estimateM2Commute(place.latLng, destLatLng, departure) ?? null,
          harvardShuttle: estimateHarvardShuttle(place.latLng, destLatLng) ?? null,
        };
      });

      const finite = destinations.filter(d => d.bestDurationSeconds < Infinity);
      const averageBestSeconds = finite.length
        ? finite.reduce((s, d) => s + d.bestDurationSeconds, 0) / finite.length
        : 0;

      return {
        destinations,
        averageBestSeconds,
        weightedScore: calculateWeightedScore(destinations),
      };
    },
    [activeDestinations, enabledModes],
  );

  return { computeCommutes };
}
