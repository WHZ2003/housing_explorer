/**
 * Transit data using Google Places Place.searchNearby (primary) +
 * MBTA v3 API (optional enrichment for line names only).
 *
 * Why Google Places instead of MBTA API for stops?
 * - No CORS issues (already-loaded JS API, not a fetch())
 * - Reliable — works anywhere the Maps key works
 * - Covers subway, bus, and transit stations in one call
 * MBTA API is only used as an optional enrichment step to add line names
 * to the nearest subway station. If it fails, we still show all stops.
 */

import type { LatLng, TransitScore, TransitStop, TransitSummary } from '../types';
import { nearbySearchPlaces } from './mapsService';

// ---------------------------------------------------------------------------
// Config (exported so MapView and TransitPanel can reference them)
// ---------------------------------------------------------------------------

export const SUBWAY_RADIUS_METERS = 1500; // ~18-min walk
export const BUS_RADIUS_METERS    = 700;  // ~9-min walk
export const WALK_RADIUS_METERS   = 800;  // visual circle on map

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateWalkMin(meters: number): number {
  return Math.max(1, Math.ceil(meters / 80)); // 80 m/min ≈ 4.8 km/h
}

function transitAccessScore(nearestSubwayMeters: number | null): TransitScore {
  if (nearestSubwayMeters === null) return 'limited';
  if (nearestSubwayMeters < 400)   return 'excellent';
  if (nearestSubwayMeters < 800)   return 'good';
  if (nearestSubwayMeters < 1200)  return 'fair';
  return 'limited';
}

// ---------------------------------------------------------------------------
// Convert a google.maps.places.Place → TransitStop
// ---------------------------------------------------------------------------

function toTransitStop(
  place: google.maps.places.Place,
  origin: LatLng,
  type: TransitStop['type']
): TransitStop | null {
  if (!place.location || !place.displayName) return null;

  const loc: LatLng = {
    lat: place.location.lat(),
    lng: place.location.lng(),
  };
  const meters = haversineMeters(origin, loc);

  return {
    placeId: place.id ?? `gen-${Math.random().toString(36).slice(2)}`,
    name: place.displayName,
    location: loc,
    type,
    straightLineMeters: meters,
    estimatedWalkMinutes: estimateWalkMin(meters),
  };
}

// ---------------------------------------------------------------------------
// MBTA API enrichment — adds line names to the nearest subway stop
//
// IMPORTANT: MBTA filter[radius] uses DEGREES, not km.
//   1 degree ≈ 111 km  →  0.005 deg ≈ 550 m (tight match window)
// ---------------------------------------------------------------------------

interface MbtaRoute {
  id: string;
  attributes: { long_name: string; short_name: string; type: number; color: string };
}

