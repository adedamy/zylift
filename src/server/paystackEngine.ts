// Zylift Campus Transit - Paystack Automated Split Payment & Subaccounts Engine
// Option B: Money never sits in Zylift hands. Card/transfer fares are split and settled directly to driver's bank.

import crypto from 'crypto';
import dotenv from 'dotenv';
import { pilotDb, DriverRecord, TripRecord } from './db.js';

dotenv.config();

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Tracks development/sandbox per-trip checkouts until the rider explicitly authorizes payment
const pendingDevCheckouts = new Map<
  string,
  { tripId: string; fareNaira: number; paid: boolean; channel?: string; createdAt: number }
>();

export function getDevCheckout(reference: string) {
  return pendingDevCheckouts.get(reference) || null;
}

export function completeDevPaystackCheckout(reference: string, channel: string = 'card'): boolean {
  const entry = pendingDevCheckouts.get(reference);
  if (!entry) return false;
  entry.paid = true;
  entry.channel = channel;
  return true;
}

export interface BankItem {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
}

// Built-in offline fallback list of Nigerian banks for instant UI feedback
export const NIGERIAN_BANKS_FALLBACK: BankItem[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Kuda Microfinance Bank', code: '50211' },
  { name: 'OPay (PayCom)', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Moniepoint Microfinance Bank', code: '50515' },
  { name: 'Rubies Bank', code: '125' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Taj Bank', code: '302' },
];

function getSecretKey(): string {
  return (process.env.PAYSTACK_SECRET_KEY || '').trim();
}

export function isPaystackConfigured(): boolean {
  const key = getSecretKey();
  return Boolean(key && key.startsWith('sk_') && !key.includes('placeholder'));
}

/**
 * 1. Fetch available Nigerian banks from Paystack API (with fallback)
 */
export async function getPaystackBanks(): Promise<BankItem[]> {
  const secretKey = getSecretKey();
  if (isPaystackConfigured()) {
    try {
      const res = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json();
      if (data.status && Array.isArray(data.data) && data.data.length > 0) {
        return data.data.map((b: any) => ({ name: b.name, code: b.code, slug: b.slug, active: b.active }));
      }
    } catch (e) {
      console.warn('[PaystackEngine] Failed to fetch upstream banks, using local fallback:', e);
    }
  }
  return NIGERIAN_BANKS_FALLBACK;
}

/**
 * 2. Resolve Driver Bank Account (CBN NUBAN Validation)
 */
export async function resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ success: boolean; accountName?: string; error?: string }> {
  const cleanAccount = accountNumber.replace(/\D/g, '').trim();
  const cleanBank = bankCode.trim();

  if (cleanAccount.length !== 10) {
    return { success: false, error: 'Nigerian NUBAN account number must be exactly 10 digits' };
  }
  if (!cleanBank) {
    return { success: false, error: 'Bank selection is required' };
  }

  const secretKey = getSecretKey();
  if (isPaystackConfigured()) {
    try {
      const res = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?account_number=${cleanAccount}&bank_code=${cleanBank}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json();
      if (data.status && data.data && data.data.account_name) {
        return { success: true, accountName: data.data.account_name };
      }
      return { success: false, error: data.message || 'Could not verify account name with bank' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Bank resolution network failure' };
    }
  }

  // Development simulation when keys not yet injected
  return {
    success: true,
    accountName: `VERIFIED PARTNER (${cleanAccount.slice(-4)})`,
  };
}

/**
 * 3. Create or Link Paystack Subaccount for Driver (Option B: Automated Split Payment)
 * When a rider pays, Paystack automatically splits money and deposits driver's share directly into this bank account!
 */
export async function createOrUpdateDriverSubaccount(
  driver: DriverRecord,
  bankCode: string,
  accountNumber: string,
  bankName: string,
  percentageCommission: number = 0 // 0% platform fee during campus pilot
): Promise<{ success: boolean; subaccountCode?: string; accountName?: string; error?: string }> {
  const resolution = await resolveBankAccount(accountNumber, bankCode);
  if (!resolution.success || !resolution.accountName) {
    return { success: false, error: resolution.error || 'Failed to verify bank account' };
  }

  const secretKey = getSecretKey();
  if (isPaystackConfigured()) {
    try {
      // If driver already has subaccount, update it; otherwise create new
      const endpoint = driver.paystackSubaccountCode
        ? `${PAYSTACK_BASE_URL}/subaccount/${driver.paystackSubaccountCode}`
        : `${PAYSTACK_BASE_URL}/subaccount`;
      const method = driver.paystackSubaccountCode ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: driver.name,
          settlement_bank: bankCode,
          account_number: accountNumber.replace(/\D/g, ''),
          percentage_charge: percentageCommission,
          description: `Zylift Driver Subaccount: ${driver.name} (${driver.phone})`,
        }),
      });

      const data = await res.json();
      if (data.status && data.data && data.data.subaccount_code) {
        const subaccountCode = data.data.subaccount_code;
        pilotDb.updateDriverBankDetails(driver.id, {
          bankName,
          bankCode,
          accountNumber: accountNumber.replace(/\D/g, ''),
          accountName: resolution.accountName,
          paystackSubaccountCode: subaccountCode,
        });
        return { success: true, subaccountCode, accountName: resolution.accountName };
      }
      return { success: false, error: data.message || 'Paystack subaccount creation failed' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Subaccount creation network error' };
    }
  }

  // Development fallback subaccount code
  const mockSubaccount = `ACCT_MOCK_${driver.id.replace(/\D/g, '') || Date.now()}`;
  pilotDb.updateDriverBankDetails(driver.id, {
    bankName,
    bankCode,
    accountNumber: accountNumber.replace(/\D/g, ''),
    accountName: resolution.accountName,
    paystackSubaccountCode: mockSubaccount,
  });
  return { success: true, subaccountCode: mockSubaccount, accountName: resolution.accountName };
}

