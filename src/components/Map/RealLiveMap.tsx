import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  MINNA_CITY_CENTER,
  FUTMINNA_CAMPUS_CENTER,
  MINNA_LGA_BOUNDARIES,
  FUTMINNA_KEY_LOCATIONS,
  findNearestLocation,
} from '../../data/futminnaLocations';
import { LocationPoint } from '../../types';

interface RealLiveMapProps {
  pickup?: { name: string; lat: number; lng: number };
  destination?: { name: string; lat: number; lng: number };
  stage: 'idle' | 'search' | 'choose' | 'dispatch' | 'finding' | 'matched' | 'rating';
  selectedRide?: string;
  onDriverArrival?: () => void;
  onSelectPickup?: (point: { title: string; detail: string; lat: number; lng: number }) => void;
  onSelectDestination?: (dest: { title: string; detail: string; lat: number; lng: number }) => void;
  onAutoLocated?: (coords: { lat: number; lng: number }) => void;
}

// 100% Free Public Tile Providers with ZERO API Key Requirements (Google Maps Native Style)
type TileStyle = 'osm' | 'street' | 'satellite' | 'hot';

const TILE_LAYERS: Record<TileStyle, { url: string; attribution: string; name: string; subdomains?: string; maxZoom?: number }> = {
  street: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    name: 'Clean Street (Google Maps Style)',
    maxZoom: 20,
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    name: 'Roads & Towns (OSM)',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite Imagery',
    name: 'Satellite Aerial (Hybrid)',
    maxZoom: 20,
  },
  hot: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; World Street Map',
    name: 'Esri World Street Map',
    maxZoom: 19,
  },
};

// Route points connecting Main Campus Gate along FUTMINNA Gidan Kwanu Ring Road to Student Hostels
const defaultRoutePoints: [number, number][] = [
  [9.5375, 6.4520], // Main Campus Gate
  [9.5368, 6.4510], // School Motor Park & Keke Station
  [9.5355, 6.4495], // SAAT Complex
  [9.5340, 6.4480], // SEET Complex
  [9.5325, 6.4468], // Senate Building & Convocation Square
  [9.5312, 6.4455], // University Library
  [9.5285, 6.4442], // Academic Ring Road South
  [9.5265, 6.4430], // Student Hostels (Block A, B, C)
];

const getVehicleSvg = (type: string, color = '#0B6B45', size = 18): string => {
  if (type === 'okada') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M12 16h4l2-6H9l-2 3"/><path d="M12 9l2-4h3"/></svg>`;
  }
  if (type === 'keke') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M4 11h11l3 6"/><path d="M9 6h5v11"/><path d="M6 14.5V11"/></svg>`;
  }
  if (type === 'dispatch') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
};

const pinSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#111F18"/></svg>`;

const createPickupIcon = (name: string) => {
  const isDriver = name.toLowerCase().includes('driver');
  const label = isDriver ? 'Driver (You)' : `Pick-up: ${name.slice(0, 20)}`;
  const pickupHtml = `
    <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35)); pointer-events:none;">
      <div style="background:#0E7C3A; color:#ffffff; font-size:11px; font-weight:800; padding:4px 9px; border-radius:12px; box-shadow:0 3px 10px rgba(14,124,58,0.5); white-space:nowrap; margin-bottom:4px; border:1.5px solid #ffffff; display:flex; align-items:center; gap:5px;">
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#7ce0aa; box-shadow:0 0 6px #7ce0aa;"></span>
        ${label}
      </div>
      <div style="width:16px; height:16px; background:#0E7C3A; border:2.5px solid #ffffff; border-radius:4px; transform:rotate(45deg); box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
    </div>
  `;
  return L.divIcon({
    html: pickupHtml,
    className: 'osm-pickup-pin',
    iconSize: [150, 52],
    iconAnchor: [75, 48],
  });
};

