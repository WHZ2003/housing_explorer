export interface Destination {
  id: string;
  name: string;
  shortLabel: string;
  address: string;
  lat: number;
  lng: number;
  /** Raw priority value (any positive number). Scoring normalises across enabled destinations. */
  weight: number;
  color: string; // for map marker + UI accent
  /** When false the destination is hidden from results, map, and scoring. */
  enabled: boolean;
}

export type TravelMode = 'driving' | 'transit' | 'walking';

export interface CommuteLeg {
  mode: TravelMode;
  durationSeconds: number;
  durationText: string;
  distanceMeters?: number;
  distanceText?: string;
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
}

export interface DestinationCommute {
  destination: Destination;
  legs: CommuteLeg[];
  /** Best (min) of driving + transit OK legs, in seconds. */
  bestDurationSeconds: number;
  score: CommuteScore;
}

export type CommuteScore = 'excellent' | 'good' | 'acceptable' | 'far';

export interface CommuteResult {
  originAddress: string;
  originLatLng: LatLng;
  destinations: DestinationCommute[];
  averageBestSeconds: number;
  overallScore: CommuteScore;
  shortestCommute: DestinationCommute;
  longestCommute: DestinationCommute;
  /** 0–100, higher is better */
  weightedScore: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type AppStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AppError {
  type: 'geocoding' | 'routing' | 'network' | 'unknown';
  message: string;
}

// ---------------------------------------------------------------------------
// Place search
// ---------------------------------------------------------------------------

/** A single autocomplete prediction returned from the search dropdown. */
export interface PlacePrediction {
  placeId: string;
  /** Full display string, e.g. "The Sycamore, Cambridge St, Cambridge, MA" */
  description: string;
  /** Primary part of the label, usually the place name or street. */
  mainText: string;
  /** Secondary part, usually city/state. */
  secondaryText: string;
  /** Raw Google types array, used for friendly label derivation. */
  types: string[];
  /** Matched substrings for bolding the search query in results. */
  matchedSubstrings: Array<{ offset: number; length: number }>;
}

/** A confirmed place selection with resolved coordinates. */
export interface SelectedPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  latLng: LatLng;
  types: string[];
}

// ---------------------------------------------------------------------------
// Transit
// ---------------------------------------------------------------------------

export interface TransitStop {
  /** MBTA stop/station ID or Google Places place_id */
  placeId: string;
  name: string;
  location: LatLng;
  type: 'subway' | 'light_rail' | 'bus' | 'commuter_rail';
  /** Route/line names served by this stop, e.g. ["Red Line", "Green Line"] */
  lines?: string[];
  /** Hex color per line, matches index of `lines` */
  lineColors?: string[];
  /** Straight-line Haversine distance from the housing origin */
  straightLineMeters: number;
  /** Estimated walk time based on 80 m/min pace */
  estimatedWalkMinutes: number;
}

export type TransitScore = 'excellent' | 'good' | 'fair' | 'limited';

export interface TransitSummary {
  nearestSubway: TransitStop | null;
  nearestBus: TransitStop | null;
  /** All subway/light_rail stops within the search radius */
  subwayCount: number;
  /** Bus stops within the search radius */
  busCount: number;
  score: TransitScore;
}

// ---------------------------------------------------------------------------
// Map layer visibility
// ---------------------------------------------------------------------------

export interface LayerConfig {
  housing: boolean;
  destinations: boolean;
  subway: boolean;
  bus: boolean;
  walkRadius: boolean;
}

// ---------------------------------------------------------------------------
// App-wide settings (persisted to localStorage via AppContext)
// ---------------------------------------------------------------------------

export interface AppSettings {
  destinations: Destination[];
  enabledModes: TravelMode[];
}

// ---------------------------------------------------------------------------
// Batch comparison
// ---------------------------------------------------------------------------

export type BatchStatus = 'pending' | 'resolving' | 'calculating' | 'done' | 'error';

export interface BatchRow {
  id: string;
  inputText: string;
  place: SelectedPlace | null;
  error: string | null;
  destinations: DestinationCommute[];
  averageBestSeconds: number;
  weightedScore: number;
  status: BatchStatus;
}
