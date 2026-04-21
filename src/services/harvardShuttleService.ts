import { HARVARD_SHUTTLE } from '../data/harvardShuttle';
import { haversineMeters } from './m2CommuteService';
import type { HarvardShuttleLeg, LatLng } from '../types';

const MAX_WALK_METERS = 1200;
const WALK_MPS = 1.2; // 4.3 km/h

function walkMin(meters: number): number {
  return meters / WALK_MPS / 60;
}

/**
 * Estimate Harvard Square → SEC shuttle commute.
 * Returns null if either the origin or destination is more than 1200 m
 * from the shuttle stops (not a practical option).
 *
 * No wait time is included — this is a best-case / in-vehicle model.
 */
export function estimateHarvardShuttle(
  origin: LatLng,
  destination: LatLng
): HarvardShuttleLeg | null {
  const { harvardSquare, sec } = HARVARD_SHUTTLE.stops;

  const distToBoard  = haversineMeters(origin, harvardSquare.location);
  const distFromAlight = haversineMeters(sec.location, destination);

  if (distToBoard > MAX_WALK_METERS || distFromAlight > MAX_WALK_METERS) return null;

  const walkToMinutes   = walkMin(distToBoard);
  const walkFromMinutes = walkMin(distFromAlight);
  const totalMinutes    = walkToMinutes + HARVARD_SHUTTLE.inVehicleMinutes + walkFromMinutes;

  return {
    totalSeconds:     Math.round(totalMinutes * 60),
    walkToMinutes:    Math.round(walkToMinutes),
    rideMinutes:      HARVARD_SHUTTLE.inVehicleMinutes,
    walkFromMinutes:  Math.round(walkFromMinutes),
  };
}