const createDestIcon = (name: string) => {
  const isRiderPickup = name.toLowerCase().includes('rider') || name.toLowerCase().includes('pick-up');
  const cleanName = name.replace(/rider[:\s]*/i, '').replace(/pick-up[:\s]*/i, '').trim();
  const label = isRiderPickup ? `Rider Pick-up: ${cleanName.slice(0, 20)}` : `Drop-off: ${cleanName.slice(0, 20)}`;
  const badgeBg = isRiderPickup ? '#0E7C3A' : '#111F18';
  const borderColor = isRiderPickup ? '#ffffff' : '#34D399';

  const destHtml = `
    <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35)); pointer-events:none;">
      <div style="background:${badgeBg}; color:#ffffff; font-size:11px; font-weight:800; padding:4px 9px; border-radius:12px; box-shadow:0 3px 10px rgba(0,0,0,0.4); white-space:nowrap; margin-bottom:4px; border:1.5px solid ${borderColor}; display:flex; align-items:center; gap:5px;">
        ${pinSvg} ${label}
      </div>
      <div style="width:16px; height:16px; background:${badgeBg}; border:2.5px solid ${borderColor}; border-radius:4px; transform:rotate(45deg); box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
    </div>
  `;
  return L.divIcon({
    html: destHtml,
    className: 'osm-dest-pin',
    iconSize: [160, 52],
    iconAnchor: [80, 48],
  });
};

// Universal turn-by-turn road route fetcher (calling server proxy with OSRM fallback)
async function fetchRoadRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<{ coordinates: [number, number][]; distance?: number; duration?: number }> {
  // 1. Try local server proxy endpoint first
  try {
    const res = await fetch(`/api/route?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`);
    if (res.ok) {
      const data = await res.json();
      if (data.coordinates && data.coordinates.length > 0) {
        return {
          coordinates: data.coordinates,
          distance: data.distance,
          duration: data.duration,
        };
      }
    }
  } catch (e) {
    // continue to direct OSRM fallback
  }

  // 2. Direct OSRM driving API call as secondary
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
        return {
          coordinates: coords,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
        };
      }
    }
  } catch (e) {
    console.warn('[Routing] Direct OSRM fetch failed:', e);
  }

  // 3. Fallback to default route points if near campus gate & hostels, or 3-point midpoint
  return {
    coordinates: [
      [startLat, startLng],
      [startLat + (endLat - startLat) * 0.35, startLng + (endLng - startLng) * 0.15],
      [startLat + (endLat - startLat) * 0.65, startLng + (endLng - startLng) * 0.85],
      [endLat, endLng],
    ]
  };
}

const getPoiCategoryColor = (category?: string, lga?: string): string => {
  if (category === 'Campus') return '#0E7C3A';
  if (category === 'Transit Hub') return '#2563EB';
  if (category === 'Market') return '#D97706';
  if (category === 'Medical') return '#DC2626';
  if (category === 'Government') return '#7C3AED';
  if (category === 'Residential') return '#0D9488';
  if (lga === 'Chanchaga') return '#1D4ED8';
  return '#0E7C3A';
};