async function enrichNearestSubwayWithLines(
  stops: TransitStop[]
): Promise<TransitStop[]> {
  if (!stops.length) return stops;

  const nearest = stops[0];
  const RADIUS_DEG = 0.005; // ≈ 550 m match window

  try {
    // 1. Find the MBTA station nearest to our Google Places stop
    const stopsUrl = new URL('https://api-v3.mbta.com/stops');
    stopsUrl.searchParams.set('filter[latitude]',      nearest.location.lat.toFixed(6));
    stopsUrl.searchParams.set('filter[longitude]',     nearest.location.lng.toFixed(6));
    stopsUrl.searchParams.set('filter[radius]',        RADIUS_DEG.toFixed(4));
    stopsUrl.searchParams.set('filter[route_type]',    '0,1');
    stopsUrl.searchParams.set('filter[location_type]', '1'); // parent stations only

    const stopsRes = await fetch(stopsUrl.toString(), {
      headers: { Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!stopsRes.ok) {
      console.warn('[Transit] MBTA stops HTTP', stopsRes.status, '— skipping line enrichment');
      return stops;
    }

    const stopsJson = await stopsRes.json();
    const mbtaStops: Array<{ id: string; attributes: { latitude: number; longitude: number; name: string } }> =
      stopsJson.data ?? [];

    if (!mbtaStops.length) {
      console.debug('[Transit] MBTA returned 0 stations within match window — no line info');
      return stops;
    }

    // Pick the MBTA station closest to our Google Places stop
    const matched = mbtaStops
      .filter(s => s.attributes.latitude && s.attributes.longitude)
      .sort((a, b) =>
        haversineMeters(nearest.location, { lat: a.attributes.latitude, lng: a.attributes.longitude }) -
        haversineMeters(nearest.location, { lat: b.attributes.latitude, lng: b.attributes.longitude })
      )[0];

    if (!matched) return stops;

    // 2. Fetch routes for that MBTA station
    const routesUrl = new URL('https://api-v3.mbta.com/routes');
    routesUrl.searchParams.set('filter[stop]', matched.id);

    const routesRes = await fetch(routesUrl.toString(), {
      headers: { Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!routesRes.ok) return stops;

    const routesJson = await routesRes.json();
    const routes: MbtaRoute[] = routesJson.data ?? [];

    // Keep only subway/light-rail routes (type 0 or 1)
    const subwayRoutes = routes.filter(r => [0, 1].includes(r.attributes.type));
    if (!subwayRoutes.length) return stops;

    const lines      = subwayRoutes.map(r => r.attributes.long_name || r.attributes.short_name);
    const lineColors = subwayRoutes.map(r => `#${r.attributes.color || '165788'}`);

    console.debug('[Transit] MBTA enriched', nearest.name, '→', lines);

    return stops.map((s, i) => (i === 0 ? { ...s, lines, lineColors } : s));
  } catch (err) {
    // Non-fatal — transit panel works without line info
    console.warn('[Transit] MBTA enrichment failed (non-fatal):', err instanceof Error ? err.message : err);
    return stops;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch nearby transit stops around a LatLng.
 *
 * Strategy:
 *   1. Place.searchNearby(['subway_station', 'light_rail_station'], 1500 m) → subway stops
 *   2. Place.searchNearby(['transit_station', 'bus_station', 'bus_stop'], 700 m) → classify remaining as bus
 *   3. MBTA API → enrich nearest subway with line names (optional, graceful fallback)
 */
export async function fetchNearbyTransit(origin: LatLng): Promise<{
  stops: TransitStop[];
  summary: TransitSummary;
}> {
  const empty = {
    stops: [],
    summary: {
      nearestSubway: null, nearestBus: null,
      subwayCount: 0, busCount: 0,
      score: 'limited' as TransitScore,
    },
  };

  // --- Step 1: parallel search for subway and general transit stops ---
  const [subwayRaw, transitRaw] = await Promise.all([
    nearbySearchPlaces(origin, SUBWAY_RADIUS_METERS, ['subway_station', 'light_rail_station']),
    nearbySearchPlaces(origin, BUS_RADIUS_METERS,    ['transit_station', 'bus_station', 'bus_stop']),
  ]);

  // --- Step 2: build subway stop list ---
  const subwayStops: TransitStop[] = subwayRaw
    .map(r => toTransitStop(r, origin, 'subway'))
    .filter((s): s is TransitStop => s !== null)
    .sort((a, b) => a.straightLineMeters - b.straightLineMeters);

  // --- Step 3: build bus stop list (exclude anything already in subway list) ---
  const subwayIds = new Set(subwayStops.map(s => s.placeId));

  const busStops: TransitStop[] = transitRaw
    .filter(r => {
      if (r.id && subwayIds.has(r.id)) return false;              // already in subway list
      const types = r.types ?? [];
      return (
        !types.includes('subway_station') &&
        !types.includes('light_rail_station') &&
        !types.includes('train_station')                           // exclude commuter rail
      );
    })
    .map(r => toTransitStop(r, origin, 'bus'))
    .filter((s): s is TransitStop => s !== null)
    .sort((a, b) => a.straightLineMeters - b.straightLineMeters)
    .slice(0, 12);

  // --- Step 4: enrich nearest subway with MBTA line names ---
  const enrichedSubway = await enrichNearestSubwayWithLines(subwayStops);

  const allStops: TransitStop[] = [...enrichedSubway, ...busStops];
  const nearestSubway = enrichedSubway[0] ?? null;
  const nearestBus    = busStops[0] ?? null;

  const summary: TransitSummary = {
    nearestSubway,
    nearestBus,
    subwayCount: enrichedSubway.length,
    busCount:    busStops.length,
    score: transitAccessScore(nearestSubway?.straightLineMeters ?? null),
  };

  console.debug('[Transit] Done →', {
    subway: enrichedSubway.length,
    bus:    busStops.length,
    score:  summary.score,
    nearestSubway: nearestSubway?.name,
    nearestBus:    nearestBus?.name,
  });

  return { stops: allStops, summary };
}