/**
 * 4. Initialize Per-Trip Paystack Payment (Option B: Automated Split)
 * Exact trip fare charged once. No wallet holding. Money splits straight to driver.
 */
export async function initializeTripPaystackPayment(params: {
  trip: TripRecord;
  riderEmail?: string;
  appUrl?: string;
}): Promise<{
  success: boolean;
  authorizationUrl?: string;
  reference?: string;
  fareNaira?: number;
  subaccountCode?: string;
  isSimulation?: boolean;
  error?: string;
}> {
  const { trip, riderEmail, appUrl = 'http://localhost:3000' } = params;

  if (trip.paymentStatus === 'paystack_paid') {
    return { success: false, error: 'This trip has already been paid via Paystack' };
  }

  const fareNaira = trip.fareNaira;
  if (!fareNaira || fareNaira <= 0) {
    return { success: false, error: 'Invalid trip fare amount' };
  }

  const amountKobo = Math.round(fareNaira * 100);
  const reference = `ZYLIFT_TRP_${trip.id}_${Date.now()}`;
  const driver = trip.driverId ? pilotDb.getDriver(trip.driverId) : null;
  const subaccountCode = driver?.paystackSubaccountCode;
  const hasConnectedAccount = Boolean(subaccountCode || (driver?.accountNumber && driver?.bankCode));

  // If driver has not connected bank account / subaccount, block online transfer payment
  if (!hasConnectedAccount) {
    return {
      success: false,
      error: `${driver?.name || 'Your driver'} has not connected a settlement bank account yet. Online transfer is unavailable for this trip. Please pay with Cash directly to the driver.`,
    };
  }

  const email = riderEmail || `${trip.riderPhone.replace(/\D/g, '') || 'rider'}@zyliftcampus.ng`;

  const secretKey = getSecretKey();
  if (isPaystackConfigured()) {
    try {
      const payload: Record<string, any> = {
        amount: amountKobo,
        email,
        reference,
        callback_url: `${appUrl}/api/payments/paystack/callback`,
        metadata: {
          tripId: trip.id,
          riderId: trip.riderId,
          riderPhone: trip.riderPhone,
          driverId: driver?.id || null,
          driverName: driver?.name || null,
          fareNaira: trip.fareNaira,
          subaccountCode: subaccountCode || null,
          custom_fields: [
            { display_name: 'Trip ID', variable_name: 'trip_id', value: trip.id },
            { display_name: 'Route', variable_name: 'route', value: `${trip.pickupName} -> ${trip.dropoffName}` },
            { display_name: 'Driver', variable_name: 'driver', value: driver?.name || 'Assigned Driver' },
          ],
        },
      };

      // Attach Paystack Subaccount for automated split payment directly to driver bank
      // Skip dev mock codes (ACCT_MOCK_*) so real Paystack keys don't fail transaction initialization
      if (subaccountCode && !subaccountCode.startsWith('ACCT_MOCK_')) {
        payload.subaccount = subaccountCode;
        payload.bearer = 'subaccount'; // or 'account'
      }

      const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.status && data.data && data.data.authorization_url) {
        const finalRef = data.data.reference || reference;
        trip.pendingPaystackReference = finalRef;
        pilotDb.persistSync();
        return {
          success: true,
          authorizationUrl: data.data.authorization_url,
          reference: finalRef,
          fareNaira,
          subaccountCode,
        };
      }
      return { success: false, error: data.message || 'Could not initialize Paystack checkout' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Payment initialization network failure' };
    }
  }

  // Development sandbox simulation: requires explicit checkout completion before verification succeeds
  pendingDevCheckouts.set(reference, {
    tripId: trip.id,
    fareNaira,
    paid: false,
    createdAt: Date.now(),
  });
  trip.pendingPaystackReference = reference;
  pilotDb.persistSync();
  return {
    success: true,
    authorizationUrl: `/payment/dev-checkout?reference=${encodeURIComponent(reference)}&tripId=${encodeURIComponent(trip.id)}&amount=${fareNaira}`,
    reference,
    fareNaira,
    subaccountCode: subaccountCode || 'ACCT_DEV_SPLIT',
    isSimulation: true,
  };
}

