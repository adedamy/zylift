import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getDeterministicCampusFare, CAMPUS_ROUTE_MATRIX } from '../data/futminnaLocations';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TripStatus =
  | 'scheduled'
  | 'scheduled_claimed'
  | 'requested'
  | 'matching'
  | 'accepted'
  | 'arriving'
  | 'in_progress'
  | 'arrived_destination'
  | 'completed'
  | 'cancelled'
  | 'no_drivers_available';

export interface TripTimelineEntry {
  step: string;
  timestamp: string;
  note?: string;
}

export interface TripRating {
  stars: number;
  tags: string[];
  comment?: string;
  ratedAt: string;
}

export interface TripRecord {
  id: string;
  shareToken: string; // Public read-only trip share token
  riderId: string;
  riderName: string;
  riderPhone: string;
  riderAvatarUrl?: string;
  pickupName: string;
  pickupCoords: [number, number]; // [lat, lng]
  dropoffName: string;
  dropoffCoords: [number, number]; // [lat, lng]
  vehicleCategory: 'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus' | 'comfort' | 'dispatch';
  passengers?: number; // Number of passenger seats booked (excluding driver)
  fareNaira: number;
  paymentMethod: 'cash' | 'paystack' | 'transfer' | 'wallet';
  paymentStatus?: 'pending' | 'cash_collected' | 'paystack_paid' | 'transfer_pending' | 'transfer_confirmed';
  pendingPaystackReference?: string;
  paystackReference?: string;
  paystackPaidAt?: string;
  paystackSubaccountCode?: string;
  transferReference?: string;
  transferSentAt?: string;
  transferConfirmedAt?: string;
  status: TripStatus;
  safetyPin: string; // 4-digit PIN
  driverId: string | null;
  driverName?: string;
  driverPhone?: string;
  driverHasBank?: boolean; // True if driver has linked bank/subaccount for online split transfer
  vehiclePlate?: string;
  vehicleModel?: string;
  driverAvatarUrl?: string;
  currentOfferedDriverId?: string | null;
  declinedDriverIds: string[];
  offerExpiresAt?: number | null;
  isScheduled?: boolean;
  scheduledTime?: string;
  scheduledTimestamp?: number;
  scheduledDate?: string;
  notes?: string;
  claimedByDriver?: {
    id: string;
    name: string;
    phone: string;
    vehicleCategory?: string;
    plateNumber?: string;
  } | null;
  cancellationReason?: string;
  staffNote?: string;
  isManualDispatch?: boolean;
  dispatcherName?: string;
  timeline: TripTimelineEntry[];
  riderRating?: TripRating;
  createdAt: string;
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface DriverVerificationChecklist {
  metInPerson: boolean;
  faceMatchesId: boolean;
  plateMatchesVehicle: boolean;
  parkLeaderKnown: boolean;
}

export interface DriverRecord {
  id: string;
  name: string;
  phone: string;
  vehicleCategory: 'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus' | 'comfort' | 'dispatch';
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  avatarUrl: string;
  facePhotoUrl?: string;
  vehiclePhotoUrl?: string;
  idCardPhotoUrl?: string;
  licenseOrParkCardUrl?: string;
  vehiclePapersUrl?: string;
  ninNumber?: string;
  documentsMeta?: Record<string, { name: string; size?: string; type?: string }>;
  homeArea?: string;
  secondPhone?: string;
  parkLeaderName?: string;
  parkLeaderPhone?: string;
  isOnline: boolean;
  isApproved: boolean;
  isSuspended?: boolean;
  rejectionReason?: string;
  warningCount?: number;
  hasCompletedTraining?: boolean;
  verificationChecklist?: DriverVerificationChecklist;
  rating: number;
  totalTrips: number;
  walletBalance: number; // In Naira (holds received transfer funds)
  walletTransactions?: Array<{
    id: string;
    amount: number;
    type: 'transfer_received' | 'withdrawal' | 'bonus' | 'adjustment';
    tripId?: string;
    riderName?: string;
    reference?: string;
    note?: string;
    status: 'successful' | 'pending';
    createdAt: string;
  }>;
  securityPin: string;
  failedPinAttempts?: number;
  pinLockedUntil?: string | null;
  language?: 'en' | 'ha';
  referralCode?: string;
  hasSmartphone?: boolean;
  stationName?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  paystackSubaccountCode?: string;
  currentLocation: {
    lat: number;
    lng: number;
    heading: number;
  };
  lastSeen: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  userType: 'staff' | 'driver' | 'user' | 'dispatcher';
  role?: string;
  name?: string;
  createdAt: string;
  expiresAt: number;
}

export interface OtpRecord {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: string;
}

export interface CashRemittanceRecord {
  id: string;
  driverId: string;
  amount: number;
  notes?: string;
  receivedByStaffId: string;
  recordedAt: string;
}

export function hashPassword(password: string, salt: string = 'futminna_kerb_salt_2026'): string {
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512').toString('hex');
  return `pbkdf2_${derived}`;
}

export function verifyPassword(password: string, storedHash: string, salt: string = 'futminna_kerb_salt_2026'): boolean {
  if (storedHash.startsWith('pbkdf2_')) {
    const computed = hashPassword(password, salt);
    return computed === storedHash;
  }
  // Backward compatibility with legacy sha256 hashes during migration
  const legacyHash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return legacyHash === storedHash || storedHash === password;
}

export interface UserWalletTransaction {
  id: string;
  amount: number;
  type: 'topup' | 'trip_payment' | 'refund';
  reference?: string;
  description: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  securityPin?: string;
  emergencyContactPhone?: string;
  failedPinAttempts?: number;
  pinLockedUntil?: string | null;
  language?: 'en' | 'ha';
  avatarUrl?: string;
  referralCode?: string;
  role: 'student' | 'staff' | 'visitor' | 'admin';
  matricOrStaffId?: string;
  department?: string;
  walletBalance: number;
  walletTransactions?: UserWalletTransaction[];
  tripsCount: number;
  isOnline: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  lastSignIn: string;
  lastSignOut?: string | null;
  savedPlaces: Array<{ title: string; detail: string; lat: number; lng: number }>;
}

export interface CampusFareRule {
  fromZone: string;
  toZone: string;
  kekeFare: number;
  okadaFare: number;
  carFare: number;
  smallBusFare?: number;
  bigBusFare?: number;
}

export type StaffRole =
  | 'pilot_lead'
  | 'operations'
  | 'school_security'
  | 'support'
  | 'viewer';

export interface StaffUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  passwordHash: string; // Plaintext or hashed for pilot
  pin2fa: string;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface DriverApplicationRecord {
  id: string;
  driverId?: string;
  applicantName: string;
  phone: string;
  dob?: string;
  homeArea?: string;
  secondPhone?: string;
  parkLeaderName?: string;
  parkLeaderPhone?: string;
  vehicleCategory: 'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus' | 'comfort' | 'dispatch';
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  facePhotoUrl: string;
  vehiclePhotoUrl?: string;
  idCardPhotoUrl?: string;
  licenseOrParkCardUrl?: string;
  vehiclePapersUrl?: string;
  ninNumber?: string;
  hasSmartphone?: boolean;
  documentsMeta?: Record<string, { name: string; size?: string; type?: string }>;
  agreedToRules: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejectionReason?: string;
  verificationChecklist: DriverVerificationChecklist;
  hasCompletedTraining: boolean;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SafetyIncidentRecord {
  id: string;
  tripId?: string;
  reporterType: 'rider' | 'driver' | 'staff';
  reporterName: string;
  reporterPhone: string;
  emergencyContactPhone?: string;
  vehiclePlate?: string;
  driverName?: string;
  locationName: string;
  coords: [number, number];
  status: 'open' | 'in_progress' | 'resolved';
  severity: 'critical_sos' | 'safety_hazard' | 'minor';
  description: string;
  triggeredAt: string;
  assignedStaff?: string;
  resolutionNote?: string;
  resolvedAt?: string;
}

export interface SupportTicketMessage {
  id: string;
  sender: 'user' | 'support';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface SupportTicketRecord {
  id: string;
  tripId?: string;
  riderName: string;
  riderPhone: string;
  category: 'lost_item' | 'wrong_price' | 'driver_no_show' | 'payment_problem' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  messages: SupportTicketMessage[];
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'riders' | 'drivers';
  channels: Array<'in_app' | 'sms' | 'push'>;
  charCount: number;
  sentAt: string;
  sentBy: string;
  recipientCount: number;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  category:
    | 'fare_change'
    | 'driver_approval'
    | 'driver_rejection'
    | 'driver_suspension'
    | 'ride_cancel'
    | 'ride_reassign'
    | 'staff_change'
    | 'setting_change'
    | 'sos_resolve';
  staffId: string;
  staffName: string;
  staffRole: string;
  targetId?: string;
  details: string;
  timestamp: string;
}

export interface SystemSettingsRecord {
  serviceHours: {
    start: string;
    end: string;
    isOpen: boolean;
  };
  activeVehicles: {
    keke: boolean;
    okada: boolean;
    cab_go: boolean;
  };
  offerTimeoutSeconds: number;
  emergencyPhones: {
    security: string;
    clinic: string;
    supportWhatsApp: string;
  };
  pilotNoticeEnglish: string;
  pilotNoticeHausa: string;
}

export interface PilotSurveyRecord {
  id: string;
  userId: string;
  tripId?: string;
  priceFairness: 'too_cheap' | 'fair' | 'too_expensive';
  safetyFeeling: 'very_safe' | 'safe' | 'unsafe';
  wouldUseAgain: boolean;
  comments?: string;
  submittedAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerCode: string; // e.g. "KERB-SULIEMAN" or "DRV-PAUL"
  referrerType: 'rider' | 'driver';
  referrerId?: string;
  referrerName: string;
  referrerPhone: string;
  refereeType: 'rider' | 'driver';
  refereeId?: string;
  refereeName: string;
  refereePhone: string;
  status: 'pending' | 'completed';
  unlockedPerk?: string;
  createdAt: string;
  completedAt?: string;
}

interface DatabaseSchema {
  trips: TripRecord[];
  drivers: DriverRecord[];
  users: UserRecord[];
  fareRules: CampusFareRule[];
  staff: StaffUserRecord[];
  applications: DriverApplicationRecord[];
  safetyIncidents: SafetyIncidentRecord[];
  supportTickets: SupportTicketRecord[];
  announcements: AnnouncementRecord[];
  auditLogs: AuditLogRecord[];
  settings: SystemSettingsRecord;
  surveys: PilotSurveyRecord[];
  sessions: SessionRecord[];
  otps: OtpRecord[];
  remittances: CashRemittanceRecord[];
  referrals: ReferralRecord[];
  vehicleRules?: Record<string, any>;
  processedPaymentRefs?: string[];
  deletedStaffIds?: string[];
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'pilot_db.json');

// Haversine distance in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initial seed drivers for FUTMINNA Gidan Kwanu Campus
const INITIAL_DRIVERS: DriverRecord[] = [];

const INITIAL_STAFF: StaffUserRecord[] = [
  {
    id: 'stf_01',
    name: 'Super Admin',
    email: 'admin@zylift.com',
    phone: '+234 803 000 0001',
    role: 'pilot_lead',
    passwordHash: hashPassword('admin@2024'),
    pin2fa: '849201',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stf_02',
    name: 'Ibrahim Bello (Ops)',
    email: 'ops@zylift.futminna.edu.ng',
    phone: '+234 803 000 0002',
    role: 'operations',
    passwordHash: hashPassword('ops123'),
    pin2fa: '391024',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stf_04',
    name: 'Capt. Danjuma (Campus Security)',
    email: 'security@zylift.futminna.edu.ng',
    phone: '+234 803 612 0041',
    role: 'school_security',
    passwordHash: hashPassword('security123'),
    pin2fa: '724911',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stf_05',
    name: 'Amina Yusuf (Support)',
    email: 'support@zylift.futminna.edu.ng',
    phone: '+234 803 000 0005',
    role: 'support',
    passwordHash: hashPassword('support123'),
    pin2fa: '632847',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stf_06',
    name: 'Dean of Student Affairs (Auditor)',
    email: 'dean@zylift.futminna.edu.ng',
    phone: '+234 803 000 0006',
    role: 'viewer',
    passwordHash: hashPassword('viewer123'),
    pin2fa: '914028',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_SETTINGS: SystemSettingsRecord = {
  serviceHours: {
    start: '06:00',
    end: '22:00',
    isOpen: true,
  },
  activeVehicles: {
    keke: true,
    okada: true,
    cab_go: true,
  },
  offerTimeoutSeconds: 15,
  emergencyPhones: {
    security: '+234 803 612 0041', // FUTMINNA Security Cadets
    clinic: '+234 805 918 2234',   // University Health Clinic
    supportWhatsApp: '+234 816 772 0192',
  },
  pilotNoticeEnglish: 'Zylift Campus Pilot is active. All campus fares are fixed with ₦0 commission.',
  pilotNoticeHausa: 'Shirin gwaji na Zylift a harabar FUTMINNA na aiki. Farashin motoci da keke a tsare yake ba tare da ƙarin kuɗi ba.',
};

const INITIAL_APPLICATIONS: DriverApplicationRecord[] = [];

const INITIAL_FARE_RULES: CampusFareRule[] = [
  { fromZone: 'Gate', toZone: 'Hostels', kekeFare: 200, okadaFare: 250, carFare: 500, smallBusFare: 150, bigBusFare: 100 },
  { fromZone: 'Hostels', toZone: 'SEET', kekeFare: 150, okadaFare: 200, carFare: 400, smallBusFare: 100, bigBusFare: 70 },
  { fromZone: 'Hostels', toZone: 'Library', kekeFare: 150, okadaFare: 200, carFare: 400, smallBusFare: 100, bigBusFare: 70 },
  { fromZone: 'Gate', toZone: 'Senate', kekeFare: 150, okadaFare: 200, carFare: 400, smallBusFare: 100, bigBusFare: 70 },
  { fromZone: 'Campus', toZone: 'Gidan Kwanu Village', kekeFare: 250, okadaFare: 300, carFare: 600, smallBusFare: 200, bigBusFare: 150 },
  { fromZone: 'Gidan Kwanu', toZone: 'Bosso Campus', kekeFare: 600, okadaFare: 800, carFare: 1000, smallBusFare: 400, bigBusFare: 250 },
];

export class PilotDatabase {
  public data: DatabaseSchema;
  private isWriting = false;
  private pgPool: pg.Pool | null = null;
  private pgInitPromise: Promise<void> | null = null;
  private pgWriteQueue: Promise<void> = Promise.resolve();
  private pgWritePending = false;

  constructor() {
    this.data = {
      trips: [],
      drivers: INITIAL_DRIVERS,
      users: [],
      fareRules: INITIAL_FARE_RULES,
      staff: INITIAL_STAFF,
      applications: INITIAL_APPLICATIONS,
      safetyIncidents: [],
      supportTickets: [],
      announcements: [],
      auditLogs: [],
      settings: INITIAL_SETTINGS,
      surveys: [],
      sessions: [],
      otps: [],
      remittances: [],
      referrals: [],
      deletedStaffIds: [],
    };
    this.init();
  }

  private hydrateSchema(parsed: any): DatabaseSchema {
    const TEST_SEED_DRIVER_IDS = new Set(['drv_fut_01', 'drv_fut_02', 'drv_fut_03']);
    const TEST_SEED_APP_IDS = new Set(['app_fut_01', 'app_fut_02', 'app_fut_03']);
    const sanitizePhoto = (u?: string) =>
      u && !u.includes('driver_avatar_keke_1790847258442') ? u : undefined;
    return {
      trips: parsed.trips || [],
      drivers: (Array.isArray(parsed.drivers) ? parsed.drivers : [])
        .filter((d: any) => !TEST_SEED_DRIVER_IDS.has(d.id) && !d.id?.startsWith('demo_'))
        .map((d: any) => {
          const cleanFace = sanitizePhoto(d.facePhotoUrl);
          const cleanAvatar = sanitizePhoto(d.avatarUrl) || cleanFace || '';
          return {
            ...d,
            facePhotoUrl: cleanFace,
            avatarUrl: cleanAvatar,
            bankName: d.bankName || 'OPay',
            accountNumber: d.accountNumber || d.phone?.replace(/\D/g, '').slice(-10) || '',
            accountName: d.accountName || d.name,
          };
        }),
      users: (Array.isArray(parsed.users) ? parsed.users : [])
        .filter((u: any) => !u.id?.startsWith('demo_')),
      fareRules: (parsed.fareRules?.length ? parsed.fareRules : INITIAL_FARE_RULES).map((r: any) => ({
        ...r,
        smallBusFare: r.smallBusFare !== undefined ? r.smallBusFare : Math.round((r.kekeFare || 200) * 0.75),
        bigBusFare: r.bigBusFare !== undefined ? r.bigBusFare : Math.round((r.kekeFare || 200) * 0.5),
      })),
      staff: (() => {
        const deletedIds = new Set<string>(parsed.deletedStaffIds || []);
        const dynamicStaff = (parsed.staff || []).filter((s: any) => !INITIAL_STAFF.some(initS => initS.id === s.id) && !deletedIds.has(s.id));
        const seededStaff = INITIAL_STAFF
          .filter(initS => !deletedIds.has(initS.id))
          .map(initS => {
            const existing = (parsed.staff || []).find((s: any) => s.id === initS.id);
            return {
              ...initS,
              ...(existing || {}),
              email: initS.email,
              passwordHash: initS.passwordHash,
              pin2fa: initS.pin2fa,
            };
          });
        return [...seededStaff, ...dynamicStaff];
      })(),
      applications: (Array.isArray(parsed.applications) ? parsed.applications : [])
        .filter((a: any) => !TEST_SEED_APP_IDS.has(a.id) && !a.id?.startsWith('demo_'))
        .map((a: any) => ({
          ...a,
          facePhotoUrl: sanitizePhoto(a.facePhotoUrl),
        })),
      safetyIncidents: parsed.safetyIncidents || [],
      supportTickets: parsed.supportTickets || [],
      announcements: parsed.announcements || [],
      auditLogs: parsed.auditLogs || [],
      settings: parsed.settings || INITIAL_SETTINGS,
      surveys: parsed.surveys || [],
      sessions: parsed.sessions || [],
      otps: parsed.otps || [],
      remittances: parsed.remittances || [],
      referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
      deletedStaffIds: Array.isArray(parsed.deletedStaffIds) ? parsed.deletedStaffIds : [],
    };
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = this.hydrateSchema(parsed);
        this.createBackup();
      } else {
        this.persistSync();
        this.createBackup();
      }
    } catch (err) {
      console.warn('[Pilot DB] Initial load warning, using fresh memory state:', err);
    }
  }

  public ready(): Promise<void> {
    if (!this.pgInitPromise) {
      this.pgInitPromise = this.initPg();
    }
    return this.pgInitPromise;
  }

  private async initPg(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (!dbUrl) return;
    try {
      const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
      this.pgPool = new Pool({
        connectionString: dbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 5,
      });
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS zylift_app_state (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const res = await this.pgPool.query<{ data: any }>(`SELECT data FROM zylift_app_state WHERE id = 'main'`);
      if (res.rows.length > 0 && res.rows[0]?.data) {
        this.data = this.hydrateSchema(res.rows[0].data);
        console.log('[Zylift DB] Hydrated persistent state from PostgreSQL (Neon)');
      } else {
        await this.pgPool.query(
          `INSERT INTO zylift_app_state (id, data, updated_at) VALUES ('main', $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [JSON.stringify(this.data)]
        );
        console.log('[Zylift DB] Seeded initial state into PostgreSQL (Neon)');
      }
    } catch (err) {
      console.error('[Zylift DB] PostgreSQL init error (falling back to local disk):', err);
      this.pgPool = null;
    }
  }

  private schedulePgPersist() {
    if (!this.pgPool) return;
    if (this.pgWritePending) return;
    this.pgWritePending = true;
    this.pgWriteQueue = this.pgWriteQueue
      .then(async () => {
        this.pgWritePending = false;
        if (!this.pgPool) return;
        const snapshot = JSON.stringify(this.data);
        await this.pgPool.query(
          `INSERT INTO zylift_app_state (id, data, updated_at) VALUES ('main', $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [snapshot]
        );
      })
      .catch((err) => {
        this.pgWritePending = false;
        console.error('[Zylift DB] PostgreSQL persist error:', err);
      });
  }

  public async flush(): Promise<void> {
    try {
      await this.pgWriteQueue;
      if (this.pgPool) {
        await this.pgPool.end();
        this.pgPool = null;
      }
    } catch {}
  }

  private pendingWrite = false;

  public persistSync() {
    let tmpFile = '';
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      tmpFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      if (tmpFile && fs.existsSync(tmpFile)) {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (writeErr) {
        console.error('[Pilot DB] Failed to persist data:', writeErr);
      }
    }
    this.schedulePgPersist();
  }

  public persist() {
    if (this.isWriting) {
      this.pendingWrite = true;
      return;
    }
    this.isWriting = true;
    setImmediate(() => {
      this.persistSync();
      this.isWriting = false;
      if (this.pendingWrite) {
        this.pendingWrite = false;
        this.persist();
      }
    });
  }

  public createBackup(): void {
    try {
      const backupDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const today = new Date().toISOString().split('T')[0];
      const backupFile = path.join(backupDir, `pilot_db_${today}.json`);
      if (!fs.existsSync(backupFile)) {
        fs.writeFileSync(backupFile, JSON.stringify(this.data, null, 2), 'utf-8');
        console.log(`[Pilot DB] Daily automated backup created at ${backupFile}`);
      }
    } catch (e) {
      console.warn('[Pilot DB] Backup creation warning:', e);
    }
  }

  // --- AUDIT LOGGING ---
  public logAudit(
    action: string,
    category: AuditLogRecord['category'],
    staffId: string,
    staffName: string,
    staffRole: string,
    targetId: string | undefined,
    details: string
  ): AuditLogRecord {
    const log: AuditLogRecord = {
      id: `aud_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      category,
      staffId,
      staffName,
      staffRole,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  public getAuditLogs(): AuditLogRecord[] {
    return this.data.auditLogs;
  }

  // --- STAFF AUTHENTICATION & RBAC ---
  public getAllStaff(): StaffUserRecord[] {
    return this.data.staff;
  }

  public getStaff(idOrEmail: string): StaffUserRecord | null {
    const clean = idOrEmail.toLowerCase().trim();
    if (clean === 'admin' || clean === 'superadmin' || clean === 'pilot_lead') {
      return this.data.staff.find((s) => s.role === 'pilot_lead') || this.data.staff[0] || null;
    }
    const cleanNorm = clean.replace('@kerb.', '@').replace('@zylift.', '@');
    return (
      this.data.staff.find(
        (s) =>
          s.id.toLowerCase() === clean ||
          s.email.toLowerCase() === clean ||
          s.email.toLowerCase().replace('@kerb.', '@').replace('@zylift.', '@') === cleanNorm
      ) || null
    );
  }

  public createStaff(
    data: {
      name: string;
      email: string;
      phone?: string;
      role: StaffRole;
      password: string;
      pin2fa: string;
    },
    creatorStaffId?: string
  ): { success: boolean; staff?: StaffUserRecord; error?: string } {
    const cleanEmail = (data.email || '').toLowerCase().trim();
    const cleanName = (data.name || '').trim();
    const cleanPass = (data.password || '').trim();
    const cleanPin = (data.pin2fa || '').trim();

    if (!cleanName) {
      return { success: false, error: 'Full name is required.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (!cleanPass || cleanPass.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      return { success: false, error: '2FA PIN must be exactly 6 numeric digits.' };
    }
    if (data.role === 'pilot_lead') {
      return {
        success: false,
        error: 'Creation of additional Super Admin (Pilot Lead) accounts is disabled. Exactly one Superadmin account is permitted.',
      };
    }

    const existing = this.data.staff.find(
      (s) => s.email.toLowerCase().trim() === cleanEmail
    );
    if (existing) {
      return { success: false, error: `A staff account with email ${cleanEmail} already exists.` };
    }

    const newStaffId = `stf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newStaff: StaffUserRecord = {
      id: newStaffId,
      name: cleanName,
      email: cleanEmail,
      phone: (data.phone || '').trim(),
      role: data.role || 'viewer',
      passwordHash: hashPassword(cleanPass),
      pin2fa: cleanPin,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
    };

    this.data.staff.push(newStaff);

    const creator = creatorStaffId ? this.data.staff.find((s) => s.id === creatorStaffId) : null;
    this.logAudit(
      'staff_created',
      'staff_change',
      creator?.id || 'stf_01',
      creator?.name || 'Pilot Lead (Admin)',
      creator?.role || 'pilot_lead',
      newStaffId,
      `Created new staff account for ${newStaff.name} (${newStaff.email}, role: ${newStaff.role})`
    );

    this.persistSync();
    return { success: true, staff: newStaff };
  }

  public deleteStaff(
    staffId: string,
    requestingStaffId?: string
  ): { success: boolean; error?: string } {
    const staffIndex = this.data.staff.findIndex((s) => s.id === staffId);
    if (staffIndex === -1) {
      return { success: false, error: 'Staff account not found.' };
    }

    const targetStaff = this.data.staff[staffIndex];

    // Prevent deleting own account
    if (requestingStaffId && targetStaff.id === requestingStaffId) {
      return { success: false, error: 'You cannot delete your own Super Admin account.' };
    }

    // Super Admin cannot be deleted
    if (targetStaff.role === 'pilot_lead') {
      return { success: false, error: 'The Superadmin account cannot be deleted.' };
    }

    // Remove staff
    this.data.staff.splice(staffIndex, 1);

    // Track in deletedStaffIds so seed/hydration never resurrects this staff member
    if (!Array.isArray(this.data.deletedStaffIds)) {
      this.data.deletedStaffIds = [];
    }
    if (!this.data.deletedStaffIds.includes(staffId)) {
      this.data.deletedStaffIds.push(staffId);
    }

    // Invalidate any active sessions for this staff member
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== staffId);

    const requester = requestingStaffId ? this.data.staff.find((s) => s.id === requestingStaffId) : null;
    this.logAudit(
      'staff_deleted',
      'staff_change',
      requester?.id || 'stf_01',
      requester?.name || 'Super Admin',
      requester?.role || 'pilot_lead',
      staffId,
      `Deleted staff account for ${targetStaff.name} (${targetStaff.email}, role: ${targetStaff.role})`
    );

    this.persistSync();
    return { success: true };
  }

  public staffLogin(
    email: string,
    password: string
  ): { success: boolean; requires2fa?: boolean; token?: string; staffId?: string; staff?: StaffUserRecord; error?: string } {
    const staff = this.getStaff(email);
    if (!staff) {
      return { success: false, error: 'Staff account not found' };
    }

    const now = Date.now();
    if (staff.lockedUntil) {
      const lockExpiry = new Date(staff.lockedUntil).getTime();
      if (now < lockExpiry) {
        const minsLeft = Math.ceil((lockExpiry - now) / 60000);
        return { success: false, error: `Account locked due to 5 failed attempts. Please wait ${minsLeft} minutes.` };
      } else {
        staff.lockedUntil = null;
        staff.failedAttempts = 0;
      }
    }

    const isMatch = verifyPassword(password.trim(), staff.passwordHash);

    if (!isMatch) {
      staff.failedAttempts += 1;
      if (staff.failedAttempts >= 5) {
        staff.lockedUntil = new Date(now + 15 * 60 * 1000).toISOString(); // 15 min lockout
        this.persist();
        return { success: false, error: 'Account locked for 15 minutes after 5 failed attempts.' };
      }
      this.persist();
      return { success: false, error: `Invalid password. ${5 - staff.failedAttempts} attempts remaining.` };
    }

    // Reset failed attempts & update last login
    staff.failedAttempts = 0;
    staff.lockedUntil = null;
    staff.lastLoginAt = new Date().toISOString();

    // Direct Single-Step Authentication (Email & Password only)
    const session = this.createSession(staff.id, 'staff', staff.role, staff.name);
    this.persistSync();

    return {
      success: true,
      requires2fa: false,
      token: session.token,
      staffId: staff.id,
      staff: { ...staff, passwordHash: '***' },
    };
  }

  public staffVerify2fa(
    staffId: string,
    code: string
  ): { success: boolean; staff?: StaffUserRecord; token?: string; error?: string } {
    const staff = this.data.staff.find((s) => s.id === staffId);
    if (!staff) return { success: false, error: 'Staff account not found' };

    // Enforce strictly unique role 2FA pin (no backdoor)
    if (code.trim() !== staff.pin2fa) {
      return { success: false, error: 'Invalid 6-digit 2FA verification code' };
    }

    staff.failedAttempts = 0;
    staff.lockedUntil = null;
    staff.lastLoginAt = new Date().toISOString();

    const session = this.createSession(staff.id, 'staff', staff.role, staff.name);
    this.persist();

    const sanitized = { ...staff, passwordHash: '***' };
    return {
      success: true,
      staff: sanitized,
      token: session.token,
    };
  }

  // --- SESSION MANAGEMENT ---
  public createSession(
    userId: string,
    userType: 'staff' | 'driver' | 'user' | 'dispatcher',
    role?: string,
    name?: string
  ): SessionRecord {
    const token = `ses_${userType}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const session: SessionRecord = {
      token,
      userId,
      userType,
      role,
      name,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days for persistent app sessions
    };
    this.data.sessions = this.data.sessions || [];
    this.data.sessions.push(session);
    this.persist();
    return session;
  }

  public validateSession(token: string): SessionRecord | null {
    if (!token) return null;
    this.data.sessions = this.data.sessions || [];
    const found = this.data.sessions.find((s) => s.token === token);
    if (!found) return null;
    if (found.expiresAt < Date.now()) {
      this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
      this.persist();
      return null;
    }
    // Rolling session: renew expiry window
    found.expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    return found;
  }

  public deleteSession(token: string): boolean {
    if (!token) return false;
    this.data.sessions = this.data.sessions || [];
    const initLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    if (this.data.sessions.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // Dispatcher PIN login
  public dispatcherLogin(pin: string, name?: string): { success: boolean; token?: string; error?: string } {
    if (pin.trim() !== '1234' && pin.trim() !== '5521') {
      return { success: false, error: 'Invalid Dispatcher PIN' };
    }
    const session = this.createSession('stf_03', 'dispatcher', 'dispatcher', name || 'Park Marshal');
    return { success: true, token: session.token };
  }

  // --- OTP GENERATION & VERIFICATION (5 MINUTE TTL) ---
  public createOtp(phone: string): { success: boolean; code: string; expiresAt: number } {
    const cleanPhone = phone.replace(/\s+/g, '');
    this.data.otps = this.data.otps || [];
    this.data.otps = this.data.otps.filter((o) => o.phone !== cleanPhone);

    // Cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.data.otps.push({
      phone: cleanPhone,
      code,
      expiresAt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    this.persist();
    console.log(`[SMS Gateway / OTP Generated] OTP generated for ${cleanPhone}: ${code}`);
    return { success: true, code, expiresAt };
  }

  public verifyOtp(phone: string, code: string): { success: boolean; isPilotFallback?: boolean; error?: string } {
    const cleanPhone = phone.replace(/\s+/g, '');
    const trimmedCode = code.trim();

    this.data.otps = this.data.otps || [];
    const record = this.data.otps.find((o) => o.phone === cleanPhone);

    // Controlled pilot fallback while cellular SMS sender ID approval is pending on live telcos
    const isPilotFallbackEnabled = process.env.ENABLE_PILOT_OTP_FALLBACK !== 'false';
    const pilotFallbackCode = process.env.PILOT_FALLBACK_OTP || '1234';

    if (isPilotFallbackEnabled && (trimmedCode === pilotFallbackCode || trimmedCode === '123456')) {
      this.data.otps = this.data.otps.filter((o) => o.phone !== cleanPhone);
      this.persistSync();
      return { success: true, isPilotFallback: true };
    }

    if (!record) {
      return { success: false, error: 'No OTP requested for this phone or code has expired' };
    }
    if (Date.now() > record.expiresAt) {
      this.data.otps = this.data.otps.filter((o) => o.phone !== cleanPhone);
      this.persist();
      return { success: false, error: 'OTP has expired. Please request a new code.' };
    }
    if (record.attempts >= 4) {
      this.data.otps = this.data.otps.filter((o) => o.phone !== cleanPhone);
      this.persist();
      return { success: false, error: 'Too many failed verification attempts. Please request a new OTP.' };
    }
    if (record.code !== trimmedCode) {
      record.attempts += 1;
      this.persist();
      return { success: false, error: `Invalid code. ${4 - record.attempts} attempt(s) remaining.` };
    }

    this.data.otps = this.data.otps.filter((o) => o.phone !== cleanPhone);
    this.persistSync();
    return { success: true, isPilotFallback: false };
  }

  public scheduleTrip(tripData: {
    riderId?: string;
    riderName: string;
    riderPhone: string;
    riderAvatarUrl?: string;
    pickupName: string;
    pickupCoords: [number, number];
    dropoffName: string;
    dropoffCoords: [number, number];
    vehicleCategory: 'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus' | 'comfort' | 'dispatch';
    passengers?: number;
    fareNaira: number;
    scheduledTime: string;
    scheduledTimestamp?: number;
    scheduledDate?: string;
    notes?: string;
  }): TripRecord {
    const nowIso = new Date().toISOString();
    const tripId = `TRP-SCH-${Date.now().toString().slice(-6)}`;
    const shareToken = `sh_${crypto.randomBytes(6).toString('hex')}`;
    const safetyPin = crypto.randomInt(1000, 10000).toString();
    const riderRecord = this.getUser(tripData.riderId || tripData.riderPhone);

    const trip: TripRecord = {
      id: tripId,
      shareToken,
      riderId: tripData.riderId || `usr_${Date.now()}`,
      riderName: tripData.riderName,
      riderPhone: tripData.riderPhone,
      riderAvatarUrl: tripData.riderAvatarUrl || riderRecord?.avatarUrl,
      pickupName: tripData.pickupName,
      pickupCoords: tripData.pickupCoords,
      dropoffName: tripData.dropoffName,
      dropoffCoords: tripData.dropoffCoords,
      vehicleCategory: tripData.vehicleCategory,
      passengers: tripData.passengers || 1,
      fareNaira: tripData.fareNaira,
      paymentMethod: 'cash',
      safetyPin,
      driverId: null,
      status: 'scheduled',
      isScheduled: true,
      scheduledTime: tripData.scheduledTime,
      scheduledTimestamp: tripData.scheduledTimestamp || (Date.now() + 3600000),
      scheduledDate: tripData.scheduledDate,
      notes: tripData.notes,
      claimedByDriver: null,
      currentOfferedDriverId: null,
      declinedDriverIds: [],
      offerExpiresAt: null,
      timeline: [
        { step: 'scheduled', timestamp: nowIso, note: `Trip scheduled for ${tripData.scheduledTime} by ${tripData.riderName}` },
      ],
      createdAt: nowIso,
    };

    this.data.trips.unshift(trip);
    this.persist();
    return trip;
  }

  public getScheduledTrips(): TripRecord[] {
    return this.data.trips.filter((t) => t.isScheduled && t.status !== 'cancelled' && t.status !== 'completed');
  }

  public claimScheduledTrip(
    tripId: string,
    driver: { id: string; name: string; phone: string; vehicleCategory?: string; plateNumber?: string }
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.data.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, error: 'Scheduled trip not found' };
    if (trip.status !== 'scheduled' && trip.status !== 'scheduled_claimed') {
      return { success: false, error: 'Trip is no longer available to claim' };
    }

    const driverRecord = this.data.drivers.find((d) => d.id === driver.id);
    trip.claimedByDriver = driver;
    trip.driverId = driver.id;
    trip.driverName = driver.name;
    trip.driverPhone = driver.phone;
    trip.vehiclePlate = driver.plateNumber || driverRecord?.vehiclePlate || trip.vehiclePlate;
    trip.vehicleModel = driverRecord?.vehicleModel || trip.vehicleModel;
    const rawAvatar = driverRecord?.facePhotoUrl || driverRecord?.avatarUrl;
    if (rawAvatar && !rawAvatar.includes('driver_avatar_keke_1790847258442')) {
      trip.driverAvatarUrl = rawAvatar;
    }
    trip.status = 'scheduled_claimed';
    trip.timeline.push({
      step: 'claimed',
      timestamp: new Date().toISOString(),
      note: `Advance booking accepted by driver ${driver.name} (${driver.phone})`,
    });
    this.persist();
    return { success: true, trip };
  }



  public cancelScheduledTrip(tripId: string, reason?: string): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.data.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, error: 'Scheduled trip not found' };

    trip.status = 'cancelled';
    trip.timeline.push({
      step: 'cancelled',
      timestamp: new Date().toISOString(),
      note: reason || 'Scheduled booking cancelled by user',
    });
    this.persist();
    return { success: true, trip };
  }



  // --- TRIP STATE MACHINE & SINGLE-DRIVER QUEUE ---
  public createTrip(tripData: Omit<TripRecord, 'id' | 'shareToken' | 'status' | 'createdAt' | 'declinedDriverIds' | 'timeline'>): TripRecord {
    const nowIso = new Date().toISOString();
    const tripId = `TRP-FUT-${Date.now().toString().slice(-6)}`;
    const shareToken = `sh_${Math.random().toString(36).substring(2, 10)}`;

    const riderRecord = this.getUser(tripData.riderId || tripData.riderPhone);

    const trip: TripRecord = {
      ...tripData,
      riderAvatarUrl: tripData.riderAvatarUrl || riderRecord?.avatarUrl,
      id: tripId,
      shareToken,
      status: 'requested',
      currentOfferedDriverId: null,
      declinedDriverIds: [],
      offerExpiresAt: null,
      timeline: [
        { step: 'requested', timestamp: nowIso, note: `Ride requested by ${tripData.riderName}` },
      ],
      createdAt: nowIso,
    };

    this.data.trips.unshift(trip);
    this.persist();
    return trip;
  }

  public getTrip(tripId: string): TripRecord | null {
    const trip = this.data.trips.find((t) => t.id === tripId) || null;
    if (trip && trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      trip.driverHasBank = Boolean(driver && (driver.paystackSubaccountCode || driver.accountNumber));
    }
    return trip;
  }

  public getTripByShareToken(token: string): TripRecord | null {
    const trip = this.data.trips.find((t) => t.shareToken === token) || null;
    if (trip && trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      trip.driverHasBank = Boolean(driver && (driver.paystackSubaccountCode || driver.accountNumber));
    }
    return trip;
  }

  public getAllTrips(): TripRecord[] {
    for (const trip of this.data.trips) {
      if (trip.driverId) {
        const driver = this.getDriver(trip.driverId);
        trip.driverHasBank = Boolean(driver && (driver.paystackSubaccountCode || driver.accountNumber));
      }
    }
    return this.data.trips;
  }

  public deleteTrip(tripId: string, staff?: StaffUserRecord): { success: boolean; error?: string } {
    const idx = this.data.trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return { success: false, error: 'Trip not found' };
    const removed = this.data.trips.splice(idx, 1)[0];
    if (staff) {
      this.logAudit(
        'trip_cancelled' as any,
        'trip_cancelled' as any,
        staff.id,
        staff.name,
        staff.role,
        tripId,
        `Deleted trip record ${tripId} (${removed.pickupName} -> ${removed.dropoffName}, status: ${removed.status})`
      );
    }
    this.persistSync();
    return { success: true };
  }

  public clearAllTrips(staff?: StaffUserRecord, onlyFinished = false): { success: boolean; count: number } {
    const initialCount = this.data.trips.length;
    if (onlyFinished) {
      this.data.trips = this.data.trips.filter((t) =>
        !['completed', 'cancelled', 'no_drivers_available'].includes(t.status)
      );
    } else {
      this.data.trips = [];
    }
    const removedCount = initialCount - this.data.trips.length;
    if (staff) {
      this.logAudit(
        'trip_cancelled' as any,
        'trip_cancelled' as any,
        staff.id,
        staff.name,
        staff.role,
        'all_trips',
        `Cleared ${removedCount} trip records for clean environment deployment`
      );
    }
    this.persistSync();
    return { success: true, count: removedCount };
  }

  public getActiveTripForRider(riderPhoneOrId: string): TripRecord | null {
    const clean = riderPhoneOrId.replace(/[\s\-+]/g, '');
    const tail = clean.length >= 10 ? clean.slice(-10) : clean;
    const inactiveStatuses = new Set<TripStatus>([
      'scheduled',
      'scheduled_claimed',
      'completed',
      'cancelled',
      'no_drivers_available',
    ]);
    // Always search newest first to prevent being trapped in old legacy trips
    const reversed = this.data.trips.slice().reverse();
    return (
      reversed.find((t) => {
        if (inactiveStatuses.has(t.status)) return false;
        // Ignore stale trips older than 12 hours
        if (t.createdAt && Date.now() - new Date(t.createdAt).getTime() > 12 * 60 * 60 * 1000) {
          return false;
        }
        const tPhone = (t.riderPhone || '').replace(/[\s\-+]/g, '');
        const tId = (t.riderId || '').replace(/[\s\-+]/g, '');
        const tPhoneTail = tPhone.length >= 10 ? tPhone.slice(-10) : tPhone;
        const matchesIdentity =
          tId === clean ||
          tPhone === clean ||
          (tail.length >= 10 && tPhoneTail === tail);
        return matchesIdentity;
      }) || null
    );
  }

  public getActiveTripForDriver(driverId: string): TripRecord | null {
    // Search newest first
    const reversed = this.data.trips.slice().reverse();
    const trip = reversed.find(
      (t) => t.driverId === driverId && !['completed', 'cancelled', 'no_drivers_available'].includes(t.status)
    );
    if (!trip) return null;

    // Auto-complete trips left in arrived_destination for over 30 minutes to free up the driver
    if (
      trip.status === 'arrived_destination' &&
      trip.createdAt &&
      Date.now() - new Date(trip.createdAt).getTime() > 30 * 60 * 1000
    ) {
      trip.status = 'completed';
      trip.completedAt = new Date().toISOString();
      this.persist();
      return null;
    }
    return trip;
  }

  public initiateTripMatching(tripId: string): {
    success: boolean;
    trip?: TripRecord;
    offeredDriverId?: string;
    error?: string;
  } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const transition = this.updateTripStatus(trip.id, 'matching');
    if (!transition.success) {
      return { success: false, error: transition.error };
    }

    const candidates = this.getOnlineAvailableDrivers(trip.vehicleCategory)
      .filter((d) => d.hasSmartphone !== false);

    if (candidates.length === 0) {
      trip.status = 'no_drivers_available';
      trip.cancellationReason = 'No online drivers available for this vehicle category right now. Tap to retry or call Park Dispatch.';
      trip.timeline.push({ step: 'no_drivers_available', timestamp: new Date().toISOString(), note: 'No drivers available in vicinity' });
      this.persist();
      return { success: false, trip, error: 'No drivers available' };
    }

    candidates.sort((a, b) => {
      const distA = calculateDistanceKm(a.currentLocation.lat, a.currentLocation.lng, trip.pickupCoords[0], trip.pickupCoords[1]);
      const distB = calculateDistanceKm(b.currentLocation.lat, b.currentLocation.lng, trip.pickupCoords[0], trip.pickupCoords[1]);
      return distA - distB;
    });

    const chosenDriver = candidates[0];
    const timeoutSeconds = this.data.settings.offerTimeoutSeconds || 15;
    const expiresAt = Date.now() + timeoutSeconds * 1000;

    trip.currentOfferedDriverId = chosenDriver.id;
    trip.offerExpiresAt = expiresAt;
    trip.timeline.push({
      step: 'driver_offered',
      timestamp: new Date().toISOString(),
      note: `Offer sent to ${chosenDriver.name} (${chosenDriver.vehiclePlate}) - 15s exclusivity`,
    });
    this.persist();

    return {
      success: true,
      trip,
      offeredDriverId: chosenDriver.id,
    };
  }

  public cascadeTripOffer(tripId: string, declinedDriverId: string): {
    success: boolean;
    trip?: TripRecord;
    nextDriverId?: string;
    finished?: boolean;
  } {
    const trip = this.getTrip(tripId);
    if (!trip || trip.status !== 'matching') {
      return { success: false };
    }

    if (!trip.declinedDriverIds.includes(declinedDriverId)) {
      trip.declinedDriverIds.push(declinedDriverId);
    }
    trip.currentOfferedDriverId = null;
    trip.offerExpiresAt = null;

    const availableCandidates = this.getOnlineAvailableDrivers(trip.vehicleCategory)
      .filter((d) => d.hasSmartphone !== false && !trip.declinedDriverIds.includes(d.id));

    if (availableCandidates.length === 0) {
      trip.status = 'no_drivers_available';
      trip.cancellationReason = 'All nearby drivers are currently occupied. Tap to retry or call Park Dispatch.';
      trip.timeline.push({ step: 'no_drivers_available', timestamp: new Date().toISOString(), note: 'All candidates declined/timed out' });
      this.persist();
      return { success: true, trip, finished: true };
    }

    availableCandidates.sort((a, b) => {
      const distA = calculateDistanceKm(a.currentLocation.lat, a.currentLocation.lng, trip.pickupCoords[0], trip.pickupCoords[1]);
      const distB = calculateDistanceKm(b.currentLocation.lat, b.currentLocation.lng, trip.pickupCoords[0], trip.pickupCoords[1]);
      return distA - distB;
    });

    const nextDriver = availableCandidates[0];
    const timeoutSeconds = this.data.settings.offerTimeoutSeconds || 15;
    trip.currentOfferedDriverId = nextDriver.id;
    trip.offerExpiresAt = Date.now() + timeoutSeconds * 1000;
    trip.timeline.push({
      step: 'driver_offered',
      timestamp: new Date().toISOString(),
      note: `Cascaded to ${nextDriver.name} (${nextDriver.vehiclePlate})`,
    });
    this.persist();

    return {
      success: true,
      trip,
      nextDriverId: nextDriver.id,
      finished: false,
    };
  }

  public getPendingOfferForDriver(driverId: string): TripRecord | null {
    return (
      this.data.trips.find(
        (t) =>
          t.status === 'matching' &&
          t.currentOfferedDriverId === driverId &&
          t.offerExpiresAt &&
          t.offerExpiresAt > Date.now()
      ) || null
    );
  }

  // Background Cascade Engine: Checks all active matching trips and cascades offers where timer expired
  public checkAndCascadeExpiredOffers(): { cascadedCount: number } {
    const now = Date.now();
    let cascadedCount = 0;
    for (const trip of this.data.trips) {
      if (
        trip.status === 'matching' &&
        trip.currentOfferedDriverId &&
        trip.offerExpiresAt &&
        trip.offerExpiresAt <= now
      ) {
        console.log(`[Pilot DB] Auto-cascading expired offer for Trip ${trip.id} from Driver ${trip.currentOfferedDriverId}`);
        this.cascadeTripOffer(trip.id, trip.currentOfferedDriverId);
        cascadedCount++;
      }
    }
    return { cascadedCount };
  }

  // --- ONLINE PAYMENT & BANK TRANSFER ---
  public recordTripTransferSent(
    tripId: string,
    reference?: string
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    trip.paymentMethod = 'transfer';
    trip.paymentStatus = 'transfer_pending';
    trip.transferReference = reference || `TRF_${Date.now()}`;
    trip.transferSentAt = new Date().toISOString();
    trip.timeline.push({
      step: 'transfer_sent',
      timestamp: new Date().toISOString(),
      note: `Rider sent bank transfer of ₦${trip.fareNaira} (Ref: ${trip.transferReference})`,
    });
    this.persist();
    return { success: true, trip };
  }




  // Driver Wallet Access & Withdrawals
  public getDriverWallet(driverId: string): {
    balance: number;
    transactions: any[];
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } {
    const driver = this.getDriver(driverId);
    if (!driver) {
      return { balance: 0, transactions: [] };
    }
    return {
      balance: driver.walletBalance || 0,
      transactions: driver.walletTransactions || [],
      bankName: driver.bankName,
      accountNumber: driver.accountNumber,
      accountName: driver.accountName,
    };
  }

  public withdrawDriverWallet(
    driverId: string,
    amount: number
  ): { success: boolean; newBalance?: number; error?: string } {
    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver profile not found' };
    if (amount <= 0) return { success: false, error: 'Withdrawal amount must be greater than 0' };
    const current = driver.walletBalance || 0;
    if (current < amount) {
      return { success: false, error: `Insufficient wallet balance. Available: ₦${current.toLocaleString()}` };
    }

    driver.walletBalance = current - amount;
    driver.walletTransactions = driver.walletTransactions || [];
    driver.walletTransactions.unshift({
      id: `tx_wth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: -amount,
      type: 'withdrawal',
      note: `Bank withdrawal to ${driver.bankName || 'Bank'} (${driver.accountNumber || 'Account'})`,
      status: 'successful',
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return { success: true, newBalance: driver.walletBalance };
  }

  // Cash remittance recording for admin
  public recordCashRemittance(
    driverId: string,
    amount: number,
    notes: string = '',
    staffUserId: string
  ): { success: boolean; remittance?: CashRemittanceRecord; error?: string } {
    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver not found' };

    const remittance: CashRemittanceRecord = {
      id: `rem_${Date.now()}`,
      driverId,
      amount,
      notes,
      receivedByStaffId: staffUserId,
      recordedAt: new Date().toISOString(),
    };

    this.data.remittances = this.data.remittances || [];
    this.data.remittances.push(remittance);

    this.logAudit(
      'CASH_REMITTANCE_RECORDED',
      'setting_change',
      staffUserId,
      'Staff Ops',
      'operations',
      driverId,
      `Recorded cash remittance of ₦${amount} from driver ${driver.name} (${driver.vehiclePlate})`
    );

    this.persist();
    return { success: true, remittance };
  }

  public acceptTripOffer(tripId: string, driverId: string): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    if (trip.status !== 'matching') {
      return { success: false, error: `Trip is not in matching state (current: ${trip.status})` };
    }

    if (trip.currentOfferedDriverId !== driverId) {
      return { success: false, error: 'Offer expired or allocated to another driver' };
    }

    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver profile not found' };

    const nowIso = new Date().toISOString();
    trip.driverId = driver.id;
    trip.driverName = driver.name;
    trip.driverPhone = driver.phone;
    trip.vehiclePlate = driver.vehiclePlate;
    trip.vehicleModel = driver.vehicleModel;
    const rawAvatar = driver.facePhotoUrl || driver.avatarUrl;
    trip.driverAvatarUrl = rawAvatar && !rawAvatar.includes('driver_avatar_keke_1790847258442') ? rawAvatar : undefined;
    trip.acceptedAt = nowIso;
    trip.currentOfferedDriverId = null;
    trip.offerExpiresAt = null;

    trip.timeline.push({
      step: 'accepted',
      timestamp: nowIso,
      note: `Accepted by ${driver.name}`,
    });

    return this.updateTripStatus(trip.id, 'accepted');
  }

  public updateTripStatus(tripId: string, nextStatus: TripStatus): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const validTransitions: Record<TripStatus, TripStatus[]> = {
      scheduled: ['scheduled_claimed', 'matching', 'accepted', 'arriving', 'cancelled'],
      scheduled_claimed: ['accepted', 'arriving', 'in_progress', 'cancelled'],
      requested: ['matching', 'cancelled', 'no_drivers_available'],
      matching: ['accepted', 'cancelled', 'no_drivers_available'],
      accepted: ['arriving', 'in_progress', 'cancelled'],
      arriving: ['in_progress', 'cancelled'],
      in_progress: ['arrived_destination', 'completed', 'cancelled'],
      arrived_destination: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      no_drivers_available: ['matching', 'cancelled'],
    };

    if (!validTransitions[trip.status].includes(nextStatus)) {
      return {
        success: false,
        error: `Illegal state transition from ${trip.status} to ${nextStatus}`,
      };
    }

    const nowIso = new Date().toISOString();
    trip.status = nextStatus;

    if (nextStatus === 'in_progress') {
      trip.startedAt = nowIso;
      trip.timeline.push({ step: 'in_progress', timestamp: nowIso, note: 'PIN verified; ride in progress' });
    } else if (nextStatus === 'arriving') {
      trip.timeline.push({ step: 'arriving', timestamp: nowIso, note: 'Driver arriving at pickup location' });
    } else if (nextStatus === 'arrived_destination') {
      trip.timeline.push({ step: 'arrived_destination', timestamp: nowIso, note: 'Driver arrived at dropoff destination' });
    } else if (nextStatus === 'completed') {
      trip.completedAt = nowIso;
      trip.timeline.push({ step: 'completed', timestamp: nowIso, note: `Cash collected: ₦${trip.fareNaira}` });

      if (trip.driverId) {
        const driver = this.getDriver(trip.driverId);
        if (driver) {
          driver.totalTrips += 1;
          this.updateDriver(driver.id, { totalTrips: driver.totalTrips });
        }
        this.completeReferralForUser(trip.driverId);
      }
      if (trip.riderPhone) this.completeReferralForUser(trip.riderPhone);
      if (trip.riderId) this.completeReferralForUser(trip.riderId);
    } else if (nextStatus === 'cancelled') {
      trip.cancelledAt = nowIso;
      trip.timeline.push({ step: 'cancelled', timestamp: nowIso, note: trip.cancellationReason || 'Ride cancelled' });
    }

    this.persist();
    return { success: true, trip };
  }



  public verifyTripPin(tripId: string, pin: string): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    if (trip.safetyPin !== pin.trim()) {
      return { success: false, error: 'Invalid 4-digit Safety PIN. Check rider screen.' };
    }

    return this.updateTripStatus(tripId, 'in_progress');
  }

  public submitTripRating(
    tripId: string,
    stars: number,
    tags: string[] = [],
    comment?: string
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const cleanStars = Math.min(5, Math.max(1, stars));
    const nowIso = new Date().toISOString();

    trip.riderRating = {
      stars: cleanStars,
      tags,
      comment,
      ratedAt: nowIso,
    };

    if (trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      if (driver) {
        // Rolling average calculation
        const newRating = Number(((driver.rating * driver.totalTrips + stars) / (driver.totalTrips + 1)).toFixed(2));
        this.updateDriver(driver.id, { rating: newRating });
      }
    }

    // Deliver directly to Admin Feedback / Surveys and audit trail
    this.data.surveys.unshift({
      id: `srv_${Date.now()}`,
      userId: trip.riderId,
      tripId: trip.id,
      priceFairness: 'fair',
      safetyFeeling: cleanStars >= 4 ? 'very_safe' : cleanStars >= 3 ? 'safe' : 'unsafe',
      wouldUseAgain: cleanStars >= 3,
      comments: `${cleanStars}★ rating for driver ${trip.driverName || 'Driver'}: [${tags.join(', ')}]${comment ? ` - "${comment}"` : ''}`,
      submittedAt: nowIso,
    });

    this.logAudit(
      'passenger_feedback',
      'setting_change',
      trip.riderId,
      trip.riderName,
      'viewer',
      trip.id,
      `Passenger submitted feedback: ${cleanStars} Stars [${tags.join(', ')}] ${comment ? `"${comment}"` : ''}`
    );

    this.persist();
    return { success: true, trip };
  }



  // --- PERSISTENT PAYMENT IDEMPOTENCY LEDGER ---
  public isPaymentReferenceProcessed(ref: string): boolean {
    if (!ref) return false;
    if (!this.data.processedPaymentRefs) this.data.processedPaymentRefs = [];
    return this.data.processedPaymentRefs.includes(ref);
  }

  public markPaymentReferenceProcessed(ref: string): void {
    if (!ref) return;
    if (!this.data.processedPaymentRefs) this.data.processedPaymentRefs = [];
    if (!this.data.processedPaymentRefs.includes(ref)) {
      this.data.processedPaymentRefs.push(ref);
      this.persistSync();
    }
  }

  // --- DRIVER BANK & PAYSTACK SUBACCOUNT MANAGEMENT (OPTION B: SPLIT SETTLEMENTS) ---
  public updateDriverBankDetails(
    driverId: string,
    details: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      paystackSubaccountCode?: string;
    }
  ): { success: boolean; driver?: DriverRecord; error?: string } {
    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver profile not found' };

    driver.bankName = details.bankName;
    driver.bankCode = details.bankCode;
    driver.accountNumber = details.accountNumber;
    driver.accountName = details.accountName;
    if (details.paystackSubaccountCode) {
      driver.paystackSubaccountCode = details.paystackSubaccountCode;
    }

    this.persistSync();
    return { success: true, driver };
  }

  // --- STRICT CASH PAYMENT AT DROP-OFF (PHYSICAL HANDOFF) ---
  public confirmTripCashPayment(
    tripId: string,
    driverId: string
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };
    if (trip.driverId !== driverId) return { success: false, error: 'Unauthorized: Driver ID mismatch' };

    // Never overwrite an already verified online Paystack payment with cash_collected
    if (trip.paymentStatus === 'paystack_paid') {
      return { success: true, trip };
    }

    const nowIso = new Date().toISOString();
    const wasCompleted = trip.status === 'completed';
    trip.paymentMethod = 'cash';
    trip.paymentStatus = 'cash_collected';
    trip.status = 'completed';
    trip.completedAt = nowIso;
    trip.timeline.push({
      step: 'cash_collected',
      timestamp: nowIso,
      note: `Exact cash fare of ₦${trip.fareNaira} collected physically by driver at drop-off`,
    });

    const driver = this.getDriver(driverId);
    if (driver && !wasCompleted) {
      driver.totalTrips += 1;
    }

    if (trip.driverId) this.completeReferralForUser(trip.driverId);
    if (trip.riderPhone) this.completeReferralForUser(trip.riderPhone);
    if (trip.riderId) this.completeReferralForUser(trip.riderId);

    this.persistSync();
    return { success: true, trip };
  }

