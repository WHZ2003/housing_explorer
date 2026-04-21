import React, { useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from '../constants/destinations';
import type {
  CommuteResult,
  Destination,
  LayerConfig,
  LatLng,
  SelectedPlace,
  TransitStop,
} from '../types';
import { initRouteRenderer, renderRoute, clearRoute } from '../services/mapsService';
import { WALK_RADIUS_METERS } from '../services/transitService';
import { en } from '../i18n/en';

interface Props {
  mapsLoaded: boolean;
  destinations: Destination[];
  result: CommuteResult | null;
  selectedPlace: SelectedPlace | null;
  selectedDestinationId: string | null;
  transitStops: TransitStop[];
  layers: LayerConfig;
  onLayersChange: (l: LayerConfig) => void;
}

// ---------------------------------------------------------------------------
// Layer toggle config
// ---------------------------------------------------------------------------

type LayerKey = keyof LayerConfig;

const LAYER_DEFS: Array<{ key: LayerKey; label: string; dotColor: string }> = [
  { key: 'housing',      label: 'Housing',       dotColor: '#2563EB' },
  { key: 'destinations', label: 'Destinations',   dotColor: '#6b7280' },
  { key: 'subway',       label: 'Subway (T)',      dotColor: '#165788' },
  { key: 'bus',          label: 'Bus',            dotColor: '#059669' },
  { key: 'walkRadius',   label: 'Walk area',      dotColor: '#3b82f6' },
];

// ---------------------------------------------------------------------------
// SVG marker string generators
// ---------------------------------------------------------------------------

function originMarkerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <path d="M20 0C9.954 0 2 7.954 2 18c0 14 18 30 18 30S38 32 38 18C38 7.954 30.046 0 20 0z"
          fill="#2563EB" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="18" r="9" fill="white"/>
    <circle cx="20" cy="18" r="5" fill="#2563EB"/>
  </svg>`;
}

function destinationMarkerSvg(label: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
    <path d="M22 0C10.402 0 1 9.402 1 21c0 15.866 21 31 21 31S43 36.866 43 21C43 9.402 33.598 0 22 0z"
          fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="22" cy="21" r="14" fill="white"/>
    <text x="22" y="26" font-family="Inter,system-ui,sans-serif" font-size="10"
          font-weight="700" text-anchor="middle" fill="${color}">${label}</text>
  </svg>`;
}

