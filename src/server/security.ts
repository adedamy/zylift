import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { pilotDb, StaffRole, StaffUserRecord, UserRecord, DriverRecord, TripRecord, SessionRecord } from './db.js';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userSession?: SessionRecord;
      authenticatedUser?: UserRecord;
      authenticatedDriver?: DriverRecord;
      authenticatedStaff?: StaffUserRecord;
      rawBody?: string;
    }
  }
}

// 1. Bearer Token Extractor
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const tokenHeader = req.headers['x-auth-token'];
  if (typeof tokenHeader === 'string' && tokenHeader.trim()) {
    return tokenHeader.trim();
  }
  return null;
}

// 2. Require Passenger/Rider Authentication
export function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Passenger session token required' });
  }

  const session = pilotDb.validateSession(token);
  if (!session || (session.userType !== 'user' && session.userType !== 'staff')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }

  const user = pilotDb.getUser(session.userId);
  if (user && user.isBlocked) {
    return res.status(403).json({ success: false, error: `Account blocked: ${user.blockReason || 'Contact support'}` });
  }

  req.userSession = session;
  if (user) {
    req.authenticatedUser = user;
  }
  next();
}

// 3. Require Driver Authentication
export function requireDriverAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Driver session token required' });
  }

  const session = pilotDb.validateSession(token);
  if (!session || (session.userType !== 'driver' && session.userType !== 'staff')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired driver session' });
  }

  const driver = pilotDb.getDriver(session.userId);
  if (!driver && session.userType === 'driver') {
    return res.status(404).json({ success: false, error: 'Driver profile not found' });
  }

  if (driver && driver.isSuspended) {
    return res.status(403).json({ success: false, error: `Driver suspended: ${driver.rejectionReason || 'Contact administration'}` });
  }

  // Parameter authorization gate: Driver cannot act on behalf of another driver
  if (req.params.id && session.userType === 'driver' && session.userId !== req.params.id) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cannot access or modify another driver resource' });
  }

  req.userSession = session;
  if (driver) {
    req.authenticatedDriver = driver;
  }
  next();
}

// 4. Require Staff / Admin Authentication
export function requireStaffAuth(allowedRoles?: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Staff authentication required' });
    }

    const session = pilotDb.validateSession(token);
    if (!session || session.userType !== 'staff') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired staff session' });
    }

    const staff = pilotDb.getStaff(session.userId);
    if (!staff) {
      return res.status(401).json({ success: false, error: 'Staff account not found' });
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role '${staff.role}' lacks permission for this administrative action`,
      });
    }

    req.userSession = session;
    req.authenticatedStaff = staff;
    next();
  };
}

// 5. Trip Sanitization for Driver: Strictly strips the safety PIN!
export function sanitizeTripForDriver(trip: TripRecord | null | undefined): any {
  if (!trip) return null;
  const copy: any = { ...trip };
  delete copy.safetyPin; // Driver must ask the rider verbally and verify via verify-pin endpoint!
  return copy;
}

// 6. User Sanitization: Strictly strips security PIN
export function sanitizeUser(user: UserRecord | null | undefined): any {
  if (!user) return null;
  const copy: any = { ...user };
  delete copy.securityPin;
  delete copy.failedPinAttempts;
  delete copy.pinLockedUntil;
  return copy;
}

// 7. Driver Sanitization: Strictly strips security PIN and internal security flags
export function sanitizeDriver(driver: DriverRecord | null | undefined): any {
  if (!driver) return null;
  const copy: any = { ...driver };
  delete copy.securityPin;
  delete copy.failedPinAttempts;
  delete copy.pinLockedUntil;
  return copy;
}

// 8. Staff 2FA Login Challenge Engine (Prevents 2FA guessing without password)
interface LoginChallenge {
  staffId: string;
  expiresAt: number;
  attempts: number;
}

class ChallengeStore {
  private challenges = new Map<string, LoginChallenge>();

  public createChallenge(staffId: string): string {
    const challengeId = `ch_${crypto.randomBytes(16).toString('hex')}`;
    this.challenges.set(challengeId, {
      staffId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
    });
    return challengeId;
  }

  public verifyChallenge(challengeId: string, staffId: string, code: string): { success: boolean; error?: string } {
    const ch = this.challenges.get(challengeId);
    if (!ch) {
      return { success: false, error: 'Login challenge expired or not found. Please enter password again.' };
    }
    if (Date.now() > ch.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Login challenge expired. Please enter password again.' };
    }
    if (ch.staffId !== staffId) {
      return { success: false, error: 'Challenge identity mismatch' };
    }
    if (ch.attempts >= 3) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Too many incorrect 2FA attempts. Challenge locked.' };
    }

    const staff = pilotDb.getStaff(staffId);
    if (!staff) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Staff account not found' };
    }

    if (code.trim() !== staff.pin2fa) {
      ch.attempts += 1;
      return { success: false, error: `Invalid 2FA code. ${3 - ch.attempts} attempts remaining.` };
    }

    this.challenges.delete(challengeId);
    return { success: true };
  }
}

export const challengeStore = new ChallengeStore();

// 9. Processed Transactions Set (Persistent Deduplication Ledger across restarts)
export function isReferenceProcessed(ref: string): boolean {
  return pilotDb.isPaymentReferenceProcessed(ref);
}

export function markReferenceProcessed(ref: string): void {
  pilotDb.markPaymentReferenceProcessed(ref);
}

// 10. Webhook Signature Verifier (Timing-Safe HMAC-SHA512)
export function verifyPaystackSignature(payload: string, signature: string | undefined, secretKey: string | undefined): boolean {
  if (!signature || !secretKey || !secretKey.startsWith('sk_')) {
    return false;
  }
  try {
    const expectedSignature = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