  // --- AUTOMATED SPLIT PAYMENT CONFIRMATION (PAYSTACK PER-TRIP) ---
  public confirmTripPaystackPayment(
    tripId: string,
    reference: string,
    paystackData?: any
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const nowIso = new Date().toISOString();
    const wasCompleted = trip.status === 'completed';
    trip.paymentMethod = 'paystack';
    trip.paymentStatus = 'paystack_paid';
    trip.paystackReference = reference;
    trip.paystackPaidAt = nowIso;
    trip.status = 'completed';
    trip.completedAt = nowIso;

    const subaccountCode = trip.paystackSubaccountCode || paystackData?.subaccount?.subaccount_code;
    trip.timeline.push({
      step: 'paystack_split_paid',
      timestamp: nowIso,
      note: `Verified Paystack per-trip payment: ₦${trip.fareNaira} settled automatically${subaccountCode ? ` to driver subaccount ${subaccountCode}` : ' to driver bank'}`,
    });

    if (trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      if (driver && !wasCompleted) {
        driver.totalTrips += 1;
      }
      this.completeReferralForUser(trip.driverId);
    }
    if (trip.riderPhone) this.completeReferralForUser(trip.riderPhone);
    if (trip.riderId) this.completeReferralForUser(trip.riderId);

    this.markPaymentReferenceProcessed(reference);
    this.persistSync();
    return { success: true, trip };
  }

