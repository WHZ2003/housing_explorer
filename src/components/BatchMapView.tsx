import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from '../constants/destinations';
import type { ApartmentEntry, Destination, LatLng, SelectedPlace } from '../types';

interface Props {
  mapsLoaded: boolean;
  destinations: Destination[];
  /** Only confirmed / needs_review entries are shown with numbered pins. */
  apartments: ApartmentEntry[];
  /** Place currently being confirmed — shown as a draggable amber pin. */
  pendingPlace: SelectedPlace | null;
  /** When true, map clicks reposition the pending marker. */
  adjustMode: boolean;
  selectedApartmentId: string | null;
  onPendingMoved: (latLng: LatLng) => void;
  onApartmentSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// SVG marker generators
// ---------------------------------------------------------------------------

function destinationMarkerSvg(label: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
    <path d="M22 0C10.402 0 1 9.402 1 21c0 15.866 21 31 21 31S43 36.866 43 21C43 9.402 33.598 0 22 0z"
          fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="22" cy="21" r="14" fill="white"/>
    <text x="22" y="26" font-family="Inter,system-ui,sans-serif" font-size="10"
          font-weight="700" text-anchor="middle" fill="${color}">${label}</text>
  </svg>`;
}

function apartmentMarkerSvg(num: number, selected: boolean): string {
  const fill = selected ? '#6d28d9' : '#7c3aed';
  const fs   = num >= 10 ? '9' : '11';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
    <path d="M19 0C9.059 0 1 8.059 1 18c0 13.5 18 28 18 28S37 31.5 37 18C37 8.059 28.941 0 19 0z"
          fill="${fill}" stroke="white" stroke-width="2"/>
    <circle cx="19" cy="18" r="12" fill="white"/>
    <text x="19" y="23" font-family="Inter,system-ui,sans-serif" font-size="${fs}"
          font-weight="700" text-anchor="middle" fill="${fill}">${num}</text>
  </svg>`;
}

function pendingMarkerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <path d="M20 0C9.954 0 2 7.954 2 18c0 14 18 30 18 30S38 32 38 18C38 7.954 30.046 0 20 0z"
          fill="#f59e0b" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="18" r="9" fill="white"/>
    <text x="20" y="23" font-family="Inter,system-ui,sans-serif" font-size="14"
          font-weight="700" text-anchor="middle" fill="#f59e0b">?</text>
  </svg>`;
}

function createPinContent(svg: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = svg;
  return div;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BatchMapView: React.FC<Props> = ({
  mapsLoaded,
  destinations,
  apartments,
  pendingPlace,
  adjustMode,
  selectedApartmentId,
  onPendingMoved,
  onApartmentSelect,
}) => {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<google.maps.Map | null>(null);
  const infoWindowRef  = useRef<google.maps.InfoWindow | null>(null);
  const destMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const aptMarkersRef  = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const pendingRef     = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const mapClickRef    = useRef<google.maps.MapsEventListener | null>(null);

  // ── Init map (once) ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;
    const map = new google.maps.Map(containerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      mapId: 'DEMO_MAP_ID',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    });
    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // ── Destination markers ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;
    const map = mapRef.current;
    destMarkersRef.current.forEach(m => { m.map = null; });
    destMarkersRef.current.clear();

    destinations.filter(d => d.enabled).forEach(dest => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: dest.lat, lng: dest.lng },
        map,
        title: dest.name,
        content: createPinContent(destinationMarkerSvg(dest.shortLabel, dest.color)),
        zIndex: 10,
      });
      marker.addListener('gmp-click', () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:Inter,sans-serif;padding:10px 14px;">
             <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
               <div style="width:8px;height:8px;border-radius:50%;background:${dest.color}"></div>
               <b style="font-size:13px;color:#111;">${dest.name}</b>
             </div>
             <p style="font-size:11px;color:#6b7280;margin:0;">${dest.address}</p>
           </div>`
        );
        infoWindowRef.current?.open({ anchor: marker, map });
      });
      destMarkersRef.current.set(dest.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations, mapsLoaded]);

  // ── Apartment markers (confirmed / needs_review) ───────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;
    const map = mapRef.current;

    // Remove stale markers
    aptMarkersRef.current.forEach((m, id) => {
      if (!apartments.find(a => a.id === id)) { m.map = null; aptMarkersRef.current.delete(id); }
    });

    const visible = apartments.filter(a => a.place && a.confirmStatus !== 'unconfirmed');
    visible.forEach((apt, idx) => {
      const existing = aptMarkersRef.current.get(apt.id);
      const selected = apt.id === selectedApartmentId;
      const content  = createPinContent(apartmentMarkerSvg(idx + 1, selected));

      if (existing) {
        existing.content = content;
        return;
      }

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: apt.place!.latLng,
        map,
        title: apt.place!.name,
        content,
        zIndex: 15,
      });
      marker.addListener('gmp-click', () => {
        onApartmentSelect(apt.id);
        infoWindowRef.current?.setContent(
          `<div style="font-family:Inter,sans-serif;padding:10px 14px;">
             <b style="font-size:13px;color:#111;">${apt.place!.name}</b>
             <p style="font-size:11px;color:#6b7280;margin:4px 0 0;">${apt.place!.formattedAddress}</p>
           </div>`
        );
        infoWindowRef.current?.open({ anchor: marker, map });
      });
      aptMarkersRef.current.set(apt.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments, selectedApartmentId, mapsLoaded]);

  // ── Pending marker ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;
    const map = mapRef.current;

    // Remove old pending marker
    if (pendingRef.current) { pendingRef.current.map = null; pendingRef.current = null; }

    if (!pendingPlace) return;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: pendingPlace.latLng,
      map,
      title: pendingPlace.name,
      content: createPinContent(pendingMarkerSvg()),
      gmpDraggable: true,
      zIndex: 20,
    });

    marker.addListener('dragend', () => {
      const pos = marker.position as google.maps.LatLng | null;
      if (pos) onPendingMoved({ lat: pos.lat(), lng: pos.lng() });
    });

    pendingRef.current = marker;

    // Pan map to pending place
    map.panTo(pendingPlace.latLng);
    if (map.getZoom()! < 14) map.setZoom(14);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlace?.placeId, mapsLoaded]);

  // ── Map-click listener for adjust mode ────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;
    // Clear previous listener
    if (mapClickRef.current) { mapClickRef.current.remove(); mapClickRef.current = null; }

    if (!adjustMode) return;

    mapClickRef.current = mapRef.current.addListener(
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        onPendingMoved(latLng);
        // Move existing pending marker immediately
        if (pendingRef.current) pendingRef.current.position = e.latLng;
      }
    );
    return () => { mapClickRef.current?.remove(); mapClickRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustMode]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!mapsLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 gap-3">
        <MapPin className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400">Map loading…</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Adjust mode overlay */}
      {adjustMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          Click on the map to reposition the pin
        </div>
      )}
    </div>
  );
};
