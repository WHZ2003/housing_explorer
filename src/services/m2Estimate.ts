import { M2_SHUTTLE, M2Direction, M2Stop } from "../data/m2shuttle";

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isPeakPeriod(date: Date): boolean {
  const m = minutesOfDay(date);
  return (m >= 420 && m < 600) || (m >= 930 && m < 1110); // ~7:00-10:00, ~3:30-6:30
}

function getStopIndex(stop: M2Stop, direction: M2Direction): number {
  const idx = stop.directionOrder[direction];
  if (idx === undefined) {
    throw new Error(`Stop ${stop.id} not valid for ${direction}`);
  }
  return idx;
}

function segmentMinutes(
  direction: M2Direction,
  fromStopId: string,
  toStopId: string,
  usePeak: boolean
): number {
  const segments = M2_SHUTTLE.segments[direction];
  let total = 0;
  let collecting = false;
  let foundFrom = false;
  let foundTo = false;

  for (const seg of segments) {
    if (seg.fromStopId === fromStopId) {
      collecting = true;
      foundFrom = true;
    }

    if (collecting) {
      total += usePeak && seg.peakMinutes ? seg.peakMinutes : seg.typicalMinutes;
    }

    if (collecting && seg.toStopId === toStopId) {
      foundTo = true;
      break;
    }
  }

  if (!foundFrom || !foundTo) {
    throw new Error(`No valid M2 segment path from ${fromStopId} to ${toStopId}`);
  }

  return total;
}

export function estimateM2RideMinutes(
  originStopId: string,
  destinationStopId: string,
  direction: M2Direction,
  departure: Date
): number {
  const origin = M2_SHUTTLE.stops.find((s) => s.id === originStopId);
  const dest = M2_SHUTTLE.stops.find((s) => s.id === destinationStopId);

  if (!origin || !dest) {
    throw new Error("Unknown M2 stop");
  }

  const originIdx = getStopIndex(origin, direction);
  const destIdx = getStopIndex(dest, direction);

  if (destIdx <= originIdx) {
    return Infinity;
  }

  return Math.round(
    segmentMinutes(direction, originStopId, destinationStopId, isPeakPeriod(departure))
  );
}