  // --- DIGITAL TRANSFER & PASSENGER/DRIVER WALLETS (LEGACY FALLBACK) ---
  public confirmTripTransferReceived(
    tripId: string,
    reference?: string
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    if (trip.paymentStatus === 'transfer_confirmed') {
      return { success: false, error: 'Transfer has already been confirmed for this trip' };
    }

    const nowIso = new Date().toISOString();
    trip.paymentStatus = 'transfer_confirmed';
    trip.transferConfirmedAt = nowIso;
    if (reference) trip.transferReference = reference;
    trip.status = 'completed';
    trip.completedAt = nowIso;
    trip.timeline.push({
      step: 'transfer_confirmed',
      timestamp: nowIso,
      note: `Paystack transfer confirmed: ₦${trip.fareNaira} credited to driver wallet`,
    });

    if (trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      if (driver) {
        driver.totalTrips += 1;
        driver.walletBalance = (driver.walletBalance || 0) + trip.fareNaira;
        if (!driver.walletTransactions) driver.walletTransactions = [];
        driver.walletTransactions.unshift({
          id: `tx_${Date.now()}`,
          amount: trip.fareNaira,
          type: 'transfer_received',
          tripId: trip.id,
          riderName: trip.riderName,
          reference: reference || `PSTK_TRF_${Date.now()}`,
          note: `Paystack Transfer for trip ${trip.id}`,
          status: 'successful',
          createdAt: nowIso,
        });
      }
    }

    this.persist();
    return { success: true, trip };
  }



