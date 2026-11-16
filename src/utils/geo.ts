import { RideOption } from '../types';

/**
 * Calculate distance in km between two lat/lng points using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate realistic ETA in minutes considering vehicle type and Nigerian road traffic
 */
export function calculateRideETA(
  distanceKm: number,
  category: string,
  trafficLevel: 'low' | 'moderate' | 'heavy_go_slow'
): number {
  let speedKmH = 35; // default urban speed
  
  if (category === 'okada' || category === 'dispatch') {
    // Okada filters through traffic jams easily!
    speedKmH = trafficLevel === 'heavy_go_slow' ? 38 : 45;
  } else if (category === 'keke') {
    speedKmH = trafficLevel === 'heavy_go_slow' ? 22 : 30;
  } else {
    // Cars and vans get hit by go-slow
    if (trafficLevel === 'heavy_go_slow') {
      speedKmH = 16;
    } else if (trafficLevel === 'moderate') {
      speedKmH = 28;
    } else {
      speedKmH = 45;
    }
  }

  const hours = distanceKm / speedKmH;
  const minutes = Math.max(3, Math.round(hours * 60));
  return minutes;
}

export interface FareCalculation {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  campusLevy: number;
  surgeAmount: number;
  totalNaira: number;
}

/**
 * Calculate transparent fare breakdown in Naira for Minna / FUTMINNA Pilot
 * During pilot: 0% platform commission, ₦0 levy, flat campus zones
 */
export function calculateFareBreakdown(
  distanceKm: number,
  durationMinutes: number,
  option: RideOption,
  isSurge: boolean = false
): FareCalculation {
  const baseFare = option.basePrice;
  const distanceFare = Math.round(distanceKm * option.perKm);
  const timeFare = Math.round(durationMinutes * option.perMinute);
  const campusLevy = 0; // ₦0 levy for campus pilot
  
  const subtotal = baseFare + distanceFare + timeFare;
  const surgeMultiplier = isSurge ? 1.0 : option.surgeMultiplier; // Surge disabled for pilot
  const surgeAmount = Math.round(subtotal * (surgeMultiplier - 1));
  
  const total = subtotal + surgeAmount + campusLevy;
  // Round to nearest 50 Naira for clean Nigerian currency
  const totalNaira = Math.ceil(total / 50) * 50;

  return {
    baseFare,
    distanceFare,
    timeFare,
    campusLevy,
    surgeAmount,
    totalNaira,
  };
}

/**
 * Format Naira currency with ₦ symbol and commas
 */
export function formatNaira(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG');
}

/**
 * Interpolate an array of coordinates with realistic street waypoints between start and end
 */
export function generateRouteWaypoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  steps: number = 30
): [number, number][] {
  const waypoints: [number, number][] = [];
  
  // Calculate midpoints with a slight realistic curve to simulate street grid
  const midLat = (startLat + endLat) / 2 + (Math.sin((startLat + endLng) * 10) * 0.004);
  const midLng = (startLng + endLng) / 2 + (Math.cos((startLng + endLat) * 10) * 0.004);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Quadratic bezier curve
    const lat = Math.pow(1 - t, 2) * startLat + 2 * (1 - t) * t * midLat + Math.pow(t, 2) * endLat;
    const lng = Math.pow(1 - t, 2) * startLng + 2 * (1 - t) * t * midLng + Math.pow(t, 2) * endLng;
    waypoints.push([lat, lng]);
  }

  return waypoints;
}

/**
 * Calculate bearing/heading in degrees from point A to point B
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const y = Math.sin(deg2rad(lng2 - lng1)) * Math.cos(deg2rad(lat2));
  const x =
    Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
    Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(lng2 - lng1));
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}
