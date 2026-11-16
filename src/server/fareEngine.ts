// Zylift fare engine: distance-based pricing for any pickup -> any destination.
// Distance/time come from OpenRouteService (ORS). Campus flat fares stay in db.ts.
import crypto from 'crypto';
import { pilotDb } from './db.js';

export type FareVehicle = 'okada' | 'keke' | 'cab_go' | 'small_bus' | 'big_bus';
export type LatLng = [number, number]; // [lat, lng] (same order the app already uses)

export interface VehicleRule {
  id: FareVehicle;
  label: string;
  minSeats: number;            // typical minimum capacity (informational)
  maxSeats: number;            // most passengers this vehicle can carry
  minPassengersToOffer: number; // hide big vehicles from tiny groups
  maxKm: number | null;        // longest trip this vehicle is offered for (null = no limit)
  baseFare: number;            // naira
  perKm: number;               // naira per km
  perMinute: number;           // naira per minute
  minimumFare: number;         // naira
}

// Default baseline pricing & vehicle cutoffs (can be edited dynamically by admin via dashboard)
export const DEFAULT_VEHICLE_RULES: Record<FareVehicle, VehicleRule> = {
  okada:     { id: 'okada',     label: 'Okada',     minSeats: 1,  maxSeats: 2,  minPassengersToOffer: 1,  maxKm: 30,   baseFare: 150,  perKm: 60,  perMinute: 5,  minimumFare: 250 },
  keke:      { id: 'keke',      label: 'Keke',      minSeats: 4,  maxSeats: 5,  minPassengersToOffer: 1,  maxKm: 35,   baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 300 },
  cab_go:    { id: 'cab_go',    label: 'Car',       minSeats: 4,  maxSeats: 10, minPassengersToOffer: 1,  maxKm: null, baseFare: 500,  perKm: 150, perMinute: 15, minimumFare: 1000 },
  small_bus: { id: 'small_bus', label: 'Small bus', minSeats: 8,  maxSeats: 18, minPassengersToOffer: 8,  maxKm: null, baseFare: 2500, perKm: 300, perMinute: 25, minimumFare: 5000 },
  big_bus:   { id: 'big_bus',   label: 'Big bus',   minSeats: 19, maxSeats: 80, minPassengersToOffer: 19, maxKm: null, baseFare: 8000, perKm: 600, perMinute: 50, minimumFare: 15000 },
};

export let VEHICLE_RULES: Record<FareVehicle, VehicleRule> = { ...DEFAULT_VEHICLE_RULES };

export function getActiveVehicleRules(): Record<FareVehicle, VehicleRule> {
  try {
    if (typeof (pilotDb as any)?.getVehicleRules === 'function') {
      const custom = pilotDb.getVehicleRules();
      if (custom && Object.keys(custom).length > 0) {
        return custom as Record<FareVehicle, VehicleRule>;
      }
    }
  } catch {}
  return VEHICLE_RULES;
}

const LONG_DISTANCE_AFTER_KM = 20;   // km beyond this are charged at a lower rate
const LONG_DISTANCE_RATE_FACTOR = 0.7;
const ROUND_TO_NAIRA = 50;
export const MAX_AUTO_QUOTE_KM = 250; // longer trips need a manual quote
const QUOTE_TTL_MS = 10 * 60 * 1000;  // quote (price lock) lifetime
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  source: 'openrouteservice' | 'estimate';
}

