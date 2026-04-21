import type { LatLng } from '../types';

export interface HarvardShuttleStop {
  id: string;
  name: string;
  shortLabel: string;
  location: LatLng;
}

export const HARVARD_SHUTTLE = {
  id: 'HARV_SEC' as const,
  name: 'Harvard Square ↔ SEC Shuttle',
  operator: 'Harvard University',
  inVehicleMinutes: 10,
  stops: {
    harvardSquare: {
      id: 'harvard_square',
      name: 'Harvard Square',
      shortLabel: 'Hv Sq',
      // Harvard Square MBTA entrance / Holyoke Center area
      location: { lat: 42.3732, lng: -71.1190 } satisfies LatLng,
    } satisfies HarvardShuttleStop,
    sec: {
      id: 'harvard_sec',
      name: 'Harvard SEC',
      shortLabel: 'SEC',
      // 150 Western Ave, Allston
      location: { lat: 42.3635, lng: -71.1278 } satisfies LatLng,
    } satisfies HarvardShuttleStop,
  },
};
