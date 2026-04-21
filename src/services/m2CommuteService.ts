import { M2_SHUTTLE, type M2Direction } from '../data/m2shuttle';
import { estimateM2RideMinutes } from './m2Estimate';
import type { LatLng, M2Leg } from '../types';

// Walk speed: 1.2 m/s ≈ 4.3 km/h
const WALK_MPS = 1.2;
// If the nearest M2 stop is farther than this, M2 isn't a practical option
const MAX_WALK_METERS = 1400;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function walkMin(meters: number): number {
  return meters / WALK_MPS / 60;
}

/**
 * Compute best M2-assisted commute from `origin` to `destination`.
 * Tries both route directions and returns the fastest valid option, or null
 * if M2 doesn't serve this origin/destination pair within walking distance.
 */
export function estimateM2Commute(
  origin: LatLng,
  destination: LatLng,
  departure: Date
): M2Leg | null {
  const DIRECTIONS: M2Direction[] = ['cambridge_to_boston', 'boston_to_cambridge'];
  let best: M2Leg | null = null;

  for (const dir of DIRECTIONS) {
    // Stops valid for this direction
    const stopsInDir = M2_SHUTTLE.stops.filter(
      (s) => s.directionOrder[dir] !== undefined
    );
    if (stopsInDir.length < 2) continue;

    // Nearest board stop to origin
    let boardStop = stopsInDir[0];
    let boardDist = haversineMeters(origin, { lat: boardStop.lat, lng: boardStop.lng });
    for (const s of stopsInDir.slice(1)) {
      const d = haversineMeters(origin, { lat: s.lat, lng: s.lng });
      if (d < boardDist) { boardDist = d; boardStop = s; }
    }
    if (boardDist > MAX_WALK_METERS) continue;

    const boardIdx = boardStop.directionOrder[dir]!;

    // Nearest alight stop to destination (must come AFTER board stop)
    const alightCandidates = stopsInDir.filter(
      (s) => s.directionOrder[dir]! > boardIdx
    );
    if (!alightCandidates.length) continue;

    let alightStop = alightCandidates[0];
    let alightDist = haversineMeters(destination, { lat: alightStop.lat, lng: alightStop.lng });
    for (const s of alightCandidates.slice(1)) {
      const d = haversineMeters(destination, { lat: s.lat, lng: s.lng });
      if (d < alightDist) { alightDist = d; alightStop = s; }
    }

    try {
      const rideMin = estimateM2RideMinutes(boardStop.id, alightStop.id, dir, departure);
      if (!isFinite(rideMin)) continue;

      const walkTo   = walkMin(boardDist);
      const walkFrom = walkMin(alightDist);
      const total    = walkTo + rideMin + walkFrom;

      if (!best || total * 60 < best.totalSeconds) {
        best = {
          totalSeconds:    Math.round(total * 60),
          boardStopName:   boardStop.shortLabel,
          alightStopName:  alightStop.shortLabel,
          walkToMinutes:   Math.round(walkTo),
          rideMinutes:     rideMin,
          walkFromMinutes: Math.round(walkFrom),
        };
      }
    } catch {
      // invalid stop combo for this direction — skip
    }
  }

  return best;
}