export const RealLiveMap: React.FC<RealLiveMapProps> = ({
  pickup = { name: 'Main Campus Gate', lat: 9.5375, lng: 6.4520 },
  destination = { name: 'Student Hostels', lat: 9.5265, lng: 6.4430 },
  stage,
  selectedRide = 'keke',
  onDriverArrival,
  onSelectPickup,
  onSelectDestination,
  onAutoLocated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const userLiveMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const nearbyMarkersRef = useRef<L.Marker[]>([]);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeCoordsRef = useRef<[number, number][]>(defaultRoutePoints);
  const polylineRef = useRef<L.Polyline | null>(null);
  const shadowPolylineRef = useRef<L.Polyline | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasAutoCenteredRef = useRef(false);

  // Overlay layer refs
  const lgaPolygonsRef = useRef<L.Polygon[]>([]);
  const landmarkMarkersRef = useRef<L.Marker[]>([]);

  // Default to Street Style (Google Maps look & feel, 100% free with no API key)
  const [tileStyle, setTileStyle] = useState<TileStyle>('street');
  const [driverEta, setDriverEta] = useState('3 min');
  const [liveLocationActive, setLiveLocationActive] = useState(false);
  const [userCoord, setUserCoord] = useState<[number, number]>([pickup.lat, pickup.lng]);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const onSelectPickupRef = useRef(onSelectPickup);
  useEffect(() => {
    onSelectPickupRef.current = onSelectPickup;
  }, [onSelectPickup]);

  const onSelectDestinationRef = useRef(onSelectDestination);
  useEffect(() => {
    onSelectDestinationRef.current = onSelectDestination;
  }, [onSelectDestination]);

  const onAutoLocatedRef = useRef(onAutoLocated);
  useEffect(() => {
    onAutoLocatedRef.current = onAutoLocated;
  }, [onAutoLocated]);

  // Switch Tile Provider dynamically
  const switchTileProvider = useCallback((newStyle: TileStyle) => {
    const map = mapRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    const provider = TILE_LAYERS[newStyle];
    const newLayer = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom || 19,
      attribution: provider.attribution,
      subdomains: provider.subdomains || 'abc',
    }).addTo(map);

    activeTileLayerRef.current = newLayer;
    setTileStyle(newStyle);
    setShowLayerMenu(false);
  }, []);

  // Initialize Map Canvas with Full World & Local Zoom
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if ((containerRef.current as any)._leaflet_id) {
      delete (containerRef.current as any)._leaflet_id;
    }

    let map: L.Map | null = null;

    try {
      const centerLat = (pickup.lat + destination.lat) / 2;
      const centerLng = (pickup.lng + destination.lng) / 2;

      map = L.map(containerRef.current, {
        center: [centerLat, centerLng],
        zoom: 14,
        minZoom: 2, // Allow full world zoom out
        maxZoom: 19, // Allow street/road level zoom in
        worldCopyJump: true,
        zoomControl: false,
        attributionControl: false, // Clean natural map look
      });

      // Zoom controls in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Initial layer: Clean Street (Esri World Street Map - 100% free, no API key)
      const initialProvider = TILE_LAYERS.street;
      const initialLayer = L.tileLayer(initialProvider.url, {
        maxZoom: initialProvider.maxZoom || 19,
        attribution: initialProvider.attribution,
      }).addTo(map);

      activeTileLayerRef.current = initialLayer;
      mapRef.current = map;

      // Click anywhere on map (Village, Road, Street, Anywhere in the World) to set Pickup or Destination
      map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // Check if nearest known village or corridor landmark is nearby
        const nearest = findNearestLocation(lat, lng);
        let areaLabel = 'Location Point';
        let subLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        if (nearest) {
          areaLabel = nearest.name;
          subLabel = `${nearest.area || nearest.address} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        } else if (lat >= 9.50 && lat <= 9.75 && lng >= 6.40 && lng <= 6.65) {
          if (lat >= 9.57 && lng >= 6.51) {
            areaLabel = 'Chanchaga LGA, Minna';
          } else {
            areaLabel = 'Bosso LGA, Minna';
          }
          subLabel = `Road point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        }

        const popupWrapper = document.createElement('div');
        popupWrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        popupWrapper.style.textAlign = 'left';
        popupWrapper.style.padding = '4px 6px';
        popupWrapper.style.minWidth = '200px';

        const titleElem = document.createElement('strong');
        titleElem.style.display = 'block';
        titleElem.style.fontSize = '12px';
        titleElem.style.color = '#14201A';
        titleElem.style.marginBottom = '2px';
        titleElem.textContent = areaLabel;

        const subElem = document.createElement('span');
        subElem.style.fontSize = '10px';
        subElem.style.color = '#7A857F';
        subElem.style.display = 'block';
        subElem.style.marginBottom = '8px';
        subElem.textContent = subLabel;

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '6px';

        // 🟢 Set as Pick-up Point Button
        const pickupBtn = document.createElement('button');
        pickupBtn.style.background = '#0E7C3A';
        pickupBtn.style.color = 'white';
        pickupBtn.style.border = 'none';
        pickupBtn.style.padding = '6px 10px';
        pickupBtn.style.borderRadius = '6px';
        pickupBtn.style.fontWeight = 'bold';
        pickupBtn.style.fontSize = '11px';
        pickupBtn.style.cursor = 'pointer';
        pickupBtn.style.width = '100%';
        pickupBtn.textContent = 'Set as Pick-up Point';

        pickupBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (onSelectPickupRef.current) {
            onSelectPickupRef.current({
              title: areaLabel,
              detail: subLabel,
              lat,
              lng,
            });
          }
          if (map) {
            map.closePopup();
            map.panTo([lat, lng]);
          }
        });

        // 🔴 Set as Destination Button
        const destBtn = document.createElement('button');
        destBtn.style.background = '#111F18';
        destBtn.style.color = 'white';
        destBtn.style.border = 'none';
        destBtn.style.padding = '6px 10px';
        destBtn.style.borderRadius = '6px';
        destBtn.style.fontWeight = 'bold';
        destBtn.style.fontSize = '11px';
        destBtn.style.cursor = 'pointer';
        destBtn.style.width = '100%';
        destBtn.textContent = 'Set as Destination →';

        destBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (onSelectDestinationRef.current) {
            onSelectDestinationRef.current({
              title: areaLabel,
              detail: subLabel,
              lat,
              lng,
            });
          }
          if (map) {
            map.closePopup();
          }
        });

        btnContainer.appendChild(pickupBtn);
        btnContainer.appendChild(destBtn);

        popupWrapper.appendChild(titleElem);
        popupWrapper.appendChild(subElem);
        popupWrapper.appendChild(btnContainer);

        if (map) {
          L.popup()
            .setLatLng(e.latlng)
            .setContent(popupWrapper)
            .openOn(map);
        }
      });

      setTimeout(() => {
        map?.invalidateSize();
      }, 200);
    } catch (err) {
      console.warn('[RealLiveMap] Failed to initialize Leaflet map:', err);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (watchIdRef.current) navigator.geolocation?.clearWatch(watchIdRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render Subtle LGA Boundaries (Chanchaga LGA & Bosso LGA)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    lgaPolygonsRef.current.forEach((poly) => poly.remove());
    lgaPolygonsRef.current = [];

    // 1. Chanchaga LGA Polygon
    const chanchaga = MINNA_LGA_BOUNDARIES.chanchaga;
    const chanchagaPolygon = L.polygon(chanchaga.coordinates, {
      color: '#2563EB',
      weight: 1.5,
      opacity: 0.6,
      fillColor: '#3B82F6',
      fillOpacity: 0.04,
    }).addTo(map);

    chanchagaPolygon.bindTooltip(
      `<strong>${chanchaga.name}</strong> · Minna Municipal Core`,
      { sticky: true, className: 'natural-map-tooltip' }
    );

    // 2. Bosso LGA Polygon
    const bosso = MINNA_LGA_BOUNDARIES.bosso;
    const bossoPolygon = L.polygon(bosso.coordinates, {
      color: '#0E7C3A',
      weight: 1.5,
      opacity: 0.6,
      fillColor: '#10B981',
      fillOpacity: 0.04,
    }).addTo(map);

    bossoPolygon.bindTooltip(
      `<strong>${bosso.name}</strong> · Academic & Airport Corridor`,
      { sticky: true, className: 'natural-map-tooltip' }
    );

    lgaPolygonsRef.current = [chanchagaPolygon, bossoPolygon];

    return () => {
      chanchagaPolygon.remove();
      bossoPolygon.remove();
    };
  }, []);

  // Render Landmark & Village POI Markers (Natural circular dots, hover tooltip, rich click popup)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    landmarkMarkersRef.current.forEach((m) => m.remove());
    landmarkMarkersRef.current = [];

    const markers: L.Marker[] = FUTMINNA_KEY_LOCATIONS.map((loc: LocationPoint) => {
      const color = getPoiCategoryColor(loc.category, loc.lga);
      const isAirport = loc.id === 'minna_airport';
      const isGate = loc.id === 'fut_gate';

      const dotSize = isAirport || isGate ? 18 : 14;
      const innerSize = isAirport || isGate ? 7 : 5;

      const pinHtml = `
        <div style="
          width:${dotSize}px;
          height:${dotSize}px;
          border-radius:50%;
          background:${color};
          border:2px solid #ffffff;
          box-shadow:0 1px 4px rgba(0,0,0,0.35);
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform 0.15s ease;
        ">
          <div style="width:${innerSize}px; height:${innerSize}px; border-radius:50%; background:#ffffff;"></div>
        </div>
      `;

      const icon = L.divIcon({
        html: pinHtml,
        className: 'natural-poi-pin',
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: isAirport ? 600 : 400 }).addTo(map);

      // Clean tooltip only shown on hover
      marker.bindTooltip(
        `<div style="font-family:system-ui, sans-serif; font-size:11px; font-weight:600; padding:1px 3px;">
          ${loc.name}
        </div>`,
        { direction: 'top', offset: [0, -(dotSize / 2 + 2)], className: 'natural-tooltip' }
      );

      // On click: Interactive card with BOTH "Set as Pick-up" & "Set as Destination"
      const popupDiv = document.createElement('div');
      popupDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      popupDiv.style.padding = '4px 6px';
      popupDiv.style.minWidth = '200px';

      const nameHeading = document.createElement('h4');
      nameHeading.style.margin = '0 0 2px';
      nameHeading.style.fontSize = '12px';
      nameHeading.style.fontWeight = '700';
      nameHeading.style.color = '#111827';
      nameHeading.textContent = loc.name;

      const addrPara = document.createElement('p');
      addrPara.style.margin = '0 0 6px';
      addrPara.style.fontSize = '10px';
      addrPara.style.color = '#6B7280';
      addrPara.textContent = `${loc.address} (${loc.lga || 'Minna'} LGA)`;

      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'flex';
      btnContainer.style.gap = '6px';

      const pickupBtn = document.createElement('button');
      pickupBtn.style.background = '#0E7C3A';
      pickupBtn.style.color = 'white';
      pickupBtn.style.border = 'none';
      pickupBtn.style.padding = '6px 10px';
      pickupBtn.style.borderRadius = '6px';
      pickupBtn.style.fontWeight = 'bold';
      pickupBtn.style.fontSize = '11px';
      pickupBtn.style.cursor = 'pointer';
      pickupBtn.style.flex = '1';
      pickupBtn.textContent = 'Set as Pick-up Point';

      pickupBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (onSelectPickupRef.current) {
          onSelectPickupRef.current({
            title: loc.name,
            detail: `${loc.address} (${loc.lga || 'Minna'} LGA)`,
            lat: loc.lat,
            lng: loc.lng,
          });
        }
        if (map) {
          map.closePopup();
          map.panTo([loc.lat, loc.lng]);
        }
      });

      const destBtn = document.createElement('button');
      destBtn.style.background = '#111F18';
      destBtn.style.color = 'white';
      destBtn.style.border = 'none';
      destBtn.style.padding = '6px 10px';
      destBtn.style.borderRadius = '6px';
      destBtn.style.fontWeight = 'bold';
      destBtn.style.fontSize = '11px';
      destBtn.style.cursor = 'pointer';
      destBtn.style.flex = '1';
      destBtn.textContent = 'Set as Destination →';

      destBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (onSelectDestinationRef.current) {
          onSelectDestinationRef.current({
            title: loc.name,
            detail: `${loc.address} (${loc.lga || 'Minna'} LGA)`,
            lat: loc.lat,
            lng: loc.lng,
          });
        }
        if (map) {
          map.closePopup();
        }
      });

      btnContainer.appendChild(pickupBtn);
      btnContainer.appendChild(destBtn);

      popupDiv.appendChild(nameHeading);
      popupDiv.appendChild(addrPara);
      popupDiv.appendChild(btnContainer);

      marker.bindPopup(popupDiv);
      return marker;
    });

    landmarkMarkersRef.current = markers;

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, []);

  // Real Live GPS Tracking via navigator.geolocation with Auto-Center on App Start
  useEffect(() => {
    if (!navigator.geolocation) return;

    const map = mapRef.current;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserCoord([latitude, longitude]);
        setLiveLocationActive(true);

        // Auto-locate passenger position on map initially
        if (!hasAutoCenteredRef.current && map) {
          hasAutoCenteredRef.current = true;
          map.flyTo([latitude, longitude], 16, { duration: 1.2 });
          onAutoLocatedRef.current?.({ lat: latitude, lng: longitude });
        }

        if (!map) return;

        const liveGpsHtml = `
          <div style="position:relative; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:30px; height:30px; border-radius:50%; background:rgba(16,185,129,0.3); animation:pulse 1.8s infinite;"></div>
            <div style="width:14px; height:14px; border-radius:50%; background:#0B6B45; border:2.5px solid #ffffff; box-shadow:0 0 8px rgba(11,107,69,0.5);"></div>
          </div>
        `;
        const liveGpsIcon = L.divIcon({
          html: liveGpsHtml,
          className: 'live-gps-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        if (!userLiveMarkerRef.current) {
          userLiveMarkerRef.current = L.marker([latitude, longitude], { icon: liveGpsIcon, zIndexOffset: 800 }).addTo(map);
          accuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: Math.min(accuracy, 100),
            color: '#0B6B45',
            fillColor: '#0B6B45',
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(map);
        } else {
          userLiveMarkerRef.current.setLatLng([latitude, longitude]);
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng([latitude, longitude]);
            accuracyCircleRef.current.setRadius(Math.min(accuracy, 100));
          }
        }
      },
      (err) => {
        console.warn('Geolocation fallback to Minna transit corridor:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Always render Pick-up Pin Marker at pickup coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (pickup && pickup.lat && pickup.lng) {
      const pIcon = createPickupIcon(pickup.name || 'Pick-up');
      pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
        icon: pIcon,
        zIndexOffset: 950,
      }).addTo(map);
    }

    return () => {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
    };
  }, [pickup.lat, pickup.lng, pickup.name]);

  // Update Road Polyline & Destination Pin using Turn-by-Turn Road Engine (Strictly follows streets & roads, no cuts across buildings)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (shadowPolylineRef.current) {
      shadowPolylineRef.current.remove();
      shadowPolylineRef.current = null;
    }

    if (stage === 'idle') {
      return;
    }

    const destCoord: [number, number] = [destination.lat, destination.lng];
    const destIcon = createDestIcon(destination.name || 'Destination');
    destMarkerRef.current = L.marker(destCoord, {
      icon: destIcon,
      zIndexOffset: 900,
    }).addTo(map);

    // Immediately fit map bounds to pickup & destination for zero-lag responsiveness
    try {
      const quickBounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(quickBounds, {
        paddingTopLeft: [50, 40],
        paddingBottomRight: [50, 200],
        maxZoom: 16,
      });
    } catch (e) {}

    let isMounted = true;
    fetchRoadRoute(pickup.lat, pickup.lng, destination.lat, destination.lng).then((res) => {
      if (!isMounted || !mapRef.current) return;
      const pts = res.coordinates;
      routeCoordsRef.current = pts;

      if (shadowPolylineRef.current) shadowPolylineRef.current.remove();
      if (polylineRef.current) polylineRef.current.remove();

      // Outer road route soft glow
      shadowPolylineRef.current = L.polyline(pts, {
        color: '#0E7C3A',
        weight: 9,
        opacity: 0.28,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);

      // Inner solid road route line
      polylineRef.current = L.polyline(pts, {
        color: '#0E7C3A',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);

      try {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), {
          paddingTopLeft: [60, 40],
          paddingBottomRight: [60, 220],
          maxZoom: 16,
        });
      } catch (err) {
        // bounds fallback
      }
    });

    return () => {
      isMounted = false;
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (shadowPolylineRef.current) {
        shadowPolylineRef.current.remove();
        shadowPolylineRef.current = null;
      }
    };
  }, [stage, destination.lat, destination.lng, destination.name, pickup.lat, pickup.lng, pickup.name]);

  // Nearby Fleet for 'idle', 'choose', and 'finding' stages
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    nearbyMarkersRef.current.forEach((m) => m.remove());
    nearbyMarkersRef.current = [];

    if (stage === 'idle' || stage === 'choose' || stage === 'finding') {
      const initialFleet: { lat: number; lng: number; type: string; angle: number; speed: number }[] = [
        { lat: pickup.lat + 0.003, lng: pickup.lng - 0.002, type: 'car', angle: 0.2, speed: 0.00004 },
        { lat: pickup.lat - 0.002, lng: pickup.lng + 0.004, type: 'okada', angle: 1.5, speed: 0.00006 },
        { lat: pickup.lat + 0.004, lng: pickup.lng + 0.003, type: 'keke', angle: 3.1, speed: 0.00003 },
        { lat: pickup.lat - 0.003, lng: pickup.lng - 0.003, type: 'car', angle: 4.2, speed: 0.00004 },
        { lat: pickup.lat + 0.001, lng: pickup.lng + 0.005, type: 'okada', angle: 2.1, speed: 0.00005 },
      ];

      const markers = initialFleet.map((loc) => {
        const html = `
          <div style="width:30px; height:30px; border-radius:50%; background:#ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.22); display:flex; align-items:center; justify-content:center; border:2px solid #0B6B45; transition:transform 0.4s ease;">
            ${getVehicleSvg(loc.type, '#0B6B45', 16)}
          </div>
        `;
        const icon = L.divIcon({
          html,
          className: 'osm-fleet-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        return L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      });

      nearbyMarkersRef.current = markers;

      const interval = setInterval(() => {
        initialFleet.forEach((veh, index) => {
          veh.angle += 0.08;
          const deltaLat = Math.sin(veh.angle) * veh.speed;
          const deltaLng = Math.cos(veh.angle) * veh.speed;
          veh.lat += deltaLat;
          veh.lng += deltaLng;

          const m = nearbyMarkersRef.current[index];
          if (m) {
            m.setLatLng([veh.lat, veh.lng]);
          }
        });
      }, 350);

      return () => {
        clearInterval(interval);
        nearbyMarkersRef.current.forEach((m) => m.remove());
        nearbyMarkersRef.current = [];
      };
    }
  }, [stage, pickup.lat, pickup.lng]);

  // Real Animated Driver Movement during 'matched' stage
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stage !== 'matched') {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    let progress = 0.05;
    const pointsToFollow = routeCoordsRef.current && routeCoordsRef.current.length > 1
      ? routeCoordsRef.current
      : defaultRoutePoints;
    const totalPoints = pointsToFollow.length;

    const updateDriverPosition = () => {
      const invertedProgress = 1 - progress;
      const indexFloat = invertedProgress * (totalPoints - 1);
      const idx = Math.floor(indexFloat);
      const nextIdx = Math.min(idx + 1, totalPoints - 1);
      const ratio = indexFloat - idx;

      const p1 = pointsToFollow[idx];
      const p2 = pointsToFollow[nextIdx];

      const currentLat = p1[0] + (p2[0] - p1[0]) * ratio;
      const currentLng = p1[1] + (p2[1] - p1[1]) * ratio;

      const minsLeft = Math.max(1, Math.ceil((1 - progress) * 3));
      const etaText = progress >= 0.95 ? 'Driver Arrived!' : `${minsLeft} min away`;
      setDriverEta(etaText);

      const driverHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; transform:translate3d(0,0,0); transition:all 0.3s ease;">
          <div style="background:#0B6B45; color:#ffffff; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; box-shadow:0 3px 12px rgba(11,107,69,0.4); white-space:nowrap; margin-bottom:4px; display:flex; align-items:center; gap:4px; border:1px solid #34D399;">
            <span style="width:6px; height:6px; border-radius:50%; background:#7ce0aa; animation:pulse 1s infinite;"></span>
            Adekunle · ${etaText}
          </div>
          <div style="width:36px; height:36px; border-radius:50%; background:#ffffff; border:3px solid #0B6B45; box-shadow:0 4px 14px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center;">
            ${getVehicleSvg(selectedRide, '#0B6B45', 20)}
          </div>
        </div>
      `;

      const driverIcon = L.divIcon({
        html: driverHtml,
        className: 'osm-animated-driver',
        iconSize: [120, 54],
        iconAnchor: [60, 48],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([currentLat, currentLng], {
          icon: driverIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([currentLat, currentLng]);
        driverMarkerRef.current.setIcon(driverIcon);
      }

      if (progress < 0.98) {
        progress += 0.0035;
        animFrameRef.current = requestAnimationFrame(updateDriverPosition);
      } else {
        onDriverArrival?.();
      }
    };

    animFrameRef.current = requestAnimationFrame(updateDriverPosition);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
    };
  }, [stage, selectedRide]);

  // Camera presets: Jump between Campus, Minna City, LGAs, and World
  const jumpToView = (preset: 'minna' | 'bosso' | 'chanchaga' | 'campus' | 'world') => {
    const map = mapRef.current;
    if (!map) return;
    setShowLayerMenu(false);

    if (preset === 'world') {
      map.flyTo([10.0, 15.0], 3, { duration: 1.5 });
    } else if (preset === 'minna') {
      map.flyTo([MINNA_CITY_CENTER.lat, MINNA_CITY_CENTER.lng], 13, { duration: 1.2 });
    } else if (preset === 'chanchaga') {
      const bounds = L.latLngBounds(MINNA_LGA_BOUNDARIES.chanchaga.coordinates);
      map.flyToBounds(bounds, { padding: [30, 30], duration: 1.2 });
    } else if (preset === 'bosso') {
      const bounds = L.latLngBounds(MINNA_LGA_BOUNDARIES.bosso.coordinates);
      map.flyToBounds(bounds, { padding: [30, 30], duration: 1.2 });
    } else if (preset === 'campus') {
      map.flyTo([FUTMINNA_CAMPUS_CENTER.lat, FUTMINNA_CAMPUS_CENTER.lng], 15, { duration: 1.2 });
    }
  };

  // Recenter / GPS Locator - Automatically locates and updates passenger position
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;

    if (liveLocationActive) {
      map.flyTo(userCoord, 16);
      onAutoLocatedRef.current?.({ lat: userCoord[0], lng: userCoord[1] });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoord([latitude, longitude]);
          setLiveLocationActive(true);
          map.flyTo([latitude, longitude], 16);
          onAutoLocatedRef.current?.({ lat: latitude, lng: longitude });
        },
        () => {
          map.flyTo([pickup.lat, pickup.lng], 15);
        },
        { timeout: 8000 }
      );
    } else {
      map.flyTo([pickup.lat, pickup.lng], 15);
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden" aria-label="Interactive Map">
      {/* Map Canvas */}
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Minimal Top-Right Floating Controls (Clean & Natural, No Cluttering Text) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Recenter & Live GPS Button */}
        <button
          onClick={handleRecenter}
          className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-md border border-gray-200/90 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Locate me"
          title={liveLocationActive ? 'Center on Live GPS' : 'Center Current Location'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><polyline points="12 1 12 5"/><polyline points="12 19 12 23"/><polyline points="1 12 5 12"/><polyline points="19 12 23 12"/></svg>
        </button>

        {/* Map Layers & Quick Jump Menu */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-md border border-gray-200/90 flex items-center justify-center active:scale-95 transition-transform"
            title="Map view options"
            aria-label="Map layers"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-12 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-2 w-56 z-30 space-y-1.5 text-xs animate-in fade-in">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Map Style (No API Key Required)
              </div>
              <button
                onClick={() => switchTileProvider('street')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium ${
                  tileStyle === 'street' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <span className="block font-semibold">Clean Streets</span>
                  <span className="block text-[10px] text-gray-500">Google Maps style with villages</span>
                </div>
                {tileStyle === 'street' && (
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
              <button
                onClick={() => switchTileProvider('osm')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium ${
                  tileStyle === 'osm' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <span className="block font-semibold">Roads & Towns</span>
                  <span className="block text-[10px] text-gray-500">OpenStreetMap standard</span>
                </div>
                {tileStyle === 'osm' && (
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
              <button
                onClick={() => switchTileProvider('satellite')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium ${
                  tileStyle === 'satellite' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <span className="block font-semibold">Satellite Aerial</span>
                  <span className="block text-[10px] text-gray-500">High-res terrain & imagery</span>
                </div>
                {tileStyle === 'satellite' && (
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
              <button
                onClick={() => switchTileProvider('hot')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium ${
                  tileStyle === 'hot' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <span className="block font-semibold">Humanitarian OSM</span>
                  <span className="block text-[10px] text-gray-500">Highways, villages & paths</span>
                </div>
                {tileStyle === 'hot' && (
                  <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>

              <div className="pt-1.5 border-t border-gray-100">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Quick Jump
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  <button
                    onClick={() => jumpToView('campus')}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-left font-medium text-[11px] text-gray-700 hover:text-emerald-800"
                  >
                    Campus
                  </button>
                  <button
                    onClick={() => jumpToView('minna')}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-left font-medium text-[11px] text-gray-700 hover:text-emerald-800"
                  >
                    Minna City
                  </button>
                  <button
                    onClick={() => jumpToView('chanchaga')}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-left font-medium text-[11px] text-gray-700 hover:text-blue-800"
                  >
                    Chanchaga
                  </button>
                  <button
                    onClick={() => jumpToView('bosso')}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-left font-medium text-[11px] text-gray-700 hover:text-emerald-800"
                  >
                    Bosso
                  </button>
                  <button
                    onClick={() => jumpToView('world')}
                    className="col-span-2 px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-center font-medium text-[11px] text-gray-700"
                  >
                    World View
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