  public getUserWallet(userIdOrPhone: string): { balance: number; transactions: UserWalletTransaction[] } {
    let user = this.getUser(userIdOrPhone);
    if (!user) {
      return {
        balance: 0,
        transactions: [],
      };
    }
    if (user.walletBalance === undefined) user.walletBalance = 0;
    if (!user.walletTransactions) {
      user.walletTransactions = [];
    }
    return {
      balance: user.walletBalance,
      transactions: user.walletTransactions,
    };
  }

  public topUpUserWallet(
    userIdOrPhone: string,
    amount: number,
    reference?: string
  ): { success: boolean; balance: number; transactions: UserWalletTransaction[] } {
    let user = this.getUser(userIdOrPhone);
    if (!user) {
      return { success: false, balance: 0, transactions: [] };
    }

    user.walletBalance = (user.walletBalance || 0) + amount;
    if (!user.walletTransactions) user.walletTransactions = [];
    const nowIso = new Date().toISOString();
    const tx: UserWalletTransaction = {
      id: `tx_u_${Date.now()}`,
      amount,
      type: 'topup',
      reference: reference || `PSTK_TOPUP_${Date.now()}`,
      description: `Paystack Top-up (₦${amount.toLocaleString()})`,
      createdAt: nowIso,
    };
    user.walletTransactions.unshift(tx);
    this.persistSync();
    return {
      success: true,
      balance: user.walletBalance,
      transactions: user.walletTransactions,
    };
  }

  public payTripWithUserWallet(
    tripId: string,
    userIdOrPhone: string
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const user = this.getUser(userIdOrPhone) || this.getUser(trip.riderId) || this.getUser(trip.riderPhone);
    if (!user) return { success: false, error: 'Passenger account not found' };

    if ((user.walletBalance || 0) < trip.fareNaira) {
      return {
        success: false,
        error: `Insufficient wallet balance. You have ₦${user.walletBalance || 0}, ride fare is ₦${trip.fareNaira}. Please top up your wallet.`,
      };
    }

    const nowIso = new Date().toISOString();
    user.walletBalance -= trip.fareNaira;
    if (!user.walletTransactions) user.walletTransactions = [];
    user.walletTransactions.unshift({
      id: `tx_u_pay_${Date.now()}`,
      amount: trip.fareNaira,
      type: 'trip_payment',
      reference: `ZYLIFT_RIDE_${trip.id}`,
      description: `Ride Payment: ${trip.pickupName} -> ${trip.dropoffName}`,
      createdAt: nowIso,
    });

    trip.paymentMethod = 'wallet';
    trip.paymentStatus = 'transfer_confirmed';
    trip.status = 'completed';
    trip.completedAt = nowIso;
    trip.timeline.push({
      step: 'wallet_paid',
      timestamp: nowIso,
      note: `Paid with Zylift Passenger Wallet (₦${trip.fareNaira})`,
    });

    if (trip.driverId) {
      const driver = this.getDriver(trip.driverId);
      if (driver) {
        driver.totalTrips += 1;
        driver.walletBalance = (driver.walletBalance || 0) + trip.fareNaira;
        if (!driver.walletTransactions) driver.walletTransactions = [];
        driver.walletTransactions.unshift({
          id: `tx_drv_w_${Date.now()}`,
          amount: trip.fareNaira,
          type: 'transfer_received',
          tripId: trip.id,
          riderName: trip.riderName,
          reference: `WALLET_TRANSFER_${trip.id}`,
          note: `Passenger Wallet Ride Payment: ${trip.id}`,
          status: 'successful',
          createdAt: nowIso,
        });
      }
    }

    this.persist();
    return { success: true, trip };
  }



  // Direct Passenger to Driver Wallet Transfer (e.g. Fare / Tip payment)
  public transferPassengerToDriverWallet(params: {
    passengerUserIdOrPhone: string;
    driverIdOrPhone: string;
    amount: number;
    note?: string;
  }): { success: boolean; newPassengerBalance?: number; newDriverBalance?: number; error?: string } {
    const passenger = this.getUser(params.passengerUserIdOrPhone);
    if (!passenger) return { success: false, error: 'Passenger account not found' };

    const driver = this.getDriver(params.driverIdOrPhone) || this.data.drivers.find((d) => {
      const dClean = d.phone.replace(/\D/g, '');
      const inClean = params.driverIdOrPhone.replace(/\D/g, '');
      return (dClean && inClean && (dClean.endsWith(inClean) || inClean.endsWith(dClean))) || d.id === params.driverIdOrPhone;
    });
    if (!driver) return { success: false, error: 'Driver not found with provided ID or phone number' };

    const amount = Number(params.amount);
    if (!amount || isNaN(amount) || amount <= 0) return { success: false, error: 'Invalid transfer amount' };

    if ((passenger.walletBalance || 0) < amount) {
      return {
        success: false,
        error: `Insufficient wallet balance. You have ₦${(passenger.walletBalance || 0).toLocaleString()}, transfer amount is ₦${amount.toLocaleString()}. Please top up first.`,
      };
    }

    const nowIso = new Date().toISOString();
    const ref = `TRF_P2D_${Date.now()}`;

    // Deduct from passenger
    passenger.walletBalance = (passenger.walletBalance || 0) - amount;
    if (!passenger.walletTransactions) passenger.walletTransactions = [];
    passenger.walletTransactions.unshift({
      id: `tx_u_trf_${Date.now()}`,
      amount,
      type: 'trip_payment',
      reference: ref,
      description: `Direct transfer to Driver ${driver.name} (${driver.vehiclePlate || driver.phone}): ${params.note || 'Ride Fare'}`,
      createdAt: nowIso,
    });

    // Credit driver (0% commission)
    driver.walletBalance = (driver.walletBalance || 0) + amount;
    if (!driver.walletTransactions) driver.walletTransactions = [];
    driver.walletTransactions.unshift({
      id: `tx_drv_trf_${Date.now()}`,
      amount,
      type: 'transfer_received',
      riderName: passenger.name,
      reference: ref,
      note: `Direct Passenger Transfer from ${passenger.name}: ${params.note || 'Ride Fare'}`,
      status: 'successful',
      createdAt: nowIso,
    });

    this.persist();
    return {
      success: true,
      newPassengerBalance: passenger.walletBalance,
      newDriverBalance: driver.walletBalance,
    };
  }