function subwayMarkerSvg(): string {
  // MBTA-style "T" roundel — dark navy
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="#165788" stroke="white" stroke-width="2"/>
    <text x="14" y="19.5" font-family="Georgia,serif" font-size="14" font-weight="700"
          text-anchor="middle" fill="white">T</text>
  </svg>`;
}

function busMarkerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="10" fill="#059669" stroke="white" stroke-width="1.5"/>
    <text x="11" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="9"
          font-weight="700" text-anchor="middle" fill="white">B</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Marker content helpers for AdvancedMarkerElement
//
// Pin markers (origin, destinations) use default bottom-center anchor so the
// pointer tip sits on the coordinate — no transform needed.
//
// Circle markers (subway, bus) need the center to sit on the coordinate, so
// we shift the wrapper down by 50% of the element height via translateY(50%).
// ---------------------------------------------------------------------------

function createPinContent(svgString: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = svgString;
  return div;
}

function createCircleContent(svgString: string): HTMLElement {
  const div = document.createElement('div');
  div.style.transform = 'translateY(50%)';
  div.innerHTML = svgString;
  return div;
}

// ---------------------------------------------------------------------------
// InfoWindow content builders
// ---------------------------------------------------------------------------

function destInfoContent(dest: Destination): string {
  return `<div style="font-family:Inter,system-ui,sans-serif;padding:12px 16px;min-width:200px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${dest.color};flex-shrink:0;"></div>
      <p style="font-weight:600;color:#111827;font-size:14px;margin:0;">${dest.name}</p>
    </div>
    <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.5;">${dest.address}</p>
  </div>`;
}

function transitInfoContent(stop: TransitStop): string {
  const isSubway = stop.type === 'subway' || stop.type === 'light_rail';
  const icon = isSubway ? '🚇' : '🚌';
  const linesHtml = stop.lines?.length
    ? stop.lines
        .map(
          (l, i) =>
            `<span style="display:inline-block;padding:2px 8px;border-radius:999px;
                          background:${stop.lineColors?.[i] ?? '#165788'};
                          color:white;font-size:11px;font-weight:600;margin:1px 2px 0 0;">${l}</span>`
        )
        .join('')
    : '';

  return `<div style="font-family:Inter,system-ui,sans-serif;padding:12px 16px;min-width:180px;">
    <p style="font-weight:600;color:#111827;font-size:14px;margin:0 0 4px;">${icon} ${stop.name}</p>
    ${linesHtml ? `<div style="margin-top:4px;">${linesHtml}</div>` : ''}
    <p style="color:#6b7280;font-size:12px;margin:6px 0 0;">
      ~${stop.estimatedWalkMinutes} min walk · ${Math.round(stop.straightLineMeters)} m away
    </p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MapView: React.FC<Props> = ({
  mapsLoaded,
  destinations,
  result,
  selectedPlace,
  selectedDestinationId,
  transitStops,
  layers,
  onLayersChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // AdvancedMarkerElement refs
  const destMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const originMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const subwayMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const busMarkersRef    = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Shape ref
  const walkCircleRef = useRef<google.maps.Circle | null>(null);

  // ── Initialize map (once) ──────────────────────────────────────────────

  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;

    // mapId is required for AdvancedMarkerElement.
    // Use Google's demo Map ID for development; replace with a Cloud Map ID
    // in production to restore custom styling via Google Cloud Console.
    const map = new google.maps.Map(containerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      mapId: 'DEMO_MAP_ID',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
    });

    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();

    // Attach route renderer to this map instance (service layer owns the renderer)
    initRouteRenderer(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // ── Destination markers (recreate when destinations list changes) ──────

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;
    const map = mapRef.current;

    // Remove all existing destination markers
    destMarkersRef.current.forEach(m => { m.map = null; });
    destMarkersRef.current.clear();

    destinations.forEach((dest) => {
      if (!dest.enabled) return;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: dest.lat, lng: dest.lng },
        map: layers.destinations ? map : null,
        title: dest.name,
        content: createPinContent(destinationMarkerSvg(dest.shortLabel, dest.color)),
        zIndex: 10,
      });

      marker.addListener('gmp-click', () => {
        infoWindowRef.current?.setContent(destInfoContent(dest));
        infoWindowRef.current?.open({ anchor: marker, map });
      });

      destMarkersRef.current.set(dest.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations, mapsLoaded]);

  // ── Origin marker + map bounds ─────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;

    // Remove previous origin marker and walk circle
    originMarkerRef.current && (originMarkerRef.current.map = null);
    originMarkerRef.current = null;
    walkCircleRef.current?.setMap(null);
    walkCircleRef.current = null;

    // Clear route
    clearRoute();

    if (!selectedPlace) return;

    const { latLng } = selectedPlace;

    // Origin marker
    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map: layers.housing ? mapRef.current : null,
      title: en.map.yourLocation,
      content: createPinContent(originMarkerSvg()),
      zIndex: 20,
    });

    marker.addListener('gmp-click', () => {
      infoWindowRef.current?.setContent(
        `<div style="font-family:Inter,sans-serif;padding:12px 16px;">
           <p style="font-weight:600;color:#111827;font-size:14px;margin:0 0 4px;">📍 ${en.map.yourLocation}</p>
           <p style="color:#6b7280;font-size:12px;margin:0;">${selectedPlace.formattedAddress}</p>
         </div>`
      );
      infoWindowRef.current?.open({ anchor: marker, map: mapRef.current! });
    });

    originMarkerRef.current = marker;

    // Walk-radius circle
    walkCircleRef.current = new google.maps.Circle({
      center: latLng,
      radius: WALK_RADIUS_METERS,
      fillColor: '#3b82f6',
      fillOpacity: 0.07,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.3,
      strokeWeight: 1.5,
      map: layers.walkRadius ? mapRef.current : null,
    });

    // Fit bounds to include origin + all 4 destinations
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(latLng);
    destinations.filter(d => d.enabled).forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
    mapRef.current.fitBounds(bounds, { top: 80, right: 40, bottom: 60, left: 40 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace, mapsLoaded]);

  // ── Transit stop markers ───────────────────────────────────────────────

  useEffect(() => {
    if (!mapsLoaded) return;

    // Clear old transit markers
    subwayMarkersRef.current.forEach((m) => { m.map = null; });
    busMarkersRef.current.forEach((m) => { m.map = null; });
    subwayMarkersRef.current = [];
    busMarkersRef.current = [];

    if (!mapRef.current || !window.google || !transitStops.length) return;

    const map = mapRef.current;

    transitStops.forEach((stop) => {
      const isSubway = stop.type === 'subway' || stop.type === 'light_rail';

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: stop.location,
        map: isSubway ? (layers.subway ? map : null) : (layers.bus ? map : null),
        title: stop.name,
        content: isSubway
          ? createCircleContent(subwayMarkerSvg())
          : createCircleContent(busMarkerSvg()),
        zIndex: 5,
      });

      marker.addListener('gmp-click', () => {
        infoWindowRef.current?.setContent(transitInfoContent(stop));
        infoWindowRef.current?.open({ anchor: marker, map });
      });

      if (isSubway) {
        subwayMarkersRef.current.push(marker);
      } else {
        busMarkersRef.current.push(marker);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitStops, mapsLoaded]);

  // ── Layer visibility (no marker recreation — reassign .map to show/hide) ──

  useEffect(() => {
    if (originMarkerRef.current) {
      originMarkerRef.current.map = layers.housing ? mapRef.current : null;
    }
    destMarkersRef.current.forEach((m) => {
      m.map = layers.destinations ? mapRef.current : null;
    });
    subwayMarkersRef.current.forEach((m) => {
      m.map = layers.subway ? mapRef.current : null;
    });
    busMarkersRef.current.forEach((m) => {
      m.map = layers.bus ? mapRef.current : null;
    });
    if (walkCircleRef.current) {
      walkCircleRef.current.setMap(
        layers.walkRadius && mapRef.current ? mapRef.current : null
      );
    }
  }, [layers]);

  // ── Route overlay when a destination card is selected ─────────────────

  const drawRoute = useCallback(
    async (destId: string | null, originLatLng: LatLng | undefined) => {
      if (!destId || !originLatLng) {
        clearRoute();
        return;
      }

      const dest = destinations.find((d) => d.id === destId);
      if (!dest) return;

      await renderRoute(
        originLatLng,
        { lat: dest.lat, lng: dest.lng },
        'driving'
      );
    },
    [destinations]
  );

  useEffect(() => {
    drawRoute(selectedDestinationId, selectedPlace?.latLng);
  }, [selectedDestinationId, selectedPlace, drawRoute]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (!mapsLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-2xl border border-gray-200 gap-3">
        <MapPin className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400">{en.map.loadingMap}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-200 shadow-card">
      {/* Map canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Layer toggles (top overlay) ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-1.5 px-3">
        {LAYER_DEFS.map(({ key, label, dotColor }) => {
          const active = layers[key];
          return (
            <button
              key={key}
              onClick={() => onLayersChange({ ...layers, [key]: !active })}
              className={[
                'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg',
                'border transition-all duration-150 backdrop-blur-sm',
                active
                  ? 'bg-white/95 border-gray-200 text-gray-700 shadow-sm'
                  : 'bg-white/50 border-gray-200/60 text-gray-400',
              ].join(' ')}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-opacity ${
                  active ? 'opacity-100' : 'opacity-30'
                }`}
                style={{ backgroundColor: dotColor }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Legend (bottom-left) ── */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-card p-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {en.map.legend}
        </p>

        {/* Housing */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0" />
          <span className="text-xs text-gray-700">Your location</span>
        </div>

        {/* Walk radius */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 flex-shrink-0 opacity-60" />
          <span className="text-xs text-gray-700">~10 min walk ({WALK_RADIUS_METERS} m)</span>
        </div>

        {/* Destinations */}
        {destinations.filter(d => d.enabled).map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs text-gray-700">{d.shortLabel}</span>
          </div>
        ))}

        {/* Transit */}
        <div className="pt-1 border-t border-gray-100 mt-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#165788] flex-shrink-0" />
            <span className="text-xs text-gray-700">MBTA subway (T)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 flex-shrink-0" />
            <span className="text-xs text-gray-700">MBTA bus stop</span>
          </div>
        </div>
      </div>
    </div>
  );
};
