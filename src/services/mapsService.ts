import { Loader } from '@googlemaps/js-api-loader';
import type { CommuteLeg, LatLng, PlacePrediction, SelectedPlace, TravelMode } from '../types';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ?? '';

let loader: Loader | null = null;
let mapsLoaded = false;

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

// Isolated route renderer — MapView calls initRouteRenderer / renderRoute / clearRoute
// instead of holding a DirectionsRenderer ref directly.
let _dirRenderer: google.maps.DirectionsRenderer | null = null;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function getLoader(): Loader {
  if (!loader) {
    // 'marker' library required for AdvancedMarkerElement
    loader = new Loader({ apiKey: API_KEY, version: 'weekly', libraries: ['places', 'marker'] });
  }
  return loader;
}

export function hasApiKey(): boolean {
  return typeof API_KEY === 'string' && API_KEY.trim().length > 0 && !API_KEY.startsWith('YOUR_');
}

export async function loadMapsApi(): Promise<boolean> {
  if (!hasApiKey()) return false;
  if (mapsLoaded) return true;
  try {
    await getLoader().load();
    mapsLoaded = true;
    return true;
  } catch (err) {
    console.error('[Maps] Failed to load Google Maps API:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session tokens (billing efficiency)
// Groups autocomplete keystrokes + the subsequent getDetails into one billable session.
// ---------------------------------------------------------------------------

function getSessionToken(): google.maps.places.AutocompleteSessionToken {
  if (!sessionToken) sessionToken = new google.maps.places.AutocompleteSessionToken();
  return sessionToken;
}

function resetSessionToken() { sessionToken = null; }

// ---------------------------------------------------------------------------
// Geographic bias — Boston / Cambridge bounding box
// Covers Cambridge, Boston, Allston, Brookline, Somerville, Longwood
// ---------------------------------------------------------------------------

const BOSTON_BOUNDS_LITERAL: google.maps.LatLngBoundsLiteral = {
  south: 42.28, west: -71.22,
  north: 42.45, east:  -70.98,
};

// ---------------------------------------------------------------------------
// Place type label
// ---------------------------------------------------------------------------

export function getPlaceTypeLabel(types: string[]): string {
  if (types.some(t => ['lodging', 'extended_stay_hotel'].includes(t)))           return 'Lodging';
  if (types.some(t => ['real_estate_agency', 'moving_company'].includes(t)))    return 'Real Estate';
  if (types.some(t => ['university', 'school'].includes(t)))                     return 'University';
  if (types.some(t => ['neighborhood', 'sublocality', 'political'].includes(t))) return 'Area';
  if (types.some(t => ['transit_station', 'subway_station', 'bus_station'].includes(t))) return 'Transit';
  if (types.some(t => ['premise', 'subpremise'].includes(t)))                    return 'Building';
  if (types.some(t => ['street_address', 'route'].includes(t)))                  return 'Address';
  if (types.some(t => ['establishment'].includes(t)))                            return 'Place';
  return 'Location';
}

// ---------------------------------------------------------------------------
// Search — Stage A: AutocompleteSuggestion (replaces AutocompleteService)
// Uses bounds-based location bias, US-only, no type restriction so apartments
// / dorms / neighborhoods / university buildings are all returned.
// ---------------------------------------------------------------------------

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!mapsLoaded || query.trim().length < 2) return [];

  try {
    const { suggestions } =
      await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: getSessionToken(),
        locationBias: BOSTON_BOUNDS_LITERAL,
        includedRegionCodes: ['us'],
      });

    console.debug('[Search] AutocompleteSuggestion | query:', query, '| results:', suggestions.length);

    return suggestions
      .filter(s => s.placePrediction)
      .map(s => {
        const p = s.placePrediction!;
        const mainMatches = p.mainText?.matches ?? [];
        return {
          placeId: p.placeId,
          description: p.text.text,
          mainText: p.mainText?.text ?? '',
          secondaryText: p.secondaryText?.text ?? '',
          types: p.types ?? [],
          matchedSubstrings: mainMatches.map(m => ({
            offset: m.startOffset ?? 0,
            length: (m.endOffset ?? 0) - (m.startOffset ?? 0),
          })),
        };
      });
  } catch (err) {
    console.error('[Search] AutocompleteSuggestion error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search — Stage B: Place.searchByText fallback (replaces PlacesService.textSearch)
// Much better for vague queries, apartment names, department names.
// Triggered when autocomplete returns < 3 results.
// ---------------------------------------------------------------------------

export async function textSearchFallback(query: string): Promise<PlacePrediction[]> {
  if (!mapsLoaded || query.trim().length < 2) return [];

  const hasGeoHint = /boston|cambridge|allston|brookline|somerville|longwood|harvard|mit|\bma\b/i.test(query);
  const enrichedQuery = hasGeoHint ? query : `${query} Cambridge Boston`;

  console.debug('[Search] Place.searchByText query:', enrichedQuery);

  try {
    const { places } = await google.maps.places.Place.searchByText({
      textQuery: enrichedQuery,
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'types'],
      locationBias: BOSTON_BOUNDS_LITERAL,
      maxResultCount: 6,
      language: 'en-US',
    });

    console.debug('[Search] Place.searchByText results:', places.length);

    return places
      .filter(p => p.id && p.location)
      .map(p => ({
        placeId: p.id!,
        description: p.formattedAddress ?? p.displayName ?? '',
        mainText: p.displayName ?? '',
        secondaryText: p.formattedAddress ?? '',
        types: p.types ?? [],
        matchedSubstrings: [],
      }));
  } catch (err) {
    console.error('[Search] Place.searchByText error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search — Combined: AutocompleteSuggestion first, searchByText as fallback
// ---------------------------------------------------------------------------

/**
 * Primary search function for InputCard.
 * Tries AutocompleteSuggestion first; falls back to Place.searchByText if
 * results are sparse. Never throws — always returns an array (possibly empty).
 */
export async function searchPlacesWithFallback(query: string): Promise<PlacePrediction[]> {
  const acResults = await searchPlaces(query);

  if (acResults.length >= 3) return acResults;

  console.debug('[Search] Falling back to searchByText (autocomplete gave', acResults.length, 'results)');
  const textResults = await textSearchFallback(query);

  const seen = new Set(acResults.map(r => r.placeId));
  const merged = [
    ...acResults,
    ...textResults.filter(r => !seen.has(r.placeId)),
  ];

  console.debug('[Search] Merged results:', merged.length);
  return merged.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Place Details — Place.fetchFields (replaces PlacesService.getDetails)
// Called after the user selects a prediction from the dropdown.
// ---------------------------------------------------------------------------

export async function getPlaceDetails(placeId: string): Promise<SelectedPlace | null> {
  if (!mapsLoaded) return null;

  try {
    const place = new google.maps.places.Place({ id: placeId });
    await place.fetchFields({
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'types'],
    });

    resetSessionToken(); // always reset after place detail fetch (billing: end of session)

    if (!place.location) {
      console.warn('[Search] fetchFields returned no location for placeId:', placeId);
      return null;
    }

    return {
      placeId: place.id ?? placeId,
      name: place.displayName ?? place.formattedAddress ?? '',
      formattedAddress: place.formattedAddress ?? '',
      latLng: { lat: place.location.lat(), lng: place.location.lng() },
      types: place.types ?? [],
    };
  } catch (err) {
    console.error('[Search] fetchFields error for placeId:', placeId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Nearby place search — Place.searchNearby (replaces PlacesService.nearbySearch)
// Used by transitService; exported so it can be called from there directly.
// ---------------------------------------------------------------------------

export async function nearbySearchPlaces(
  origin: LatLng,
  radiusMeters: number,
  includedPrimaryTypes: string[]
): Promise<google.maps.places.Place[]> {
  if (!mapsLoaded) return [];

  try {
    const { places } = await google.maps.places.Place.searchNearby({
      fields: ['id', 'displayName', 'location', 'types'],
      locationRestriction: {
        center: { lat: origin.lat, lng: origin.lng },
        radius: radiusMeters,
      },
      includedPrimaryTypes,
      maxResultCount: 20,
    });

    console.debug(
      `[Transit] Place.searchNearby types=${JSON.stringify(includedPrimaryTypes)} r=${radiusMeters}m → ${places.length} results`
    );
    return places;
  } catch (err) {
    console.error('[Transit] Place.searchNearby error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Geocoding (fallback if place details unavailable)
// ---------------------------------------------------------------------------

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!mapsLoaded || !window.google) return null;
  return new Promise((resolve) => {
    new google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        resolve(null);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Departure time helper
//
// All commute calculations assume weekday 9:00 AM (morning commute).
// Returns today at 9 AM if it's a weekday and before 9 AM, otherwise
// advances to the next weekday at 9 AM.
// ---------------------------------------------------------------------------

export function nextWeekday9AM(): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(9, 0, 0, 0);

  const day = candidate.getDay(); // 0=Sun, 6=Sat
  if (day >= 1 && day <= 5 && candidate > now) return candidate;

  // Advance to next day, skip weekends
  candidate.setDate(candidate.getDate() + 1);
  while (candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate.setDate(candidate.getDate() + 1);
  }
  candidate.setHours(9, 0, 0, 0);
  return candidate;
}

// ---------------------------------------------------------------------------
// Distance Matrix
// ---------------------------------------------------------------------------

type GmElement = google.maps.DistanceMatrixResponseElement;

function elementToLeg(el: GmElement, mode: TravelMode): CommuteLeg {
  if (el.status !== 'OK') {
    return { mode, status: el.status as CommuteLeg['status'], durationSeconds: 0, durationText: 'N/A' };
  }
  return {
    mode, status: 'OK',
    durationSeconds: el.duration.value,
    durationText: el.duration.text,
    distanceMeters: el.distance?.value,
    distanceText: el.distance?.text,
  };
}

async function fetchMatrix(
  origin: LatLng | string,
  destinations: string[],
  mode: TravelMode
): Promise<google.maps.DistanceMatrixResponse> {
  return new Promise((resolve, reject) => {
    const gmMode: Record<TravelMode, google.maps.TravelMode> = {
      driving: google.maps.TravelMode.DRIVING,
      transit: google.maps.TravelMode.TRANSIT,
      walking: google.maps.TravelMode.WALKING,
    };

    const resolvedOrigin =
      typeof origin === 'string'
        ? origin
        : new google.maps.LatLng(origin.lat, origin.lng);

    new google.maps.DistanceMatrixService().getDistanceMatrix(
      {
        origins: [resolvedOrigin],
        destinations,
        travelMode: gmMode[mode],
        unitSystem: google.maps.UnitSystem.IMPERIAL,
        ...(mode === 'transit' ? { transitOptions: { departureTime: nextWeekday9AM() } } : {}),
      },
      (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK && response) {
          resolve(response);
        } else {
          reject(new Error(`DistanceMatrix [${mode}] status: ${status}`));
        }
      }
    );
  });
}

export async function calculateCommuteTimes(
  origin: LatLng | string,
  destinations: string[],
  modes: TravelMode[] = ['driving', 'transit', 'walking']
): Promise<CommuteLeg[][]> {
  const settled = await Promise.allSettled(modes.map(m => fetchMatrix(origin, destinations, m)));
  const matrix: CommuteLeg[][] = destinations.map(() => []);

  settled.forEach((result, modeIdx) => {
    const mode = modes[modeIdx];
    if (result.status === 'fulfilled') {
      const elements = result.value.rows[0]?.elements ?? [];
      elements.forEach((el, destIdx) => matrix[destIdx].push(elementToLeg(el, mode)));
    } else {
      console.warn('[Commute] DistanceMatrix failed for mode:', mode, result.reason);
      destinations.forEach((_, destIdx) =>
        matrix[destIdx].push({ mode, status: 'UNKNOWN_ERROR', durationSeconds: 0, durationText: 'N/A' })
      );
    }
  });

  return matrix;
}

// ---------------------------------------------------------------------------
// Directions (internal — consumed only by the route renderer layer below)
// ---------------------------------------------------------------------------

async function getDirections(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode
): Promise<google.maps.DirectionsResult | null> {
  if (!mapsLoaded || !window.google) return null;

  const gmMode: Record<TravelMode, google.maps.TravelMode> = {
    driving: google.maps.TravelMode.DRIVING,
    transit: google.maps.TravelMode.TRANSIT,
    walking: google.maps.TravelMode.WALKING,
  };

  return new Promise((resolve) => {
    new google.maps.DirectionsService().route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: gmMode[mode],
        ...(mode === 'transit' ? { transitOptions: { departureTime: nextWeekday9AM() } } : {}),
      },
      (result, status) => resolve(status === google.maps.DirectionsStatus.OK ? result : null)
    );
  });
}

// ---------------------------------------------------------------------------
// Route renderer service layer
//
// Isolates DirectionsRenderer behind this module so MapView never holds
// a direct reference to the legacy rendering API.  MapView calls:
//   initRouteRenderer(map)  — once, during map init
//   renderRoute(...)        — when a destination card is selected
//   clearRoute()            — when selection is cleared
// ---------------------------------------------------------------------------

export function initRouteRenderer(map: google.maps.Map): void {
  if (_dirRenderer) _dirRenderer.setMap(null);

  _dirRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#2563EB',
      strokeWeight: 4,
      strokeOpacity: 0.65,
    },
  });
  _dirRenderer.setMap(map);
}

export async function renderRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode
): Promise<void> {
  if (!_dirRenderer) return;
  const directions = await getDirections(origin, destination, mode);
  if (directions) _dirRenderer.setDirections(directions);
}

export function clearRoute(): void {
  _dirRenderer?.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
}