/**
 * 5. Verify Per-Trip Paystack Payment
 * Strict verification against Paystack API with idempotent persistent recording.
 */
export async function verifyTripPaystackPayment(
  rawReference: string
): Promise<{ success: boolean; trip?: TripRecord; alreadyProcessed?: boolean; error?: string }> {
  // Sanitize reference: clean comma-separated or duplicate values
  const reference = String(rawReference || '').split(',')[0].trim();
  if (!reference) {
    return { success: false, error: 'Payment reference is required' };
  }

  // Idempotency check: prevent double processing across server reboots
  if (pilotDb.isPaymentReferenceProcessed(reference)) {
    const existingTrip = pilotDb.getAllTrips().find((t) => t.paystackReference === reference);
    return { success: true, alreadyProcessed: true, trip: existingTrip || undefined };
  }

  const secretKey = getSecretKey();
  if (isPaystackConfigured()) {
    try {
      const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json();

      if (!data.status || !data.data || data.data.status !== 'success') {
        return {
          success: false,
          error: data.data?.gateway_response || data.message || 'Payment not completed or failed on Paystack',
        };
      }

      const tripId = data.data.metadata?.tripId;
      if (!tripId) {
        return { success: false, error: 'Invalid transaction metadata: missing tripId' };
      }

      const trip = pilotDb.getTrip(tripId);
      if (!trip) {
        return { success: false, error: `Trip not found for id: ${tripId}` };
      }

      // Verify exact paid amount matches trip fare (tamper protection)
      const expectedKobo = Math.round(trip.fareNaira * 100);
      if (data.data.amount < expectedKobo) {
        return {
          success: false,
          error: `Amount paid (₦${data.data.amount / 100}) is less than trip fare (₦${trip.fareNaira})`,
        };
      }

      const confirmedTrip = pilotDb.confirmTripPaystackPayment(trip.id, reference, data.data);
      if (!confirmedTrip.success) {
        return { success: false, error: confirmedTrip.error };
      }

      return { success: true, trip: confirmedTrip.trip };
    } catch (e: any) {
      return { success: false, error: e.message || 'Payment verification network error' };
    }
  }

  // Development sandbox fallback (only when Paystack keys not set and checkout was explicitly completed)
  const devEntry = pendingDevCheckouts.get(reference);
  if (devEntry) {
    if (!devEntry.paid) {
      return { success: false, error: 'Payment pending completion in Paystack sandbox checkout' };
    }
    const trip = pilotDb.getTrip(devEntry.tripId);
    if (trip) {
      const confirmedTrip = pilotDb.confirmTripPaystackPayment(trip.id, reference, {
        channel: devEntry.channel || 'card',
        simulated: true,
      });
      return { success: true, trip: confirmedTrip.trip };
    }
  }

  return { success: false, error: 'Transaction reference not found' };
}
