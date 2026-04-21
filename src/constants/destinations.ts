import type { Destination } from '../types';

/** Geographic center of all destinations — used as default map center. */
export const MAP_CENTER = { lat: 42.3601, lng: -71.1050 };
export const MAP_DEFAULT_ZOOM = 13;

/** Colour palette cycled when users add new destinations. */
export const DESTINATION_COLORS = [
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
  '#65a30d', // lime-600
];

export const DEFAULT_DESTINATIONS: Destination[] = [
  {
    id: 'hms',
    name: 'Harvard Medical School',
    shortLabel: 'HMS',
    address: '25 Shattuck St, Boston, MA 02115',
    lat: 42.3358,
    lng: -71.1048,
    weight: 25,
    color: '#dc2626',
    enabled: true,
  },
  {
    id: 'seas',
    name: 'Harvard SEAS',
    shortLabel: 'SEAS',
    address: '29 Oxford St, Cambridge, MA 02138',
    lat: 42.3786,
    lng: -71.1163,
    weight: 25,
    color: '#7c3aed',
    enabled: true,
  },
  {
    id: 'sec',
    name: 'Harvard SEC',
    shortLabel: 'SEC',
    address: '150 Western Ave, Allston, MA 02134',
    lat: 42.3637,
    lng: -71.1315,
    weight: 25,
    color: '#059669',
    enabled: true,
  },
  {
    id: 'csail',
    name: 'MIT CSAIL',
    shortLabel: 'CSAIL',
    address: '32 Vassar St, Cambridge, MA 02139',
    lat: 42.3616,
    lng: -71.0910,
    weight: 25,
    color: '#d97706',
    enabled: true,
  },
];

/** Legacy alias kept for components that haven't migrated to context yet. */
export const DESTINATIONS = DEFAULT_DESTINATIONS;