  // --- DISPATCHER FUNCTIONS ---
  public createDispatchedTrip(params: {
    riderName: string;
    riderPhone: string;
    pickupName: string;
    pickupCoords: [number, number];
    dropoffName: string;
    dropoffCoords: [number, number];
    vehicleCategory: 'keke' | 'okada' | 'cab_go' | 'comfort' | 'dispatch';
    driverId: string;
    dispatcherName?: string;
  }): { success: boolean; trip?: TripRecord; error?: string } {
    const driver = this.getDriver(params.driverId);
    if (!driver) return { success: false, error: 'Driver not found' };

    const activeTrip = this.getActiveTripForDriver(driver.id);
    if (activeTrip) {
      return { success: false, error: `Driver ${driver.name} is currently engaged on trip ${activeTrip.id}` };
    }

    const fareNaira = this.getCampusFare(params.pickupName, params.dropoffName, params.vehicleCategory);
    const safetyPin = crypto.randomInt(1000, 10000).toString();
    const nowIso = new Date().toISOString();
    const shareToken = `sh_${crypto.randomBytes(6).toString('hex')}`;

    const trip: TripRecord = {
      id: `TRP-DSP-${Date.now().toString().slice(-6)}`,
      shareToken,
      riderId: `usr_walkin_${Date.now().toString().slice(-4)}`,
      riderName: params.riderName,
      riderPhone: params.riderPhone,
      pickupName: params.pickupName,
      pickupCoords: params.pickupCoords,
      dropoffName: params.dropoffName,
      dropoffCoords: params.dropoffCoords,
      vehicleCategory: params.vehicleCategory,
      fareNaira,
      paymentMethod: 'cash',
      status: 'accepted',
      safetyPin,
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      vehiclePlate: driver.vehiclePlate,
      vehicleModel: driver.vehicleModel,
      driverAvatarUrl: [driver.facePhotoUrl, driver.avatarUrl].find(
        (u) => u && !u.includes('driver_avatar_keke_1790847258442')
      ),
      declinedDriverIds: [],
      isManualDispatch: true,
      dispatcherName: params.dispatcherName || 'Park Marshal',
      timeline: [
        { step: 'dispatched', timestamp: nowIso, note: `Dispatched by ${params.dispatcherName || 'Park Marshal'} to ${driver.name}` },
      ],
      createdAt: nowIso,
      acceptedAt: nowIso,
    };

    this.data.trips.unshift(trip);
    this.persist();
    return { success: true, trip };
  }



  // --- ADMIN RIDE CONTROLS ---
  public adminReassignTrip(
    tripId: string,
    newDriverId: string,
    reason: string,
    staff: StaffUserRecord
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    const newDriver = this.getDriver(newDriverId);
    if (!newDriver) return { success: false, error: 'Replacement driver not found' };

    const oldDriverName = trip.driverName || 'None';
    trip.driverId = newDriver.id;
    trip.driverName = newDriver.name;
    trip.driverPhone = newDriver.phone;
    trip.vehiclePlate = newDriver.vehiclePlate;
    trip.vehicleModel = newDriver.vehicleModel;
    trip.driverAvatarUrl = newDriver.avatarUrl;
    trip.staffNote = `Reassigned by ${staff.name}: ${reason}`;
    trip.timeline.push({
      step: 'admin_reassigned',
      timestamp: new Date().toISOString(),
      note: `Reassigned from ${oldDriverName} to ${newDriver.name}. Reason: ${reason}`,
    });

    this.logAudit(
      'ride_reassign',
      'ride_reassign',
      staff.id,
      staff.name,
      staff.role,
      trip.id,
      `Reassigned trip ${trip.id} to ${newDriver.name}. Reason: ${reason}`
    );

    this.persist();
    return { success: true, trip };
  }



  public adminCancelTrip(
    tripId: string,
    reason: string,
    staff: StaffUserRecord
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTrip(tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    trip.cancellationReason = `Staff cancelled (${staff.name}): ${reason}`;
    const result = this.updateTripStatus(tripId, 'cancelled');

    if (result.success) {
      this.logAudit(
        'ride_cancel',
        'ride_cancel',
        staff.id,
        staff.name,
        staff.role,
        trip.id,
        `Cancelled trip ${trip.id}. Reason: ${reason}`
      );
    }

    return result;
  }

  // --- DRIVER REPOSITORY & APPLICATIONS ---
  public getAllDrivers(): DriverRecord[] {
    return this.data.drivers;
  }

  public getDriver(driverIdOrPhone: string): DriverRecord | null {
    if (!driverIdOrPhone) return null;
    const str = String(driverIdOrPhone).trim();
    const idMatch = this.data.drivers.find((d) => d.id === str);
    if (idMatch) return idMatch;

    let cleanInput = str.replace(/\D/g, '');
    if (cleanInput.startsWith('234')) cleanInput = cleanInput.slice(3);
    if (cleanInput.startsWith('0')) cleanInput = cleanInput.slice(1);
    const target10 = cleanInput.slice(-10);
    if (target10 && target10.length >= 7) {
      const phoneMatch = this.data.drivers.find((d) => {
        let dDigits = (d.phone || '').replace(/\D/g, '');
        if (dDigits.startsWith('234')) dDigits = dDigits.slice(3);
        if (dDigits.startsWith('0')) dDigits = dDigits.slice(1);
        return dDigits.slice(-10) === target10;
      });
      if (phoneMatch) return phoneMatch;
    }
    return null;
  }

  public updateDriver(driverId: string, updates: Partial<DriverRecord>): DriverRecord | null {
    const driver = this.getDriver(driverId);
    if (!driver) return null;

    Object.assign(driver, updates, { lastSeen: new Date().toISOString() });
    this.persist();
    return driver;
  }

  public setDriverOnline(driverId: string, isOnline: boolean): DriverRecord | null {
    return this.updateDriver(driverId, { isOnline });
  }

  public updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading = 0
  ): DriverRecord | null {
    return this.updateDriver(driverId, {
      currentLocation: { lat, lng, heading },
    });
  }

  public getOnlineAvailableDrivers(category?: string): DriverRecord[] {
    return this.data.drivers.filter(
      (d) =>
        d.isOnline &&
        d.isApproved &&
        !d.isSuspended &&
        (!category || d.vehicleCategory === category) &&
        !this.getActiveTripForDriver(d.id)
    );
  }

  // Driver Application Flow (V1-V7)
  public createDriverApplication(
    data: Omit<DriverApplicationRecord, 'id' | 'status' | 'verificationChecklist' | 'hasCompletedTraining' | 'createdAt'>
  ): DriverApplicationRecord & { driver?: DriverRecord } {
    const app: DriverApplicationRecord = {
      ...data,
      id: `app_real_${Date.now().toString().slice(-6)}`,
      status: 'pending',
      verificationChecklist: {
        metInPerson: false,
        faceMatchesId: false,
        plateMatchesVehicle: false,
        parkLeaderKnown: false,
      },
      hasCompletedTraining: false,
      createdAt: new Date().toISOString(),
    };
    this.data.applications.unshift(app);

    // Also register/sync unapproved DriverRecord so the driver can log in, edit profile, see offline gate
    const cleanInput = data.phone.replace(/\D/g, '');
    const strippedInput = cleanInput.startsWith('234') ? cleanInput.slice(3) : cleanInput.startsWith('0') ? cleanInput.slice(1) : cleanInput;

    let driver = this.data.drivers.find((d) => {
      const dClean = d.phone.replace(/\D/g, '');
      const dStrip = dClean.startsWith('234') ? dClean.slice(3) : dClean.startsWith('0') ? dClean.slice(1) : dClean;
      return (strippedInput && dStrip === strippedInput) || (cleanInput && dClean === cleanInput) || d.phone.replace(/\s+/g, '') === data.phone.replace(/\s+/g, '');
    });
    if (driver) {
      driver.name = data.applicantName || driver.name;
      driver.vehicleCategory = data.vehicleCategory || driver.vehicleCategory;
      driver.vehiclePlate = data.vehiclePlate || driver.vehiclePlate;
      driver.vehicleModel = data.vehicleModel || driver.vehicleModel;
      driver.vehicleColor = data.vehicleColor || driver.vehicleColor;
      if (data.homeArea) driver.homeArea = data.homeArea;
      if (data.secondPhone) driver.secondPhone = data.secondPhone;
      if (data.parkLeaderName) driver.parkLeaderName = data.parkLeaderName;
      if (data.parkLeaderPhone) driver.parkLeaderPhone = data.parkLeaderPhone;
      if (data.ninNumber) driver.ninNumber = data.ninNumber;
      if (data.hasSmartphone !== undefined) driver.hasSmartphone = Boolean(data.hasSmartphone);
      if (data.documentsMeta) driver.documentsMeta = data.documentsMeta;
      if (data.facePhotoUrl) {
        driver.avatarUrl = data.facePhotoUrl;
        driver.facePhotoUrl = data.facePhotoUrl;
      }
      if (data.vehiclePhotoUrl) driver.vehiclePhotoUrl = data.vehiclePhotoUrl;
      if (data.idCardPhotoUrl) driver.idCardPhotoUrl = data.idCardPhotoUrl;
      if (data.licenseOrParkCardUrl) driver.licenseOrParkCardUrl = data.licenseOrParkCardUrl;
      if (data.vehiclePapersUrl) driver.vehiclePapersUrl = data.vehiclePapersUrl;
    } else {
      driver = {
        id: `drv_real_${Date.now().toString().slice(-6)}`,
        name: data.applicantName,
        phone: data.phone,
        vehicleCategory: data.vehicleCategory || 'keke',
        vehiclePlate: data.vehiclePlate,
        vehicleModel: data.vehicleModel || 'Bajaj / TVS',
        vehicleColor: data.vehicleColor || 'Yellow',
        avatarUrl: data.facePhotoUrl || '',
        facePhotoUrl: data.facePhotoUrl,
        vehiclePhotoUrl: data.vehiclePhotoUrl,
        idCardPhotoUrl: data.idCardPhotoUrl,
        licenseOrParkCardUrl: data.licenseOrParkCardUrl,
        vehiclePapersUrl: data.vehiclePapersUrl,
        ninNumber: data.ninNumber,
        documentsMeta: data.documentsMeta,
        homeArea: data.homeArea,
        secondPhone: data.secondPhone,
        parkLeaderName: data.parkLeaderName,
        parkLeaderPhone: data.parkLeaderPhone,
        isOnline: false,
        isApproved: false,
        isSuspended: false,
        hasCompletedTraining: false,
        verificationChecklist: {
          metInPerson: false,
          faceMatchesId: false,
          plateMatchesVehicle: false,
          parkLeaderKnown: false,
        },
        rating: 5.0,
        totalTrips: 0,
        walletBalance: 0,
        securityPin: hashPassword((app as any).securityPin?.trim() || '1234'),
        failedPinAttempts: 0,
        pinLockedUntil: null,
        referralCode: `DRV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        hasSmartphone: app.hasSmartphone !== undefined ? Boolean(app.hasSmartphone) : true,
        stationName: 'School Motor Park',
        currentLocation: { lat: 9.5368, lng: 6.4510, heading: 0 },
        lastSeen: new Date().toISOString(),
      };
      this.data.drivers.unshift(driver);
    }

    app.driverId = driver.id;
    (app as any).driver = driver;
    this.persistSync();
    return app as DriverApplicationRecord & { driver?: DriverRecord };
  }

  public getAllDriverApplications(status?: DriverApplicationRecord['status']): DriverApplicationRecord[] {
    if (status) {
      return this.data.applications.filter((a) => a.status === status);
    }
    return this.data.applications;
  }

  public getDriverApplication(id: string): DriverApplicationRecord | null {
    return this.data.applications.find((a) => a.id === id) || null;
  }

  /**
   * Approves a driver application enforcing all 4 mandatory in-person verification checks
   */
  public approveDriverApplication(
    applicationId: string,
    checklist: DriverVerificationChecklist,
    staff: StaffUserRecord
  ): { success: boolean; driver?: DriverRecord; error?: string } {
    let app = this.getDriverApplication(applicationId);
    let driver: DriverRecord | null = null;

    if (!app) {
      // Check if applicationId is actually a driver ID
      driver = this.getDriver(applicationId);
      if (driver) {
        app = this.data.applications.find(
          (a) => a.driverId === driver!.id || (driver!.phone && a.phone.replace(/\D/g, '') === driver!.phone.replace(/\D/g, ''))
        ) || null;
      } else {
        app = this.data.applications.find((a) => a.driverId === applicationId) || null;
      }
    }

    if (!app && !driver) return { success: false, error: 'Driver application or driver record not found' };

    // Strict 4-box verification rule
    if (
      !checklist.metInPerson ||
      !checklist.faceMatchesId ||
      !checklist.plateMatchesVehicle ||
      !checklist.parkLeaderKnown
    ) {
      return {
        success: false,
        error: 'All 4 in-person verification checks (Met in person, Face matches ID, Plate matches vehicle, Park leader known) must be confirmed before approval.',
      };
    }

    const nowIso = new Date().toISOString();
    if (app) {
      app.status = 'approved';
      app.verificationChecklist = checklist;
      app.reviewedAt = nowIso;
      app.reviewedBy = staff.name;
    }

    // Create or activate driver record
    if (!driver && app) {
      const cleanApp = app.phone.replace(/\D/g, '');
      const stripApp = cleanApp.startsWith('234') ? cleanApp.slice(3) : cleanApp.startsWith('0') ? cleanApp.slice(1) : cleanApp;

      driver = (app.driverId ? this.getDriver(app.driverId) : null) || this.data.drivers.find((d) => {
        if (app!.driverId && d.id === app!.driverId) return true;
        const dClean = d.phone.replace(/\D/g, '');
        const dStrip = dClean.startsWith('234') ? dClean.slice(3) : dClean.startsWith('0') ? dClean.slice(1) : dClean;
        return (stripApp && dStrip === stripApp) || (cleanApp && dClean === cleanApp) || d.phone.replace(/\s+/g, '') === app!.phone.replace(/\s+/g, '');
      }) || null;
    }

    if (driver) {
      driver.isApproved = true;
      driver.isSuspended = false;
      driver.verificationChecklist = checklist;
      if (app) {
        if (app.facePhotoUrl) {
          driver.facePhotoUrl = app.facePhotoUrl;
          driver.avatarUrl = app.facePhotoUrl;
        }
        driver.vehiclePhotoUrl = app.vehiclePhotoUrl || driver.vehiclePhotoUrl;
        driver.idCardPhotoUrl = app.idCardPhotoUrl || driver.idCardPhotoUrl;
        driver.licenseOrParkCardUrl = app.licenseOrParkCardUrl || driver.licenseOrParkCardUrl;
        driver.vehiclePapersUrl = app.vehiclePapersUrl || driver.vehiclePapersUrl;
        driver.ninNumber = app.ninNumber || driver.ninNumber;
        driver.documentsMeta = app.documentsMeta || driver.documentsMeta;
        driver.homeArea = app.homeArea || driver.homeArea;
        driver.secondPhone = app.secondPhone || driver.secondPhone;
        driver.parkLeaderName = app.parkLeaderName || driver.parkLeaderName;
        driver.parkLeaderPhone = app.parkLeaderPhone || driver.parkLeaderPhone;
      }
    } else if (app) {
      driver = {
        id: `drv_real_${Date.now().toString().slice(-6)}`,
        name: app.applicantName,
        phone: app.phone,
        vehicleCategory: app.vehicleCategory,
        vehiclePlate: app.vehiclePlate,
        vehicleModel: app.vehicleModel,
        vehicleColor: app.vehicleColor,
        avatarUrl: app.facePhotoUrl || '',
        facePhotoUrl: app.facePhotoUrl,
        vehiclePhotoUrl: app.vehiclePhotoUrl,
        idCardPhotoUrl: app.idCardPhotoUrl,
        licenseOrParkCardUrl: app.licenseOrParkCardUrl,
        vehiclePapersUrl: app.vehiclePapersUrl,
        ninNumber: app.ninNumber,
        documentsMeta: app.documentsMeta,
        homeArea: app.homeArea,
        secondPhone: app.secondPhone,
        parkLeaderName: app.parkLeaderName,
        parkLeaderPhone: app.parkLeaderPhone,
        isOnline: false,
        isApproved: true,
        isSuspended: false,
        hasCompletedTraining: false,
        verificationChecklist: checklist,
        rating: 5.0,
        totalTrips: 0,
        walletBalance: 0,
        securityPin: hashPassword((app as any).securityPin?.trim() || '1234'),
        failedPinAttempts: 0,
        pinLockedUntil: null,
        referralCode: `DRV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        hasSmartphone: app.hasSmartphone !== undefined ? Boolean(app.hasSmartphone) : true,
        stationName: 'School Motor Park',
        currentLocation: { lat: 9.5368, lng: 6.4510, heading: 0 },
        lastSeen: nowIso,
      };
      this.data.drivers.unshift(driver);
    }

    if (app && driver) {
      app.driverId = driver.id;
    }

    if (driver) {
      this.logAudit(
        'driver_approval',
        'driver_approval',
        staff.id,
        staff.name,
        staff.role,
        driver.id,
        `Approved driver ${driver.name} (${driver.vehiclePlate}) after confirming all 4 in-person checks.`
      );
    }

    this.persist();
    return { success: true, driver: driver || undefined };
  }

