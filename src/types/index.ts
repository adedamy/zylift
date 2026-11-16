export type VehicleCategory =
  | 'keke'
  | 'okada'
  | 'cab_go'
  | 'small_bus'
  | 'big_bus'
  | 'danfo_xl'
  | 'comfort'
  | 'dispatch';

export type RideStatus =
  | 'idle'
  | 'selecting_ride'
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'in_ride'
  | 'arrived'
  | 'rating';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'wallet' | 'cash' | 'transfer';

export interface LocationPoint {
  id: string;
  name: string;
  address: string;
  city: 'Minna' | 'Lagos' | 'Abuja' | string;
  area: string;
  lat: number;
  lng: number;
  isPopular?: boolean;
  lga?: 'Bosso' | 'Chanchaga' | string;
  category?: 'Campus' | 'Transit Hub' | 'Market' | 'Medical' | 'Government' | 'Residential' | string;
  description?: string;
}

export interface RideOption {
  id: VehicleCategory;
  name: string;
  subtitle: string;
  category: 'Okada' | 'Tricycle' | 'Car' | 'Small Bus' | 'Big Bus' | 'Van' | 'Courier';
  basePrice: number;
  perKm: number;
  perMinute: number;
  surgeMultiplier: number;
  etaMinutes: number;
  capacity: number;
  tagline: string;
  iconType: 'bike' | 'keke' | 'car' | 'small_bus' | 'big_bus' | 'comfort' | 'van' | 'box';
  trafficAdvantage: string; // e.g. "Direct campus transit"
  requiresHelmet?: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  totalTrips: number;
  avatarUrl: string;
  vehicleCategory: VehicleCategory;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleColor: string;
  isNINVerified: boolean;
  isLasdriCertified: boolean;
  hasSanitizedHelmet: boolean;
  currentLocation: {
    lat: number;
    lng: number;
    heading: number;
  };
  speedKmH: number;
}

export interface TripState {
  id: string;
  pickup: LocationPoint;
  destination: LocationPoint;
  category: VehicleCategory;
  fareNaira: number;
  paymentMethod: PaymentGateway;
  driver: Driver | null;
  status: RideStatus;
  safetyPin: string; // 4-digit PIN
  startedAt?: Date;
  estimatedArrivalMinutes: number;
  distanceKm: number;
  trafficLevel: 'low' | 'moderate' | 'heavy_go_slow';
  routeCoordinates: [number, number][];
  driverProgress: number; // 0 to 1
}

export interface OfflineCityRegion {
  id: string;
  name: string;
  city: string;
  sizeMb: number;
  isDownloaded: boolean;
  tileCount: number;
  lastUpdated: string;
}

export interface WalletTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  gateway?: 'Paystack' | 'Flutterwave';
  status: 'successful' | 'pending';
}

export interface DriverWalletTransaction {
  id: string;
  amount: number;
  type: 'transfer_received' | 'withdrawal' | 'bonus' | 'adjustment';
  tripId?: string;
  riderName?: string;
  reference?: string;
  note?: string;
  status: 'successful' | 'pending';
  createdAt: string;
}

export interface PricingConfig {
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  surgeMultiplier: number; // 1.0 to 2.5
  campusLevy?: number; // 0 Naira for campus pilot
  platformCommissionPct: number; // default 15% (the platform's cut on cash & card)
}

export interface CashCollectionRecord {
  tripId: string;
  driverName: string;
  driverPlate: string;
  expectedAmount: number;
  actualCollected: number;
  platformCommission: number;
  driverNetEarnings: number;
  driverWalletBalanceBefore: number;
  driverWalletBalanceAfter: number;
  settledAt: string;
  driverRemitted: boolean;
}

export interface DriverApplicant {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  city: 'Minna' | 'Lagos' | 'Abuja' | string;
  vehicleCategory: VehicleCategory;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleYear: string;
  ninNumber: string;
  lasdriNumber: string;
  bankName: string;
  accountNumber: string;
  avatarUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  hasHelmetPhoto: boolean;
  appliedDate: string;
  walletBalance: number;
  totalTrips: number;
  rating: number;
}


