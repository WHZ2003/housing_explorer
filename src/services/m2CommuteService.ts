import { M2_SHUTTLE, type M2Direction } from "../data/m2shuttle";
import { estimateM2RideMinutes } from "./m2Estimate";
import type { LatLng, M2Leg } from "../types";

// Walk speed: 1.2 m/s ≈ 4.3 km/h
const WALK_MPS = 1.2;
// If a stop is farther than this from origin/destination, don't consider it
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
 * Does NOT include waiting time.
 * Tries all valid board/alight combinations and returns the fastest valid option.
 */
export function estimateM2Commute(
  origin: LatLng,
  destination: LatLng,
  departure: Date
): M2Leg | null {
  const DIRECTIONS: M2Direction[] = ["cambridge_to_boston", "boston_to_cambridge"];
  let best: M2Leg | null = null;

  for (const dir of DIRECTIONS) {
    const stopsInDir = M2_SHUTTLE.stops
      .filter((s) => s.directionOrder[dir] !== undefined)
      .sort((a, b) => a.directionOrder[dir]! - b.directionOrder[dir]!);

    if (stopsInDir.length < 2) continue;

    for (const boardStop of stopsInDir) {
      const boardDist = haversineMeters(origin, {
        lat: boardStop.lat,
        lng: boardStop.lng,
      });

      if (boardDist > MAX_WALK_METERS) continue;

      const boardIdx = boardStop.directionOrder[dir]!;

      for (const alightStop of stopsInDir) {
        const alightIdx = alightStop.directionOrder[dir]!;
        if (alightIdx <= boardIdx) continue;

        const alightDist = haversineMeters(destination, {
          lat: alightStop.lat,
          lng: alightStop.lng,
        });

        if (alightDist > MAX_WALK_METERS) continue;

        try {
          const rideMinutes = estimateM2RideMinutes(
            boardStop.id,
            alightStop.id,
            dir,
            departure
          );

          if (!isFinite(rideMinutes)) continue;

          const walkToMinutes = walkMin(boardDist);
          const walkFromMinutes = walkMin(alightDist);
          const totalMinutes = walkToMinutes + rideMinutes + walkFromMinutes;

          if (!best || totalMinutes * 60 < best.totalSeconds) {
            best = {
              totalSeconds: Math.round(totalMinutes * 60),
              boardStopName: boardStop.shortLabel,
              alightStopName: alightStop.shortLabel,
              walkToMinutes: Math.round(walkToMinutes),
              rideMinutes,
              walkFromMinutes: Math.round(walkFromMinutes),
            };
          }
        } catch {
          continue;
        }
      }
    }
  }

  return best;
}