  public rejectDriverApplication(
    applicationId: string,
    reason: string,
    staff: StaffUserRecord
  ): { success: boolean; error?: string } {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'A mandatory rejection reason is required to notify the applicant via SMS.' };
    }

    let app = this.getDriverApplication(applicationId);
    let driver: DriverRecord | null = null;

    if (!app) {
      driver = this.getDriver(applicationId);
      if (driver) {
        app = this.data.applications.find(
          (a) => a.driverId === driver!.id || (driver!.phone && a.phone.replace(/\D/g, '') === driver!.phone.replace(/\D/g, ''))
        ) || null;
      }
    }

    if (!app && !driver) return { success: false, error: 'Driver application or driver record not found' };

    const nowIso = new Date().toISOString();
    if (app) {
      app.status = 'rejected';
      app.rejectionReason = reason.trim();
      app.reviewedAt = nowIso;
      app.reviewedBy = staff.name;
    }

    if (driver) {
      driver.isApproved = false;
      driver.isSuspended = true;
      driver.rejectionReason = reason.trim();
    }

    this.logAudit(
      'driver_rejection',
      'driver_rejection',
      staff.id,
      staff.name,
      staff.role,
      (app ? app.id : driver?.id) || '',
      `Rejected application. Reason: ${reason}`
    );

    this.persistSync();
    return { success: true };
  }

  public suspendDriver(
    driverId: string,
    reason: string,
    staff: StaffUserRecord
  ): { success: boolean; error?: string } {
    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver not found' };

    driver.isSuspended = true;
    driver.isOnline = false;
    driver.rejectionReason = reason;

    this.logAudit(
      'driver_suspension',
      'driver_suspension',
      staff.id,
      staff.name,
      staff.role,
      driver.id,
      `Suspended driver ${driver.name}. Reason: ${reason}`
    );

    this.persistSync();
    return { success: true };
  }

  public warnDriver(
    driverId: string,
    warningText: string,
    staff: StaffUserRecord
  ): { success: boolean; warningCount: number; error?: string } {
    const driver = this.getDriver(driverId);
    if (!driver) return { success: false, error: 'Driver not found', warningCount: 0 };

    driver.warningCount = (driver.warningCount || 0) + 1;

    this.logAudit(
      'driver_warning' as any,
      'driver_suspension',
      staff.id,
      staff.name,
      staff.role,
      driver.id,
      `Issued safety warning to driver ${driver.name} (Total warnings: ${driver.warningCount}). Note: ${warningText}`
    );

    this.persist();
    return { success: true, warningCount: driver.warningCount };
  }

  public completeDriverTraining(driverId: string): boolean {
    const driver = this.getDriver(driverId);
    if (!driver) return false;
    driver.hasCompletedTraining = true;
    this.persist();
    return true;
  }

  // --- SAFETY INCIDENTS & SOS ---
  public triggerSosIncident(params: {
    tripId?: string;
    reporterType: 'rider' | 'driver' | 'staff';
    reporterName: string;
    reporterPhone: string;
    emergencyContactPhone?: string;
    vehiclePlate?: string;
    driverName?: string;
    locationName: string;
    coords: [number, number];
    description?: string;
  }): SafetyIncidentRecord {
    const incident: SafetyIncidentRecord = {
      id: `sos_${Date.now().toString().slice(-6)}`,
      tripId: params.tripId,
      reporterType: params.reporterType,
      reporterName: params.reporterName,
      reporterPhone: params.reporterPhone,
      emergencyContactPhone: params.emergencyContactPhone,
      vehiclePlate: params.vehiclePlate,
      driverName: params.driverName,
      locationName: params.locationName,
      coords: params.coords,
      status: 'open',
      severity: 'critical_sos',
      description: params.description || 'Emergency SOS button triggered from mobile screen.',
      triggeredAt: new Date().toISOString(),
    };

    this.data.safetyIncidents.unshift(incident);
    this.persist();
    return incident;
  }

  public getAllIncidents(): SafetyIncidentRecord[] {
    // Sort critical open incidents to the top
    return [...this.data.safetyIncidents].sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (b.status === 'open' && a.status !== 'open') return 1;
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    });
  }

  public getIncident(id: string): SafetyIncidentRecord | null {
    return this.data.safetyIncidents.find((i) => i.id === id) || null;
  }

  public resolveIncident(
    incidentId: string,
    resolutionNote: string,
    staff: StaffUserRecord
  ): { success: boolean; incident?: SafetyIncidentRecord; error?: string } {
    if (!resolutionNote || resolutionNote.trim().length < 5) {
      return { success: false, error: 'A mandatory written outcome note is required to resolve safety incidents.' };
    }

    const incident = this.getIncident(incidentId);
    if (!incident) return { success: false, error: 'Incident not found' };

    incident.status = 'resolved';
    incident.resolutionNote = resolutionNote.trim();
    incident.resolvedAt = new Date().toISOString();
    incident.assignedStaff = staff.name;

    this.logAudit(
      'sos_resolve',
      'sos_resolve',
      staff.id,
      staff.name,
      staff.role,
      incident.id,
      `Resolved SOS incident ${incident.id}. Outcome: ${resolutionNote}`
    );

    this.persist();
    return { success: true, incident };
  }

  // --- SUPPORT TICKETS ---
  public createSupportTicket(params: {
    tripId?: string;
    riderName: string;
    riderPhone: string;
    category: SupportTicketRecord['category'];
    subject: string;
    description: string;
  }): SupportTicketRecord {
    const ticket: SupportTicketRecord = {
      id: `tkt_${Date.now().toString().slice(-6)}`,
      tripId: params.tripId,
      riderName: params.riderName,
      riderPhone: params.riderPhone,
      category: params.category,
      subject: params.subject,
      description: params.description,
      status: 'open',
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: 'user',
          senderName: params.riderName,
          text: params.description,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    this.data.supportTickets.unshift(ticket);
    this.persist();
    return ticket;
  }

  public getAllSupportTickets(category?: SupportTicketRecord['category']): SupportTicketRecord[] {
    if (category) {
      return this.data.supportTickets.filter((t) => t.category === category);
    }
    return this.data.supportTickets;
  }

  public getSupportTicket(id: string): SupportTicketRecord | null {
    return this.data.supportTickets.find((t) => t.id === id) || null;
  }

  public addSupportTicketMessage(
    ticketId: string,
    sender: 'user' | 'support',
    senderName: string,
    text: string
  ): SupportTicketRecord | null {
    const ticket = this.getSupportTicket(ticketId);
    if (!ticket) return null;

    ticket.messages.push({
      id: `msg_${Date.now()}`,
      sender,
      senderName,
      text,
      timestamp: new Date().toISOString(),
    });

    if (sender === 'support' && ticket.status === 'open') {
      ticket.status = 'investigating';
    }

    this.persist();
    return ticket;
  }

  public resolveSupportTicket(
    ticketId: string,
    resolutionNote: string,
    staff: StaffUserRecord
  ): SupportTicketRecord | null {
    const ticket = this.getSupportTicket(ticketId);
    if (!ticket) return null;

    ticket.status = 'resolved';
    ticket.resolutionNote = resolutionNote;
    ticket.resolvedAt = new Date().toISOString();

    ticket.messages.push({
      id: `msg_${Date.now()}`,
      sender: 'support',
      senderName: staff.name,
      text: `Issue resolved: ${resolutionNote}`,
      timestamp: new Date().toISOString(),
    });

    this.persist();
    return ticket;
  }

  public deleteSupportTicket(
    ticketId: string,
    staff?: StaffUserRecord
  ): { success: boolean; error?: string } {
    const idx = this.data.supportTickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) return { success: false, error: 'Support ticket not found' };
    const removed = this.data.supportTickets.splice(idx, 1)[0];
    if (staff) {
      this.logAudit(
        'ticket_resolved' as any,
        'ticket_resolved' as any,
        staff.id,
        staff.name,
        staff.role,
        ticketId,
        `Deleted support ticket from ${removed.riderName}: "${removed.subject}"`
      );
    }
    this.persistSync();
    return { success: true };
  }

  public clearAllSupportTickets(
    staff?: StaffUserRecord
  ): { success: boolean; count: number } {
    const count = this.data.supportTickets.length;
    this.data.supportTickets = [];
    if (staff) {
      this.logAudit(
        'ticket_resolved' as any,
        'ticket_resolved' as any,
        staff.id,
        staff.name,
        staff.role,
        'all_tickets',
        `Cleared all ${count} support tickets for clean environment`
      );
    }
    this.persistSync();
    return { success: true, count };
  }

  // --- ANNOUNCEMENTS ---
  public createAnnouncement(
    params: {
      title: string;
      body: string;
      audience: 'all' | 'riders' | 'drivers';
      channels: Array<'in_app' | 'sms' | 'push'>;
    },
    staff: StaffUserRecord
  ): { success: boolean; announcement?: AnnouncementRecord; error?: string } {
    if (params.channels.includes('sms') && params.body.length > 160) {
      return { success: false, error: `SMS channel cannot exceed 160 characters (current: ${params.body.length} chars).` };
    }

    const count =
      params.audience === 'riders'
        ? this.data.users.length
        : params.audience === 'drivers'
        ? this.data.drivers.length
        : this.data.users.length + this.data.drivers.length;

    const announcement: AnnouncementRecord = {
      id: `ann_${Date.now().toString().slice(-6)}`,
      title: params.title,
      body: params.body,
      audience: params.audience,
      channels: params.channels,
      charCount: params.body.length,
      sentAt: new Date().toISOString(),
      sentBy: staff.name,
      recipientCount: count,
    };

    this.data.announcements.unshift(announcement);
    this.logAudit(
      'announcement_broadcast' as any,
      'setting_change',
      staff.id,
      staff.name,
      staff.role,
      announcement.id,
      `Broadcasted announcement "${params.title}" to ${count} recipients across [${params.channels.join(', ')}].`
    );

    this.persist();
    return { success: true, announcement };
  }

  public getAllAnnouncements(): AnnouncementRecord[] {
    return this.data.announcements;
  }

  public deleteAnnouncement(
    announcementId: string,
    staff?: StaffUserRecord
  ): { success: boolean; error?: string } {
    const idx = this.data.announcements.findIndex((a) => a.id === announcementId);
    if (idx === -1) return { success: false, error: 'Announcement not found' };
    const removed = this.data.announcements.splice(idx, 1)[0];
    if (staff) {
      this.logAudit(
        'setting_change',
        'setting_change',
        staff.id,
        staff.name,
        staff.role,
        announcementId,
        `Deleted broadcast announcement "${removed.title}"`
      );
    }
    this.persistSync();
    return { success: true };
  }

  // --- SYSTEM SETTINGS ---
  public getSettings(): SystemSettingsRecord {
    return this.data.settings;
  }

  public updateSettings(
    updates: Partial<SystemSettingsRecord>,
    staff: StaffUserRecord
  ): SystemSettingsRecord {
    this.data.settings = { ...this.data.settings, ...updates };
    this.logAudit(
      'setting_change',
      'setting_change',
      staff.id,
      staff.name,
      staff.role,
      'system_settings',
      `Updated system settings: ${JSON.stringify(updates)}`
    );
    this.persistSync();
    return this.data.settings;
  }

  // --- SURVEYS ---
  public submitSurvey(survey: Omit<PilotSurveyRecord, 'id' | 'submittedAt'>): PilotSurveyRecord {
    const record: PilotSurveyRecord = {
      ...survey,
      id: `srv_${Date.now().toString().slice(-6)}`,
      submittedAt: new Date().toISOString(),
    };
    this.data.surveys.unshift(record);
    this.persistSync();
    return record;
  }

  public getAllSurveys(): PilotSurveyRecord[] {
    return this.data.surveys;
  }

  public deleteSurvey(surveyId: string): boolean {
    const idx = this.data.surveys.findIndex((s) => s.id === surveyId);
    if (idx === -1) return false;
    this.data.surveys.splice(idx, 1);
    this.persistSync();
    return true;
  }

  public clearAllSurveys(): void {
    this.data.surveys = [];
    this.persistSync();
  }

  public clearAuditLogs(staff?: StaffUserRecord): { success: boolean; count: number } {
    const count = this.data.auditLogs.length;
    this.data.auditLogs = [];
    if (staff) {
      this.logAudit(
        'audit_logs_cleared' as any,
        'setting_change',
        staff.id,
        staff.name,
        staff.role,
        'audit_logs',
        `Audit trail reset and cleared by Super Admin ${staff.name}`
      );
    }
    this.persistSync();
    return { success: true, count };
  }

  // --- FARE CALCULATION & MATRIX EDITING ---
  public getCampusFare(
    pickupName: string,
    dropoffName: string,
    category: 'keke' | 'okada' | 'cab_go' | 'comfort' | 'dispatch' | 'small_bus' | 'big_bus'
  ): number {
    const pNorm = (pickupName || '').toLowerCase();
    const dNorm = (dropoffName || '').toLowerCase();

    const normalize = (s: string) => {
      if (s.includes('gate') || s.includes('entrance') || s.includes('park')) return 'gate';
      if (s.includes('hostel')) return 'hostel';
      if (s.includes('seet')) return 'seet';
      if (s.includes('library')) return 'library';
      if (s.includes('senate') || s.includes('admin')) return 'senate';
      if (s.includes('saat')) return 'saat';
      if (s.includes('village')) return 'village';
      if (s.includes('bosso')) return 'bosso';
      return s;
    };

    const pKey = normalize(pNorm);
    const dKey = normalize(dNorm);

    const rule = this.data.fareRules.find((r) => {
      const fz = r.fromZone.toLowerCase();
      const tz = r.toZone.toLowerCase();
      const fzKey = normalize(fz);
      const tzKey = normalize(tz);
      return (
        (pKey === fzKey && dKey === tzKey) ||
        (pKey === tzKey && dKey === fzKey) ||
        (pNorm.includes(fz) && dNorm.includes(tz)) ||
        (pNorm.includes(tz) && dNorm.includes(fz))
      );
    });
    if (rule) {
      if (category === 'keke') return rule.kekeFare;
      if (category === 'okada' || category === 'dispatch') return rule.okadaFare;
      if (category === 'cab_go' || category === 'comfort') return rule.carFare;
      if (category === 'small_bus' && rule.smallBusFare) return rule.smallBusFare;
      if (category === 'big_bus' && rule.bigBusFare) return rule.bigBusFare;
    }
    return getDeterministicCampusFare(pickupName, dropoffName, category);
  }

  public getAllFareRules(): CampusFareRule[] {
    return this.data.fareRules;
  }

  public updateFareRule(
    fromZone: string,
    toZone: string,
    fares: { kekeFare: number; okadaFare: number; carFare: number; smallBusFare?: number; bigBusFare?: number },
    staff: StaffUserRecord,
    originalZones?: { originalFromZone?: string; originalToZone?: string }
  ): CampusFareRule {
    const origFrom = (originalZones?.originalFromZone || fromZone).toLowerCase();
    const origTo = (originalZones?.originalToZone || toZone).toLowerCase();

    let rule = this.data.fareRules.find(
      (r) =>
        (r.fromZone.toLowerCase() === origFrom && r.toZone.toLowerCase() === origTo) ||
        (r.fromZone.toLowerCase() === origTo && r.toZone.toLowerCase() === origFrom)
    );

    if (rule) {
      rule.fromZone = fromZone;
      rule.toZone = toZone;
      rule.kekeFare = fares.kekeFare;
      rule.okadaFare = fares.okadaFare;
      rule.carFare = fares.carFare;
      rule.smallBusFare = fares.smallBusFare !== undefined ? fares.smallBusFare : rule.smallBusFare ?? Math.round(fares.kekeFare * 0.75);
      rule.bigBusFare = fares.bigBusFare !== undefined ? fares.bigBusFare : rule.bigBusFare ?? Math.round(fares.kekeFare * 0.5);
    } else {
      rule = {
        fromZone,
        toZone,
        kekeFare: fares.kekeFare,
        okadaFare: fares.okadaFare,
        carFare: fares.carFare,
        smallBusFare: fares.smallBusFare !== undefined ? fares.smallBusFare : Math.round(fares.kekeFare * 0.75),
        bigBusFare: fares.bigBusFare !== undefined ? fares.bigBusFare : Math.round(fares.kekeFare * 0.5),
      };
      this.data.fareRules.push(rule);
    }

    this.logAudit(
      'fare_change',
      'fare_change',
      staff.id,
      staff.name,
      staff.role,
      `${fromZone}-${toZone}`,
      `Updated fares for ${fromZone} <-> ${toZone}: Keke ₦${fares.kekeFare}, Okada ₦${fares.okadaFare}, Car ₦${fares.carFare}, Small Bus ₦${rule.smallBusFare}, Big Bus ₦${rule.bigBusFare}`
    );

    this.persist();
    return rule;
  }

  public deleteFareRule(
    fromZone: string,
    toZone: string,
    staff: StaffUserRecord
  ): { success: boolean; error?: string } {
    const fz = fromZone.toLowerCase();
    const tz = toZone.toLowerCase();
    const idx = this.data.fareRules.findIndex(
      (r) =>
        (r.fromZone.toLowerCase() === fz && r.toZone.toLowerCase() === tz) ||
        (r.fromZone.toLowerCase() === tz && r.toZone.toLowerCase() === fz)
    );
    if (idx === -1) {
      return { success: false, error: 'Route fare rule not found' };
    }
    const removed = this.data.fareRules.splice(idx, 1)[0];
    this.logAudit(
      'fare_change',
      'fare_change',
      staff.id,
      staff.name,
      staff.role,
      `${removed.fromZone}-${removed.toZone}`,
      `Removed route fare rule: ${removed.fromZone} <-> ${removed.toZone}`
    );
    this.persistSync();
    return { success: true };
  }

  public setAllFareRules(
    rules: CampusFareRule[],
    staff: StaffUserRecord
  ): { success: boolean; count: number; rules: CampusFareRule[] } {
    const validatedRules: CampusFareRule[] = (rules || [])
      .map((r) => ({
        fromZone: String(r.fromZone || '').trim(),
        toZone: String(r.toZone || '').trim(),
        kekeFare: Number(r.kekeFare) || 0,
        okadaFare: Number(r.okadaFare) || 0,
        carFare: Number(r.carFare) || 0,
        smallBusFare: Number(r.smallBusFare) || 0,
        bigBusFare: Number(r.bigBusFare) || 0,
      }))
      .filter((r) => r.fromZone.length > 0 && r.toZone.length > 0);

    this.data.fareRules = validatedRules;
    this.logAudit(
      'fare_change',
      'fare_change',
      staff.id,
      staff.name,
      staff.role,
      'matrix_table',
      `Full route fare matrix updated with ${validatedRules.length} route configurations`
    );
    this.persist();
    return { success: true, count: validatedRules.length, rules: this.data.fareRules };
  }

  // --- VEHICLE-BY-DISTANCE & CAPACITY PRICING RULES (UBER/BOLT FORMULA) ---
  public getVehicleRules(): Record<string, any> {
    const DEFAULT_VEHICLE_RULES = {
      okada:     { id: 'okada',     label: 'Okada',     minSeats: 1,  maxSeats: 2,  minPassengersToOffer: 1,  maxKm: 30,   baseFare: 150,  perKm: 60,  perMinute: 5,  minimumFare: 250 },
      keke:      { id: 'keke',      label: 'Keke',      minSeats: 4,  maxSeats: 5,  minPassengersToOffer: 1,  maxKm: 35,   baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 300 },
      cab_go:    { id: 'cab_go',    label: 'Car',       minSeats: 4,  maxSeats: 10, minPassengersToOffer: 1,  maxKm: null, baseFare: 500,  perKm: 150, perMinute: 15, minimumFare: 1000 },
      small_bus: { id: 'small_bus', label: 'Small bus', minSeats: 8,  maxSeats: 18, minPassengersToOffer: 8,  maxKm: null, baseFare: 2500, perKm: 300, perMinute: 25, minimumFare: 5000 },
      big_bus:   { id: 'big_bus',   label: 'Big bus',   minSeats: 19, maxSeats: 80, minPassengersToOffer: 19, maxKm: null, baseFare: 8000, perKm: 600, perMinute: 50, minimumFare: 15000 },
    };

    if (!this.data.vehicleRules || Object.keys(this.data.vehicleRules).length === 0) {
      this.data.vehicleRules = { ...DEFAULT_VEHICLE_RULES };
    }
    return this.data.vehicleRules;
  }

  public updateVehicleRules(
    rules: Record<string, any>,
    staff?: StaffUserRecord
  ): { success: boolean; rules: Record<string, any> } {
    const current = this.getVehicleRules();
    const updated: Record<string, any> = { ...current };

    Object.entries(rules).forEach(([key, val]) => {
      if (val && typeof val === 'object') {
        const parseOptNum = (v: any, fallback: number) =>
          v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? fallback : Number(v);
        const parsedMaxKm =
          val.maxKm === null || val.maxKm === '' || val.maxKm === undefined || Number(val.maxKm) <= 0
            ? null
            : Number(val.maxKm);
        updated[key] = {
          ...(updated[key] || {}),
          ...val,
          id: key,
          maxKm: parsedMaxKm,
          minSeats: Math.max(1, parseOptNum(val.minSeats, updated[key]?.minSeats || 1)),
          maxSeats: Math.max(1, parseOptNum(val.maxSeats, updated[key]?.maxSeats || 4)),
          minPassengersToOffer: Math.max(1, parseOptNum(val.minPassengersToOffer, 1)),
          baseFare: Math.max(0, parseOptNum(val.baseFare, 0)),
          perKm: Math.max(0, parseOptNum(val.perKm, 0)),
          perMinute: Math.max(0, parseOptNum(val.perMinute, 0)),
          minimumFare: Math.max(0, parseOptNum(val.minimumFare, 0)),
        };
      }
    });

    this.data.vehicleRules = updated;
    if (staff) {
      this.logAudit(
        'fare_change',
        'fare_change',
        staff.id,
        staff.name,
        staff.role,
        'vehicle_rules',
        'Updated vehicle pricing formula & distance cutoffs'
      );
    }
    this.persist();
    return { success: true, rules: this.data.vehicleRules };
  }

  // --- USER & AUTH TRACKING ---
  public getAllUsers(): UserRecord[] {
    return this.data.users;
  }

  public getUser(userIdOrPhone: string): UserRecord | null {
    if (!userIdOrPhone) return null;
    const str = String(userIdOrPhone).trim();

    // 1. Direct user ID match
    const idMatch = this.data.users.find((u) => u.id === str);
    if (idMatch) return idMatch;

    // 2. Normalized phone match (10-digit subscriber number)
    let cleanInput = str.replace(/\D/g, '');
    if (cleanInput.startsWith('234')) cleanInput = cleanInput.slice(3);
    if (cleanInput.startsWith('0')) cleanInput = cleanInput.slice(1);
    const target10 = cleanInput.slice(-10);
    if (target10 && target10.length >= 7) {
      const phoneMatch = this.data.users.find((u) => {
        if (!u.phone || u.phone.startsWith('usr_')) return false;
        let uDigits = u.phone.replace(/\D/g, '');
        if (uDigits.startsWith('234')) uDigits = uDigits.slice(3);
        if (uDigits.startsWith('0')) uDigits = uDigits.slice(1);
        const u10 = uDigits.slice(-10);
        return u10 === target10;
      });
      if (phoneMatch) return phoneMatch;
    }

    // 3. Unique Matric / Staff ID match (only if not a placeholder)
    if (str.length > 5 && str !== '2023/1/00000' && str !== 'SS/FUT/MINNA') {
      const matricMatch = this.data.users.find(
        (u) => u.matricOrStaffId && u.matricOrStaffId.toLowerCase() === str.toLowerCase()
      );
      if (matricMatch) return matricMatch;
    }

    return null;
  }

  public blockUser(
    userId: string,
    reason: string,
    staff: StaffUserRecord
  ): { success: boolean; user?: UserRecord; error?: string } {
    const user = this.getUser(userId);
    if (!user) return { success: false, error: 'User not found' };

    user.isBlocked = true;
    user.blockReason = reason;

    this.logAudit(
      'user_blocked' as any,
      'setting_change',
      staff.id,
      staff.name,
      staff.role,
      user.id,
      `Blocked user ${user.name} (${user.phone}). Reason: ${reason}`
    );

    this.persist();
    return { success: true, user };
  }

  public unblockUser(userId: string, staff: StaffUserRecord): { success: boolean; user?: UserRecord; error?: string } {
    const user = this.getUser(userId);
    if (!user) return { success: false, error: 'User not found' };

    user.isBlocked = false;
    user.blockReason = undefined;

    this.logAudit(
      'user_unblocked' as any,
      'setting_change',
      staff.id,
      staff.name,
      staff.role,
      user.id,
      `Unblocked user ${user.name} (${user.phone}).`
    );

    this.persist();
    return { success: true, user };
  }

  public deleteUser(userId: string, staff?: StaffUserRecord): { success: boolean; error?: string } {
    const cleanId = userId.trim();
    const cleanDigits = cleanId.replace(/\D/g, '');
    const idx = this.data.users.findIndex(
      (u) => u.id === cleanId || u.phone === cleanId || (cleanDigits.length >= 10 && u.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-10)))
    );
    if (idx === -1) {
      return { success: false, error: 'User registration not found' };
    }
    const removed = this.data.users.splice(idx, 1)[0];
    const removedPhone = removed.phone;
    const removedId = removed.id;
    const cleanPhoneDigits = removedPhone.replace(/\D/g, '');

    // 1. Permanently remove all active sessions
    this.data.sessions = this.data.sessions.filter(
      (s) => s.userId !== removedId && s.userId !== removedPhone && (!s.userId || !cleanPhoneDigits || !s.userId.replace(/\D/g, '').endsWith(cleanPhoneDigits.slice(-10)))
    );

    // 2. Permanently delete all support tickets from this user
    this.data.supportTickets = this.data.supportTickets.filter(
      (st) => st.riderPhone !== removedPhone && (!cleanPhoneDigits || !st.riderPhone.replace(/\D/g, '').endsWith(cleanPhoneDigits.slice(-10)))
    );

    // 3. Permanently delete all surveys / feedback from this user
    this.data.surveys = this.data.surveys.filter(
      (srv) => srv.userId !== removedId && srv.userId !== removedPhone
    );

    if (staff) {
      this.logAudit(
        'user_deleted' as any,
        'setting_change',
        staff.id,
        staff.name,
        staff.role,
        removed.id,
        `Permanently deleted user registration and all linked records: ${removed.name} (${removed.phone})`
      );
    }
    this.persistSync();
    return { success: true };
  }

  public deleteDriver(driverId: string, staff?: StaffUserRecord): { success: boolean; error?: string } {
    const cleanId = driverId.trim();
    const cleanDigits = cleanId.replace(/\D/g, '');
    const idx = this.data.drivers.findIndex(
      (d) => d.id === cleanId || d.phone === cleanId || (cleanDigits.length >= 10 && d.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-10)))
    );
    if (idx === -1) {
      // Also check if it's an application ID
      const appIdx = this.data.applications.findIndex((a) => a.id === cleanId);
      if (appIdx !== -1) {
        const removedApp = this.data.applications.splice(appIdx, 1)[0];
        if (removedApp.driverId) {
          const dIdx = this.data.drivers.findIndex((d) => d.id === removedApp.driverId);
          if (dIdx !== -1) this.data.drivers.splice(dIdx, 1);
        }
        this.persistSync();
        return { success: true };
      }
      return { success: false, error: 'Driver registration not found' };
    }
    const removed = this.data.drivers.splice(idx, 1)[0];
    const removedPhone = removed.phone;
    const removedId = removed.id;
    const cleanPhoneDigits = removedPhone ? removedPhone.replace(/\D/g, '') : '';

    // 1. Permanently remove all onboarding applications for this driver
    this.data.applications = this.data.applications.filter(
      (a) => a.driverId !== removedId && (!cleanPhoneDigits || a.phone.replace(/\D/g, '') !== cleanPhoneDigits)
    );

    // 2. Permanently remove all active driver sessions
    this.data.sessions = this.data.sessions.filter(
      (s) => s.userId !== removedId && s.userId !== removedPhone && (!s.userId || !cleanPhoneDigits || !s.userId.replace(/\D/g, '').endsWith(cleanPhoneDigits.slice(-10)))
    );

    if (staff) {
      this.logAudit(
        'driver_deleted' as any,
        'setting_change',
        staff.id,
        staff.name,
        staff.role,
        removed.id,
        `Permanently deleted driver registration and applications: ${removed.name} (${removed.phone}, Plate: ${removed.vehiclePlate})`
      );
    }
    this.persistSync();
    return { success: true };
  }

  public deleteDriverApplication(applicationId: string, staff?: StaffUserRecord): { success: boolean; error?: string } {
    const cleanId = applicationId.trim();
    const idx = this.data.applications.findIndex((a) => a.id === cleanId);
    if (idx === -1) {
      return { success: false, error: 'Driver application not found' };
    }
    const removed = this.data.applications.splice(idx, 1)[0];
    // Also remove any matching unapproved driver record
    if (removed.driverId || removed.phone) {
      this.data.drivers = this.data.drivers.filter(
        (d) => !(d.id === removed.driverId || (!d.isApproved && d.phone.replace(/\D/g, '') === removed.phone.replace(/\D/g, '')))
      );
    }
    if (staff) {
      this.logAudit(
        'application_deleted' as any,
        'setting_change',
        staff.id,
        staff.name,
        staff.role,
        removed.id,
        `Deleted driver application for: ${removed.applicantName} (${removed.phone})`
      );
    }
    this.persistSync();
    return { success: true };
  }

  public signInUser(userData: {
    name: string;
    phone: string;
    role: 'student' | 'staff' | 'visitor' | 'admin';
    matricOrStaffId?: string;
    department?: string;
    securityPin?: string;
    emergencyContactPhone?: string;
    avatarUrl?: string;
    language?: 'en' | 'ha';
  }): { success: boolean; user?: UserRecord; error?: string } {
    const cleanPhone = userData.phone.trim();
    // 1. Primary lookup strictly by phone number
    let user = this.getUser(cleanPhone);

    // 2. If not found by phone, check unique matric/staff ID if explicitly provided (and not a placeholder)
    if (!user && userData.matricOrStaffId && userData.matricOrStaffId.length > 5 && userData.matricOrStaffId !== '2023/1/00000' && userData.matricOrStaffId !== 'SS/FUT/MINNA') {
      user = this.getUser(userData.matricOrStaffId);
    }

    const nowIso = new Date().toISOString();

    if (user) {
      if (user.isBlocked) {
        return { success: false, error: `Account blocked: ${user.blockReason || 'Please contact pilot support'}` };
      }

      // Brute-force protection: check if account is locked out
      if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > Date.now()) {
        const remainingMins = Math.ceil((new Date(user.pinLockedUntil).getTime() - Date.now()) / 60000);
        return { success: false, error: `Account temporarily locked due to failed PIN attempts. Try again in ${remainingMins} minute(s).` };
      }

      // Strict PIN verification: never allow sign-in without valid PIN if account has a PIN set
      if (user.securityPin) {
        const inputPin = userData.securityPin?.trim();
        if (!inputPin) {
          return { success: false, error: '4-digit Account Security PIN is required' };
        }
        const isPinValid = verifyPassword(inputPin, user.securityPin);
        if (!isPinValid) {
          user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;
          if (user.failedPinAttempts >= 5) {
            user.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          }
          this.persist();
          return {
            success: false,
            error: user.failedPinAttempts >= 5
              ? 'Account locked for 15 minutes due to 5 failed PIN attempts.'
              : `Incorrect 4-digit Account Security PIN (${user.failedPinAttempts}/5 attempts)`
          };
        }
        // PIN verified: reset failed attempts & upgrade legacy plaintext PIN to PBKDF2 hash
        user.failedPinAttempts = 0;
        user.pinLockedUntil = null;
        if (!user.securityPin.startsWith('pbkdf2_')) {
          user.securityPin = hashPassword(inputPin);
        }
      }

      user.name = userData.name || user.name;
      user.role = userData.role || user.role;
      if (userData.matricOrStaffId && userData.matricOrStaffId !== '2023/1/00000') {
        user.matricOrStaffId = userData.matricOrStaffId;
      }
      user.department = userData.department || user.department;
      if (userData.emergencyContactPhone) {
        user.emergencyContactPhone = userData.emergencyContactPhone;
      }
      if (userData.avatarUrl !== undefined) {
        user.avatarUrl = userData.avatarUrl || undefined;
      }
      if (userData.language) {
        user.language = userData.language;
      }
      user.phone = cleanPhone;
      if (!user.referralCode) {
        user.referralCode = `ZYLIFT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }
      user.isOnline = true;
      user.lastSignIn = nowIso;
      user.lastSignOut = null;
    } else {
      const chosenPin = userData.securityPin?.trim();
      user = {
        id: `usr_${Date.now().toString().slice(-6)}`,
        name: userData.name || 'FUTMINNA Passenger',
        phone: cleanPhone,
        securityPin: chosenPin ? hashPassword(chosenPin) : undefined,
        emergencyContactPhone: userData.emergencyContactPhone,
        failedPinAttempts: 0,
        pinLockedUntil: null,
        referralCode: `ZYLIFT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        role: userData.role || 'student',
        matricOrStaffId: userData.matricOrStaffId && userData.matricOrStaffId !== '2023/1/00000' ? userData.matricOrStaffId : undefined,
        department: userData.department || 'General Academic',
        avatarUrl: userData.avatarUrl || undefined,
        language: userData.language || 'en',
        walletBalance: 0,
        tripsCount: 0,
        isOnline: true,
        lastSignIn: nowIso,
        lastSignOut: null,
        savedPlaces: [
          { title: 'Main Campus Gate', detail: 'Minna-Bida Road', lat: 9.5375, lng: 6.4520 },
          { title: 'Student Hostels', detail: 'Gidan Kwanu', lat: 9.5265, lng: 6.4430 },
        ],
      };
      this.data.users.unshift(user);
    }

    this.persist();
    return { success: true, user };
  }

  public signOutUser(userIdOrPhone: string): boolean {
    const user = this.getUser(userIdOrPhone);
    if (!user) return false;

    user.isOnline = false;
    user.lastSignOut = new Date().toISOString();
    this.persist();
    return true;
  }

  public updateUser(
    userIdOrPhone: string,
    updates: Partial<Pick<UserRecord, 'name' | 'department' | 'matricOrStaffId' | 'emergencyContactPhone' | 'avatarUrl' | 'language'>>
  ): UserRecord | null {
    const user = this.getUser(userIdOrPhone);
    if (!user) return null;
    if (updates.name !== undefined && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (updates.department !== undefined) {
      user.department = updates.department;
    }
    if (updates.matricOrStaffId !== undefined) {
      user.matricOrStaffId = updates.matricOrStaffId || undefined;
    }
    if (updates.emergencyContactPhone !== undefined) {
      user.emergencyContactPhone = updates.emergencyContactPhone || undefined;
    }
    if (updates.avatarUrl !== undefined) {
      user.avatarUrl = updates.avatarUrl || undefined;
    }
    if (updates.language !== undefined) {
      user.language = updates.language;
    }
    this.persist();
    return user;
  }

  public signInDriver(driverIdOrPhone: string, _securityPin?: string): { success: boolean; driver?: DriverRecord; error?: string } {
    const cleanInput = driverIdOrPhone.replace(/\D/g, '');
    const strippedInput = cleanInput.startsWith('234') ? cleanInput.slice(3) : cleanInput.startsWith('0') ? cleanInput.slice(1) : cleanInput;

    const driver =
      this.getDriver(driverIdOrPhone) ||
      this.data.drivers.find((d) => {
        const dClean = d.phone.replace(/\D/g, '');
        const dStrip = dClean.startsWith('234') ? dClean.slice(3) : dClean.startsWith('0') ? dClean.slice(1) : dClean;
        return (strippedInput && dStrip === strippedInput) || (cleanInput && dClean === cleanInput);
      });
    if (!driver) return { success: false, error: 'Driver profile not registered' };

    if (driver.isSuspended) {
      return { success: false, error: `Driver account suspended: ${driver.rejectionReason || 'Contact pilot office'}` };
    }

    // Clear any legacy PIN lockout fields
    driver.failedPinAttempts = 0;
    driver.pinLockedUntil = null;

    if (!driver.referralCode) {
      driver.referralCode = `DRV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    driver.isOnline = Boolean(driver.isApproved);
    driver.lastSeen = new Date().toISOString();
    this.persist();
    return { success: true, driver };
  }

  public signOutDriver(driverId: string): boolean {
    const driver = this.getDriver(driverId);
    if (!driver) return false;

    driver.isOnline = false;
    driver.lastSeen = new Date().toISOString();
    this.persist();
    return true;
  }

  // --- REPORTING & DASHBOARD ANALYTICS ---
  public getDashboardMetrics() {
    const onlineDrivers = this.data.drivers.filter((d) => d.isOnline);
    const activeTrips = this.data.trips.filter((t) => !['completed', 'cancelled', 'no_drivers_available'].includes(t.status));
    const completedTrips = this.data.trips.filter((t) => t.status === 'completed');
    const cancelledTrips = this.data.trips.filter((t) => t.status === 'cancelled');

    const totalCash = completedTrips.reduce((acc, t) => acc + (t.fareNaira || 0), 0);
    const completedRate = this.data.trips.length > 0
      ? Math.round((completedTrips.length / this.data.trips.length) * 100)
      : 100;

    return {
      totalTripsToday: this.data.trips.length,
      completedTripsToday: completedTrips.length,
      completionRatePercent: completedRate,
      averageWaitMinutes: 3.4,
      driversOnlineNow: onlineDrivers.length,
      cancelledTripsToday: cancelledTrips.length,
      cashCollectedToday: totalCash,
      commissionEarnedNaira: 0, // ₦0 pilot period
      openSafetyIncidentsCount: this.data.safetyIncidents.filter((i) => i.status === 'open').length,
      openSupportTicketsCount: this.data.supportTickets.filter((t) => t.status === 'open').length,
      pendingDriverApplicationsCount: this.data.applications.filter((a) => a.status === 'pending').length,
    };
  }

  public getCampusRoster() {
    const onlineUsers = this.data.users.filter((u) => u.isOnline);
    const onlineDrivers = this.data.drivers.filter((d) => d.isOnline);
    const activeTrips = this.data.trips.filter((t) => !['completed', 'cancelled'].includes(t.status));

    return {
      stats: {
        totalRegisteredUsers: this.data.users.length,
        onlineUsersCount: onlineUsers.length,
        totalDrivers: this.data.drivers.length,
        onlineDriversCount: onlineDrivers.length,
        activeTripsCount: activeTrips.length,
        completedTripsCount: this.data.trips.filter((t) => t.status === 'completed').length,
      },
      users: this.data.users,
      drivers: this.data.drivers,
      activeTrips,
    };
  }

  // --- CAMPUS COMMUNITY REFERRAL SYSTEM (ZERO-COST REWARD LOGIC) ---
  public trackReferral(
    rawCode: string,
    referee: { name: string; phone: string; role?: string; id?: string }
  ): { success: boolean; referral?: ReferralRecord; error?: string } {
    const cleanCode = (rawCode || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Referral code is required' };

    const cleanRefereePhone = (referee.phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanRefereePhone) return { success: false, error: 'Valid referee phone is required' };

    if (!Array.isArray(this.data.referrals)) this.data.referrals = [];

    // Abuse prevention: Check if referee has already been referred
    const existing = this.data.referrals.find((r) =>
      r.refereePhone.replace(/\D/g, '').slice(-10) === cleanRefereePhone
    );
    if (existing) {
      return { success: true, referral: existing };
    }

    // Identify referrer (driver or rider) by exact stored code or legacy name-based code
    let referrerType: 'rider' | 'driver' = 'rider';
    let referrerName = 'Campus Pioneer';
    let referrerPhone = '';
    let referrerId: string | undefined = undefined;
    let canonicalReferrerCode = cleanCode;

    const driverLegacyCode = (name: string) => `DRV-${(name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
    const riderLegacyCode = (name: string) => `KERB-${(name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
    const riderZyliftLegacyCode = (name: string) => `ZYLIFT-${(name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

    const findMatchingDriver = () =>
      this.data.drivers.find(
        (d) =>
          d.referralCode?.toUpperCase() === cleanCode ||
          d.id.toUpperCase() === cleanCode ||
          (d.phone && cleanCode === `DRV-${d.phone.replace(/\D/g, '').slice(-6)}`) ||
          (d.name && driverLegacyCode(d.name) === cleanCode)
      );

    const findMatchingUser = () =>
      this.data.users.find(
        (u) =>
          u.referralCode?.toUpperCase() === cleanCode ||
          u.id.toUpperCase() === cleanCode ||
          (u.phone && (cleanCode === `ZYLIFT-${u.phone.replace(/\D/g, '').slice(-6)}` || cleanCode === `KERB-${u.phone.replace(/\D/g, '').slice(-6)}`)) ||
          (u.name && (riderZyliftLegacyCode(u.name) === cleanCode || riderLegacyCode(u.name) === cleanCode))
      );

    if (cleanCode.startsWith('DRV-')) {
      const matchedDriver = findMatchingDriver();
      if (matchedDriver) {
        referrerType = 'driver';
        referrerName = matchedDriver.name;
        referrerPhone = matchedDriver.phone;
        referrerId = matchedDriver.id;
        if (matchedDriver.referralCode) {
          canonicalReferrerCode = matchedDriver.referralCode.toUpperCase();
        }
      }
    } else {
      const matchedUser = findMatchingUser();
      if (matchedUser) {
        referrerType = 'rider';
        referrerName = matchedUser.name;
        referrerPhone = matchedUser.phone;
        referrerId = matchedUser.id;
        if (matchedUser.referralCode) {
          canonicalReferrerCode = matchedUser.referralCode.toUpperCase();
        }
      } else {
        const matchedDriver = findMatchingDriver();
        if (matchedDriver) {
          referrerType = 'driver';
          referrerName = matchedDriver.name;
          referrerPhone = matchedDriver.phone;
          referrerId = matchedDriver.id;
          if (matchedDriver.referralCode) {
            canonicalReferrerCode = matchedDriver.referralCode.toUpperCase();
          }
        }
      }
    }

    // Referee cannot refer themselves
    if (referrerPhone && referrerPhone.replace(/\D/g, '').slice(-10) === cleanRefereePhone) {
      return { success: false, error: 'Self-referral is not permitted' };
    }

    const refereeType: 'rider' | 'driver' = referee.role === 'driver' ? 'driver' : 'rider';

    const newRecord: ReferralRecord = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      referrerCode: canonicalReferrerCode,
      referrerType,
      referrerId,
      referrerName,
      referrerPhone: referrerPhone || '+234 000 000 0000',
      refereeType,
      refereeId: referee.id,
      refereeName: referee.name || (refereeType === 'driver' ? 'Campus Driver' : 'Campus Passenger'),
      refereePhone: referee.phone,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.data.referrals.unshift(newRecord);
    this.persist();
    return { success: true, referral: newRecord };
  }

  public completeReferralForUser(phoneOrId: string): void {
    if (!Array.isArray(this.data.referrals) || !phoneOrId) return;
    const cleanDigits = phoneOrId.replace(/\D/g, '');
    const sub10 = cleanDigits.slice(-10);

    const pendingRef = this.data.referrals.find((r) => {
      if (r.status !== 'pending') return false;
      const rPhone = (r.refereePhone || '').replace(/\D/g, '').slice(-10);
      return (sub10 && rPhone === sub10) || r.refereeId === phoneOrId;
    });

    if (pendingRef) {
      pendingRef.status = 'completed';
      pendingRef.completedAt = new Date().toISOString();

      const completedCount = this.data.referrals.filter(
        (r) => r.referrerCode === pendingRef.referrerCode && r.status === 'completed'
      ).length;

      if (pendingRef.referrerType === 'driver') {
        pendingRef.unlockedPerk = '0% Commission Guarantee Lock & Priority Park Dispatch';
      } else {
        if (completedCount >= 5) {
          pendingRef.unlockedPerk = 'Campus Ambassador Circle 👑';
        } else if (completedCount >= 3) {
          pendingRef.unlockedPerk = 'Peak Hour Priority Matching ⚡';
        } else {
          pendingRef.unlockedPerk = 'Founding Rider Badge 🏅';
        }
      }
      this.persist();
    }
  }

  public getReferralsForUser(codeOrPhone: string): {
    totalReferred: number;
    completedCount: number;
    pendingCount: number;
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    unlockedPerks: string[];
    referrals: ReferralRecord[];
  } {
    if (!Array.isArray(this.data.referrals)) this.data.referrals = [];
    const rawSearch = (codeOrPhone || '').trim();
    const cleanSearch = rawSearch.toUpperCase();
    const cleanDigits = cleanSearch.replace(/\D/g, '').slice(-10);

    // Resolve any associated user or driver so lookups by id, phone, or referralCode all work cleanly
    const linkedDriver = this.data.drivers.find(
      (d) =>
        d.id.toUpperCase() === cleanSearch ||
        d.referralCode?.toUpperCase() === cleanSearch ||
        (cleanDigits.length >= 7 && d.phone.replace(/\D/g, '').slice(-10) === cleanDigits)
    );
    const linkedUser = this.data.users.find(
      (u) =>
        u.id.toUpperCase() === cleanSearch ||
        u.referralCode?.toUpperCase() === cleanSearch ||
        (cleanDigits.length >= 7 && u.phone.replace(/\D/g, '').slice(-10) === cleanDigits)
    );

    const candidateCodes = new Set<string>([cleanSearch]);
    const candidateIds = new Set<string>([rawSearch]);
    const candidatePhones = new Set<string>();
    if (cleanDigits.length >= 7) candidatePhones.add(cleanDigits);

    if (linkedDriver) {
      candidateIds.add(linkedDriver.id);
      if (linkedDriver.referralCode) candidateCodes.add(linkedDriver.referralCode.toUpperCase());
      const dDigits = linkedDriver.phone.replace(/\D/g, '').slice(-10);
      if (dDigits.length >= 7) candidatePhones.add(dDigits);
    }
    if (linkedUser) {
      candidateIds.add(linkedUser.id);
      if (linkedUser.referralCode) candidateCodes.add(linkedUser.referralCode.toUpperCase());
      const uDigits = linkedUser.phone.replace(/\D/g, '').slice(-10);
      if (uDigits.length >= 7) candidatePhones.add(uDigits);
    }

    const matched = this.data.referrals.filter((r) => {
      if (r.referrerCode && candidateCodes.has(r.referrerCode.toUpperCase())) return true;
      if (r.referrerId && candidateIds.has(r.referrerId)) return true;
      const rDigits = (r.referrerPhone || '').replace(/\D/g, '').slice(-10);
      if (rDigits.length >= 7 && candidatePhones.has(rDigits)) return true;
      return false;
    });

    const completed = matched.filter((r) => r.status === 'completed');
    const pending = matched.filter((r) => r.status === 'pending');

    const perks: string[] = [];
    if (completed.length >= 1) perks.push('Founding Member Badge 🏅');
    if (completed.length >= 3) perks.push('Peak Hour Priority Dispatch ⚡');
    if (completed.length >= 5) perks.push('Campus Ambassador Circle 👑');
    if (matched.some((r) => r.referrerType === 'driver')) {
      perks.push('0% Commission Guaranteed Lock-In 🛡️');
    }

    return {
      totalReferred: matched.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalReferrals: matched.length,
      completedReferrals: completed.length,
      pendingReferrals: pending.length,
      unlockedPerks: perks,
      referrals: matched,
    };
  }

  public getAllReferrals(): ReferralRecord[] {
    return Array.isArray(this.data.referrals) ? this.data.referrals : [];
  }

  public deleteReferral(id: string, staff?: StaffUserRecord): { success: boolean; error?: string } {
    if (!Array.isArray(this.data.referrals)) this.data.referrals = [];
    const index = this.data.referrals.findIndex(r => r.id === id);
    if (index === -1) {
      return { success: false, error: 'Referral record not found' };
    }
    const removed = this.data.referrals.splice(index, 1)[0];
    this.logAudit(
      'delete_referral',
      'setting_change',
      staff?.id || 'admin',
      staff?.name || 'Super Admin',
      staff?.role || 'pilot_lead',
      id,
      `Permanently deleted referral record: ${removed.referrerCode} -> ${removed.refereePhone}`
    );
    this.schedulePgPersist();
    return { success: true };
  }

  public clearAllReferrals(staff?: StaffUserRecord): { success: boolean; count: number } {
    if (!Array.isArray(this.data.referrals)) this.data.referrals = [];
    const count = this.data.referrals.length;
    this.data.referrals = [];
    this.logAudit(
      'clear_all_referrals',
      'setting_change',
      staff?.id || 'admin',
      staff?.name || 'Super Admin',
      staff?.role || 'pilot_lead',
      'all',
      `Permanently cleared all ${count} referral record(s)`
    );
    this.schedulePgPersist();
    return { success: true, count };
  }
}

export const pilotDb = new PilotDatabase();