// ---------- validation ----------
export function parseCoords(v: unknown): LatLng | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const lat = Number(v[0]);
  const lng = Number(v[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Rough Nigeria bounding box: blocks junk input and stray API-quota use
  if (lat < 4 || lat > 14 || lng < 2.5 || lng > 15) return null;
  return [lat, lng];
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- routing (OpenRouteService) with cache + safe fallback ----------
const routeCache = new Map<string, { route: RouteInfo; at: number }>();
const ROUTE_CACHE_MS = 60 * 60 * 1000;

function cacheKey(a: LatLng, b: LatLng): string {
  const r = (n: number) => n.toFixed(4); // ~11 m precision
  return `${r(a[0])},${r(a[1])}>${r(b[0])},${r(b[1])}`;
}

export async function getRoute(pickup: LatLng, dropoff: LatLng): Promise<RouteInfo> {
  const key = cacheKey(pickup, dropoff);
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < ROUTE_CACHE_MS && hit.route.source === 'openrouteservice') {
    return hit.route;
  }

  const apiKey = process.env.ORS_API_KEY;
  if (apiKey && apiKey.trim()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const resp = await fetch(ORS_URL, {
        method: 'POST',
        headers: { Authorization: apiKey.trim(), 'Content-Type': 'application/json' },
        // ORS wants [lng, lat]; radiuses lets it snap points that are off the road
        body: JSON.stringify({
          coordinates: [[pickup[1], pickup[0]], [dropoff[1], dropoff[0]]],
          radiuses: [1500, 1500],
        }),
        signal: ctrl.signal,
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const s = data?.routes?.[0]?.summary;
        if (s && Number.isFinite(s.distance) && Number.isFinite(s.duration)) {
          const route: RouteInfo = {
            distanceKm: Math.round((s.distance / 1000) * 10) / 10,
            durationMin: Math.max(1, Math.round(s.duration / 60)),
            source: 'openrouteservice',
          };
          routeCache.set(key, { route, at: Date.now() });
          return route;
        }
      } else {
        console.warn(`[FareEngine] ORS responded ${resp.status}`);
      }
    } catch (err: any) {
      console.warn('[FareEngine] ORS request failed:', err?.name === 'AbortError' ? 'timeout' : err?.message);
    } finally {
      clearTimeout(timer);
    }
  } else {
    console.warn('[FareEngine] ORS_API_KEY not set, using straight-line estimate');
  }

  // Fallback: straight-line x road factor (clearly marked approximate)
  const km = Math.round(haversineKm(pickup, dropoff) * 1.35 * 10) / 10;
  const speed = km > 30 ? 60 : 35; // km/h
  return { distanceKm: km, durationMin: Math.max(1, Math.round((km / speed) * 60)), source: 'estimate' };
}

// ---------- pricing ----------
function roundFare(n: number): number {
  return Math.round(n / ROUND_TO_NAIRA) * ROUND_TO_NAIRA;
}

export function computeFare(rule: VehicleRule, km: number, minutes: number): number {
  const nearKm = Math.min(km, LONG_DISTANCE_AFTER_KM);
  const farKm = Math.max(0, km - LONG_DISTANCE_AFTER_KM);
  const distanceCost = rule.perKm * (nearKm + farKm * LONG_DISTANCE_RATE_FACTOR);
  const raw = rule.baseFare + distanceCost + rule.perMinute * minutes;
  return roundFare(Math.max(rule.minimumFare, raw));
}

/** Returns a human-readable reason if this vehicle can't take the trip, else null. */
export function vehicleIneligibleReason(
  v: FareVehicle,
  passengers: number,
  km: number,
  customRules?: Record<FareVehicle, VehicleRule>
): string | null {
  const rules = customRules || getActiveVehicleRules();
  const r = rules[v];
  if (!r) return 'Unsupported vehicle type';
  if (passengers > r.maxSeats) return `Carries at most ${r.maxSeats} passengers (+1 driver)`;
  if (passengers < r.minPassengersToOffer) return `Offered for groups of ${r.minPassengersToOffer} to ${r.maxSeats} passengers`;
  if (r.maxKm !== null && km > r.maxKm) return `Available for trips up to ${r.maxKm} km`;
  return null;
}

export interface RouteQuote {
  km: number;
  minutes: number;
  approximate: boolean;
  fares: Record<FareVehicle, number>;
}

export async function getRouteQuote(
  pickup: LatLng,
  dropoff: LatLng,
  customRules?: Record<FareVehicle, VehicleRule>
): Promise<RouteQuote> {
  const route = await getRoute(pickup, dropoff);
  const rules = customRules || getActiveVehicleRules();
  const fares = {} as Record<FareVehicle, number>;
  (Object.keys(rules) as FareVehicle[]).forEach((v) => {
    fares[v] = computeFare(rules[v], route.distanceKm, route.durationMin);
  });
  return { km: route.distanceKm, minutes: route.durationMin, approximate: route.source !== 'openrouteservice', fares };
}

export function listOptions(
  q: RouteQuote,
  passengers: number,
  customRules?: Record<FareVehicle, VehicleRule>
) {
  const rules = customRules || getActiveVehicleRules();
  const seatCount = Math.max(1, passengers || 1);
  const options: { category: FareVehicle; label: string; fareNaira: number; perSeatFare: number; passengers: number; maxSeats: number }[] = [];
  const unavailable: { category: FareVehicle; label: string; reason: string }[] = [];
  (Object.keys(rules) as FareVehicle[]).forEach((v) => {
    const reason = vehicleIneligibleReason(v, seatCount, q.km, rules);
    const rule = rules[v];
    if (reason) {
      unavailable.push({ category: v, label: rule.label, reason });
    } else {
      const perSeatFare = q.fares[v];
      const totalFare = perSeatFare * seatCount;
      options.push({
        category: v,
        label: rule.label,
        fareNaira: totalFare,
        perSeatFare,
        passengers: seatCount,
        maxSeats: rule.maxSeats,
      });
    }
  });
  return { options, unavailable };
}

// ---------- signed quote token (locks the price for 10 minutes) ----------
let memoryFallbackSecret: string | null = null;
function getQuoteSecret(): string {
  if (process.env.QUOTE_SECRET && process.env.QUOTE_SECRET.trim().length > 0) {
    return process.env.QUOTE_SECRET.trim();
  }
  if (!memoryFallbackSecret) {
    memoryFallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[FareEngine] QUOTE_SECRET not found in env: using memory secret');
  }
  return memoryFallbackSecret;
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (payload: string) => crypto.createHmac('sha256', getQuoteSecret()).update(payload).digest('base64url');

export function createQuoteToken(pickup: LatLng, dropoff: LatLng, q: RouteQuote): string {
  const payload = b64(JSON.stringify({ p: pickup, d: dropoff, km: q.km, m: q.minutes, a: q.approximate, f: q.fares, exp: Date.now() + QUOTE_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

/** Returns the locked quote only if signature, expiry and both locations match. */
export function verifyQuoteToken(token: unknown, pickup: LatLng, dropoff: LatLng): RouteQuote | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!d || Date.now() > d.exp) return null;
    if (haversineKm(pickup, d.p) > 0.15 || haversineKm(dropoff, d.d) > 0.15) return null; // within 150 m
    return { km: d.km, minutes: d.m, approximate: !!d.a, fares: d.f };
  } catch {
    return null;
  }
}
