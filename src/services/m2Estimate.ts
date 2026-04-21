// src/services/m2Estimate.ts

import { M2_SHUTTLE, M2Direction, M2Stop } from "../data/m2shuttle";

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getHeadway(direction: M2Direction, departure: Date): number {
  const mod = minutesOfDay(departure);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][departure.getDay()] as
    | "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

  const win = M2_SHUTTLE.headways[direction].find(
    (w) =>
      w.days.includes(day as any) &&
      mod >= w.startMinuteOfDay &&
      mod < w.endMinuteOfDay
  );

  return win?.headwayMin ?? 30;
}

function averageWaitMinutes(headwayMin: number): number {
  return headwayMin / 2;
}

function getStopIndex(stop: M2Stop, direction: M2Direction): number {
  const idx = stop.directionOrder[direction];
  if (idx === undefined) throw new Error(`Stop ${stop.id} not valid for ${direction}`);
  return idx;
}

function segmentMinutes(direction: M2Direction, fromStopId: string, toStopId: string, peak = true): number {
  const segments = M2_SHUTTLE.segments[direction];
  let total = 0;
  let collecting = false;

  for (const seg of segments) {
    if (seg.fromStopId === fromStopId) collecting = true;
    if (collecting) total += peak && seg.peakMinutes ? seg.peakMinutes : seg.typicalMinutes;
    if (seg.toStopId === toStopId && collecting) break;
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
  if (!origin || !dest) throw new Error("Unknown M2 stop");

  const originIdx = getStopIndex(origin, direction);
  const destIdx = getStopIndex(dest, direction);

  if (destIdx <= originIdx) return Infinity;

  const wait = averageWaitMinutes(getHeadway(direction, departure));
  const ride = segmentMinutes(direction, originStopId, destinationStopId, true);

  return Math.round(wait + ride);
}