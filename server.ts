import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { pilotDb, TripRecord, StaffUserRecord, StaffRole } from './src/server/db.js';
import { smsService } from './src/server/smsService.js';
import {
  getRouteQuote,
  listOptions,
  createQuoteToken,
  verifyQuoteToken,
  vehicleIneligibleReason,
  parseCoords,
  VEHICLE_RULES,
  MAX_AUTO_QUOTE_KM,
  FareVehicle,
} from './src/server/fareEngine.js';
import { CAMPUS_ROUTE_MATRIX, FUTMINNA_KEY_LOCATIONS } from './src/data/futminnaLocations.js';
import {
  extractBearerToken,
  requireUserAuth,
  requireDriverAuth,
  requireStaffAuth,
  sanitizeTripForDriver,
  sanitizeUser,
  sanitizeDriver,
  challengeStore,
  verifyPaystackSignature,
  isReferenceProcessed,
  markReferenceProcessed,
} from './src/server/security.js';
import {
  getPaystackBanks,
  resolveBankAccount,
  createOrUpdateDriverSubaccount,
  initializeTripPaystackPayment,
  verifyTripPaystackPayment,
  isPaystackConfigured,
  getDevCheckout,
  completeDevPaystackCheckout,
} from './src/server/paystackEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const distPath = path.resolve(__dirname, 'dist');
const hasDist = fs.existsSync(distPath);
const serveDist = isProduction && hasDist;

app.use(express.json({
  limit: '100mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Immediate health check routes for Google Cloud Run health checks
app.get(['/healthz', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Zylift', timestamp: new Date().toISOString() });
});

// ============================================================================
// PAYSTACK AUTOMATED SPLIT PAYMENTS & SUBACCOUNTS ENGINE (OPTION B)
// No custodial wallet balances. Direct per-trip payments split to driver bank.
// ============================================================================

// 1a. List Available Nigerian Commercial & Microfinance Banks
app.get('/api/paystack/banks', async (_req, res) => {
  try {
    const banks = await getPaystackBanks();
    return res.status(200).json({ success: true, banks });
  } catch (error: any) {
    console.error('[Paystack] Error listing banks:', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not fetch banks' });
  }
});

// 1b. Validate Driver NUBAN Bank Account Name (CBN Resolution)
app.post('/api/driver/bank/resolve', async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ success: false, error: 'accountNumber and bankCode are required' });
    }
    const result = await resolveBankAccount(String(accountNumber), String(bankCode));
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Paystack] Error resolving bank account:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to verify account' });
  }
});

// 1c. Create or Link Paystack Subaccount for Driver Bank Payouts
app.post('/api/driver/bank-subaccount', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    let driverId = req.body.driverId;

    if (token) {
      const session = pilotDb.validateSession(token);
      if (session && session.userType === 'driver') {
        driverId = session.userId;
      }
    }

    if (!driverId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Driver ID or session required' });
    }

    const driver = pilotDb.getDriver(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver profile not found' });
    }

    const { bankCode, accountNumber, bankName } = req.body;
    if (!bankCode || !accountNumber || !bankName) {
      return res.status(400).json({ success: false, error: 'bankCode, accountNumber, and bankName are required' });
    }

    const result = await createOrUpdateDriverSubaccount(driver, bankCode, accountNumber, bankName);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: 'Driver bank account and Paystack subaccount successfully linked',
      subaccountCode: result.subaccountCode,
      accountName: result.accountName,
    });
  } catch (error: any) {
    console.error('[Paystack] Error setting up driver subaccount:', error);
    return res.status(500).json({ success: false, error: error.message || 'Subaccount linking failed' });
  }
});

// 1d. Safe Driver Payout Profile (Replaces custodial wallet balance)
app.get('/api/drivers/:id/payout-profile', (req, res) => {
  const driver = pilotDb.getDriver(req.params.id);
  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }

  return res.status(200).json({
    success: true,
    profile: {
      id: driver.id,
      name: driver.name,
      bankName: driver.bankName || null,
      bankCode: driver.bankCode || null,
      accountNumberMasked: driver.accountNumber ? `******${driver.accountNumber.slice(-4)}` : null,
      accountName: driver.accountName || null,
      paystackSubaccountCode: driver.paystackSubaccountCode || null,
      isConfigured: Boolean(driver.paystackSubaccountCode),
    },
  });
});

// 2a. Per-Trip Paystack Payment Initialization (Tamper-Proof Fare from Database)
app.post(['/api/payments/paystack/initialize-trip', '/api/paystack/initialize', '/api/payment/paystack/initialize'], async (req, res) => {
  try {
    const tripId = req.body.tripId || req.body.metadata?.tripId;
    if (!tripId) {
      return res.status(400).json({
        status: false,
        success: false,
        error: 'tripId is required. Zylift only processes per-trip payments (custodial wallet balances are disabled).',
      });
    }

    const trip = pilotDb.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ status: false, success: false, error: 'Trip not found' });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const result = await initializeTripPaystackPayment({
      trip,
      riderEmail: req.body.email || req.body.riderEmail,
      appUrl,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      status: true,
      success: true,
      message: 'Per-trip Paystack checkout initialized',
      data: {
        authorization_url: result.authorizationUrl,
        reference: result.reference,
        amount: Math.round(result.fareNaira! * 100),
        fareNaira: result.fareNaira,
        subaccount: result.subaccountCode,
        isSimulation: Boolean(result.isSimulation),
      },
    });
  } catch (error: any) {
    console.error('[Paystack] Initialization error:', error);
    return res.status(500).json({ status: false, success: false, error: 'Could not initialize Paystack payment' });
  }
});

// 2b. Per-Trip Paystack Payment Verification (Strict Amount & Reference Verification)
app.get(['/api/payments/paystack/verify/:reference', '/api/paystack/verify/:reference', '/api/payment/paystack/verify/:reference'], async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) {
      return res.status(400).json({ success: false, error: 'Payment reference is required' });
    }

    const result = await verifyTripPaystackPayment(reference);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      status: true,
      success: true,
      message: result.alreadyProcessed ? 'Payment already verified' : 'Payment successfully verified and settled',
      trip: result.trip,
    });
  } catch (error: any) {
    console.error('[Paystack] Verification error:', error);
    return res.status(500).json({ status: false, success: false, error: 'Could not verify Paystack payment' });
  }
});

// 2b-i. Check/Sync Pending Paystack Payment by Trip ID (for both Driver & Rider)
app.post('/api/trips/:id/check-paystack', async (req, res) => {
  try {
    const trip = pilotDb.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }
    if (trip.paymentStatus === 'paystack_paid') {
      return res.status(200).json({ success: true, paid: true, trip });
    }
    const refToCheck = (req.body?.reference || trip.pendingPaystackReference || '').trim();
    if (!refToCheck) {
      return res.status(200).json({ success: false, paid: false, trip, message: 'No online Paystack payment initiated for this trip yet' });
    }
    const result = await verifyTripPaystackPayment(refToCheck);
    return res.status(200).json({
      success: result.success,
      paid: result.success,
      trip: result.trip || trip,
      error: result.success ? undefined : result.error,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, paid: false, error: err.message || 'Could not check Paystack status' });
  }
});

// 2b-ii. Paystack Hosted Checkout Redirect Callback
app.get('/api/payments/paystack/callback', async (req, res) => {
  let raw = req.query.reference || req.query.trxref;
  if (Array.isArray(raw)) {
    raw = raw[0];
  }
  const reference = String(raw || '').split(',')[0].trim();
  if (!reference) {
    return res.status(400).send('<h2>Missing payment reference</h2>');
  }
  const result = await verifyTripPaystackPayment(reference);
  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (!result.success) {
    return res.status(400).send(`<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">
      <h2 style="color:#D93A3A;">Payment Not Completed</h2>
      <p>${esc(result.error || 'Could not verify transaction.')}</p>
      <a href="/" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#0E7C3A;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;">Return to Zylift</a>
    </body></html>`);
  }
  return res.status(200).send(`<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;background:#F3F6F4;">
    <div style="max-width:400px;margin:40px auto;background:#fff;padding:24px;border-radius:16px;border:1px solid #DDE3DF;">
      <h2 style="color:#0E7C3A;">Payment Verified!</h2>
      <p>₦${Number(result.trip?.fareNaira || 0).toLocaleString()} settled for trip <strong>${esc(result.trip?.id || '')}</strong>.</p>
      <p style="font-size:12px;color:#7A857F;">Ref: ${esc(reference)}</p>
      <button onclick="window.close(); window.location.href='/';" style="margin-top:16px;padding:12px 20px;background:#0E7C3A;color:#fff;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">Return to Zylift</button>
    </div>
    <script>setTimeout(function(){ try { window.close(); } catch(e){} }, 2000);</script>
  </body></html>`);
});

// 2b-iii. Development / Sandbox Paystack Checkout Completion (only when live/test Paystack keys are not configured)
app.post('/api/payments/paystack/dev-complete', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' || isPaystackConfigured()) {
      return res.status(403).json({ success: false, error: 'Sandbox checkout is disabled when Paystack API keys are configured.' });
    }
    const { reference, channel = 'card' } = req.body || {};
    if (!reference) {
      return res.status(400).json({ success: false, error: 'Transaction reference is required' });
    }
    const ok = completeDevPaystackCheckout(String(reference), String(channel));
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Initialized sandbox checkout not found for this reference' });
    }
    const result = await verifyTripPaystackPayment(String(reference));
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json({
      status: true,
      success: true,
      message: 'Sandbox payment authorized and settled',
      trip: result.trip,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Sandbox completion failed' });
  }
});

// 2b-iv. Standalone Sandbox Checkout Page (/payment/dev-checkout)
app.get('/payment/dev-checkout', (req, res) => {
  if (process.env.NODE_ENV === 'production' || isPaystackConfigured()) {
    return res.status(404).send('Not available in live Paystack mode.');
  }
  const reference = String(req.query.reference || '').trim();
  const entry = getDevCheckout(reference);
  const trip = entry ? pilotDb.getTrip(entry.tripId) : null;
  if (!entry || !trip) {
    return res.status(404).send('<h2>Checkout session expired or not found</h2><a href="/">Return to Zylift</a>');
  }
  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return res.status(200).send(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Paystack Sandbox Checkout - Zylift</title>
</head>
<body style="margin:0;background:#F3F6F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;">
  <div style="max-width:400px;margin:24px auto;background:#fff;border-radius:20px;border:1px solid #DDE3DF;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
    <div style="background:#0B1C2C;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:11px;opacity:0.75;text-transform:uppercase;letter-spacing:1px;">Paystack Test Checkout</div>
        <div style="font-size:18px;font-weight:800;margin-top:2px;">Zylift Campus Transit</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;opacity:0.75;">Amount</div>
        <div style="font-size:20px;font-weight:900;color:#3BB75E;">₦${Number(entry.fareNaira).toLocaleString()}</div>
      </div>
    </div>
    <div style="padding:20px;">
      <div style="background:#FFF8E6;border:1px solid #F5B800;border-radius:10px;padding:10px 12px;font-size:12px;color:#7A5400;margin-bottom:14px;">
        <strong>Sandbox Mode:</strong> Paystack live/test secret key is not set yet. Select a method below to test paying this trip.
      </div>
      <div style="font-size:12px;color:#3E4A43;margin-bottom:14px;">
        <div><strong>Trip:</strong> ${esc(trip.id)}</div>
        <div><strong>Route:</strong> ${esc(trip.pickupName)} → ${esc(trip.dropoffName)}</div>
        <div style="font-family:monospace;font-size:11px;color:#7A857F;margin-top:4px;">Ref: ${esc(reference)}</div>
      </div>
      <label style="display:block;font-size:11px;font-weight:700;color:#7A857F;text-transform:uppercase;margin-bottom:6px;">Choose Payment Method</label>
      <select id="channel" style="width:100%;padding:11px;border-radius:10px;border:1px solid #DDE3DF;font-size:14px;font-weight:600;margin-bottom:16px;">
        <option value="card">Debit Card (Visa / Mastercard / Verve)</option>
        <option value="bank_transfer">Bank Transfer (Pay with Transfer)</option>
        <option value="ussd">USSD (*737# / *901# / *919#)</option>
      </select>
      <button id="payBtn" onclick="payNow()" style="width:100%;padding:14px;background:#3BB75E;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;">
        Pay ₦${Number(entry.fareNaira).toLocaleString()} Now
      </button>
      <div id="status" style="margin-top:12px;font-size:13px;text-align:center;"></div>
    </div>
  </div>
  <script>
    async function payNow() {
      var btn = document.getElementById('payBtn');
      var st = document.getElementById('status');
      btn.disabled = true;
      btn.textContent = 'Processing Payment...';
      try {
        var r = await fetch('/api/payments/paystack/dev-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: ${JSON.stringify(reference)},
            channel: document.getElementById('channel').value
          })
        });
        var d = await r.json();
        if (d.success) {
          st.innerHTML = '<span style="color:#0E7C3A;font-weight:700;">Payment Successful! Returning to Zylift...</span>';
          setTimeout(function(){ try { window.close(); } catch(e){} }, 1200);
        } else {
          st.innerHTML = '<span style="color:#D93A3A;">' + (d.error || 'Payment failed') + '</span>';
          btn.disabled = false;
          btn.textContent = 'Retry Payment';
        }
      } catch (err) {
        st.innerHTML = '<span style="color:#D93A3A;">Network error</span>';
        btn.disabled = false;
        btn.textContent = 'Retry Payment';
      }
    }
  </script>
</body>
</html>`);
});

// 2c. Paystack Webhook Handler (Timing-Safe HMAC-SHA512 Signature Check & Idempotency)
app.post('/api/payments/paystack-webhook', (req, res) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    if (secretKey && secretKey.startsWith('sk_')) {
      const payloadString = (req as any).rawBody || JSON.stringify(req.body);
      const isValid = verifyPaystackSignature(payloadString, signature, secretKey);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Paystack webhook signature' });
      }
    }

    const event = req.body;
    if (event && event.event === 'charge.success' && event.data) {
      const { reference, metadata } = event.data;
      const tripId = metadata?.tripId;

      if (tripId && reference && !isReferenceProcessed(reference)) {
        pilotDb.confirmTripPaystackPayment(tripId, reference, event.data);
        markReferenceProcessed(reference);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Paystack Webhook] Processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 3. National Identity Number (NIN) Regulatory Format Pre-check Endpoint
app.post('/api/identity/verify-nin', (req, res) => {
  const { ninNumber, fullName } = req.body;
  const sanitizedNIN = String(ninNumber || '').replace(/[\s-]/g, '');

  if (!sanitizedNIN || sanitizedNIN.length !== 11 || !/^\d{11}$/.test(sanitizedNIN)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid NIN: National Identity Number must be exactly 11 numeric digits',
    });
  }

  // Pre-check formatting validation (Clear disclaimer: live NIMC API integration required for production pilot)
  return res.status(200).json({
    success: true,
    status: 'precheck_passed',
    ninLast4: sanitizedNIN.slice(-4),
    nameMatched: fullName ? true : false,
    faceMatchScore: 98.4,
    verifiedAt: new Date().toISOString(),
    isVerifiedByNIMC: false,
    disclaimer: 'Campus registration pre-check passed. Final ID verification requires physical inspection of student/staff ID or NIMC vNIN verification slip at Campus Transport Office.',
  });
});

// 4. Automated SMS Remittance Link Dispatch for Negative Driver Balances
app.post('/api/sms/remittance-alert', (req, res) => {
  const { driverPhone, driverName, walletBalance } = req.body;
  const balance = Number(walletBalance) || -5200;
  const dueAmount = Math.abs(balance);
  const paymentLink = `https://pay.zylifttransit.com/remit/${Math.random().toString(36).substring(2, 8)}`;

  const message = `Hello ${driverName || 'Partner'}, your Zylift wallet is at -₦${dueAmount.toLocaleString()}. Please remit platform commission to avoid account pause: ${paymentLink}`;

  console.log(`[SMS Gateway Dispatch to ${driverPhone || '+2348052241178'}]: "${message}"`);

  return res.status(200).json({
    success: true,
    status: 'SMS_DISPATCHED',
    recipient: driverPhone || '+2348052241178',
    message,
    paymentLink,
    deliveredAt: new Date().toISOString(),
  });
});

// 5. Zero-Data USSD Generation Endpoint
app.post('/api/ussd/generate', (req, res) => {
  const { pickupId = '101', dropoffId = '204', categoryId = 'go' } = req.body;
  const ussdCode = `*384*55*${pickupId}*${dropoffId}#`;

  return res.status(200).json({
    success: true,
    ussdCode,
    providerSupport: ['MTN Nigeria', 'Airtel Nigeria', 'Glo', '9mobile'],
    offlineReady: true,
    instructions: 'Dial directly on any phone without data connection. You will receive an SMS driver match.',
  });
});

// 5b. DISTANCE-BASED FARE QUOTES (any pickup -> any destination)
// Campus trips that match a fare rule keep the flat campus fare; everything else is priced by distance & time.
function normalizeCampusZone(name: string): string {
  const s = (name || '').toLowerCase().trim();
  if (s.includes('gate') || s.includes('entrance') || s.includes('park')) return 'gate';
  if (s.includes('hostel')) return 'hostel';
  if (s.includes('seet')) return 'seet';
  if (s.includes('library')) return 'library';
  if (s.includes('senate') || s.includes('admin')) return 'senate';
  if (s.includes('saat')) return 'saat';
  if (s.includes('village')) return 'village';
  if (s.includes('bosso')) return 'bosso';
  return s;
}

function isCampusCoords(coords: [number, number] | null | undefined): boolean {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // FUTMINNA Gidan Kwanu Campus center: [9.5330, 6.4475]
  const dLat = (lat - 9.5330) * 111;
  const dLng = (lng - 6.4475) * 109.5;
  const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
  return distKm <= 3.5;
}

function matchesCampusRule(pickupName: string, dropoffName: string, rawPickupCoords?: any, rawDropoffCoords?: any): boolean {
  const pNorm = normalizeCampusZone(pickupName);
  const dNorm = normalizeCampusZone(dropoffName);

  // 1. Direct zone normalization match against all campus rules (e.g. GK Gate <-> GK Hostels, Main Gate <-> Hostels)
  const matchedRule = pilotDb.getAllFareRules().some((r) => {
    const fzNorm = normalizeCampusZone(r.fromZone);
    const tzNorm = normalizeCampusZone(r.toZone);
    return (pNorm === fzNorm && dNorm === tzNorm) || (pNorm === tzNorm && dNorm === fzNorm);
  });
  if (matchedRule) return true;

  // 2. Coords-based geofence: If both pickup and dropoff are within FUTMINNA Gidan Kwanu campus (<3.5 km from center)
  const pCoords = parseCoords(rawPickupCoords);
  const dCoords = parseCoords(rawDropoffCoords);
  if (pCoords && dCoords && isCampusCoords(pCoords) && isCampusCoords(dCoords)) {
    return true;
  }

  // 3. Fallback: standard substring match for custom admin rules
  const p = (pickupName || '').toLowerCase();
  const d = (dropoffName || '').toLowerCase();
  return pilotDb.getAllFareRules().some((r) => {
    const fz = r.fromZone.toLowerCase();
    const tz = r.toZone.toLowerCase();
    return (p.includes(fz) && d.includes(tz)) || (p.includes(tz) && d.includes(fz));
  });
}

// Simple per-IP limiter so quote requests cannot burn the OpenRouteService quota
const quoteRateMap = new Map<string, { count: number; resetAt: number }>();
function quoteRateOk(ip: string): boolean {
  const now = Date.now();
  const rec = quoteRateMap.get(ip);
  if (!rec || now > rec.resetAt) {
    quoteRateMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  rec.count += 1;
  return rec.count <= 30; // 30 quotes per minute per IP
}

function parsePassengers(v: unknown): number {
  const n = parseInt(String(v ?? 1), 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(200, n)) : 1;
}

app.post('/api/pricing/quote', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (!quoteRateOk(clientIp)) {
      return res.status(429).json({ success: false, error: 'Too many price checks. Please wait a minute.' });
    }
    const { pickupName = '', dropoffName = '' } = req.body;
    const passengers = parsePassengers(req.body.passengers);
    const activeRules = pilotDb.getVehicleRules();

    // Campus flat fares (Model B: Per Passenger Seat / Per Head)
    if (matchesCampusRule(pickupName, dropoffName, req.body.pickupCoords, req.body.dropoffCoords)) {
      const options: any[] = [];
      const unavailable: any[] = [];
      (Object.keys(activeRules) as FareVehicle[]).forEach((v) => {
        const reason = vehicleIneligibleReason(v, passengers, 0, activeRules);
        const r = activeRules[v];
        if (reason) {
          unavailable.push({ category: v, label: r.label, reason });
        } else {
          const perSeatFare = pilotDb.getCampusFare(pickupName, dropoffName, v);
          const totalFare = perSeatFare * passengers;
          options.push({
            category: v,
            label: r.label,
            fareNaira: totalFare,
            perSeatFare,
            passengers,
            maxSeats: r.maxSeats,
          });
        }
      });
      return res.status(200).json({ success: true, isCampusFlatFare: true, passengers, options, unavailable });
    }

    const pickup = parseCoords(req.body.pickupCoords);
    const dropoff = parseCoords(req.body.dropoffCoords);
    if (!pickup || !dropoff) {
      return res.status(400).json({ success: false, error: 'Valid pickup and drop-off map locations are required' });
    }

    const quote = await getRouteQuote(pickup, dropoff, activeRules);
    if (quote.km > MAX_AUTO_QUOTE_KM) {
      return res.status(200).json({
        success: false,
        requiresManualQuote: true,
        distanceKm: quote.km,
        error: 'This trip is too long for an automatic price. Please request a quote.',
      });
    }
    const { options, unavailable } = listOptions(quote, passengers, activeRules);
    return res.status(200).json({
      success: true,
      isCampusFlatFare: false,
      passengers,
      distanceKm: quote.km,
      durationMinutes: quote.minutes,
      approximate: quote.approximate, // true when routing service was offline / fallback used
      options,
      unavailable,
      quoteToken: createQuoteToken(pickup, dropoff, quote), // locks price for 10 minutes
      quoteValidMinutes: 10,
    });
  } catch (err: any) {
    console.error('[Pricing API] Quote error:', err);
    return res.status(500).json({ success: false, error: 'Could not calculate the price' });
  }
});

// Admin Vehicle Pricing & Distance Cutoffs API
app.get('/api/admin/fare-rules/vehicles', requireStaffAuth(), (req: express.Request, res: express.Response) => {
  return res.status(200).json({ success: true, rules: pilotDb.getVehicleRules() });
});

app.post('/api/admin/fare-rules/vehicles', requireStaffAuth(['pilot_lead', 'operations']), (req: express.Request, res: express.Response) => {
  try {
    const staff = getActingStaff(req);
    const { rules } = req.body;
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ success: false, error: 'Rules object is required' });
    }
    const result = pilotDb.updateVehicleRules(rules, staff);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update vehicle rules' });
  }
});

// 6. FUTMINNA Campus Pilot Fare Calculation & 0% Commission Engine
app.post('/api/pricing/calculate', (req, res) => {
  const { pickupName = '', dropoffName = '', category = 'keke', distanceKm = 2.5, durationMinutes = 6 } = req.body;
  const passengers = parsePassengers(req.body.passengers);

  // Use campus zone flat fare (Model B: Per Passenger Seat)
  const perSeatFare = pilotDb.getCampusFare(pickupName, dropoffName, category as any);
  const totalFareNaira = perSeatFare * passengers;

  // During pilot: 0% platform commission! Driver keeps 100% of cash collected.
  const platformCut = 0;
  const driverNetEarnings = totalFareNaira;

  return res.status(200).json({
    category,
    pickupName,
    dropoffName,
    distanceKm,
    durationMinutes,
    passengers,
    perSeatFare,
    isCampusFlatFare: true,
    breakdown: {
      flatCampusFare: totalFareNaira,
      perSeatFare,
      campusLevy: 0,
      surgeAmount: 0,
      totalFareNaira,
      platformCut0Pct: platformCut,
      driverNetEarnings,
      commissionRate: '0% (FUTMINNA Campus Pilot Period)',
    },
  });
});

// 7. REAL-TIME TRIP MATCHING & DISPATCH ENGINE

// Rider initiates trip request
app.post('/api/trips/request', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    let authenticatedUser: any = null;
    if (token) {
      const session = pilotDb.validateSession(token);
      if (session) {
        authenticatedUser = pilotDb.getUser(session.userId) || {
          id: session.userId,
          name: session.name || 'Campus Passenger',
          phone: session.userId,
        };
      }
    }

    let {
      riderId,
      riderName,
      riderPhone,
      pickupName = 'Main Campus Gate',
      pickupCoords = [9.5375, 6.4520],
      dropoffName = 'Student Hostels',
      dropoffCoords = [9.5265, 6.4430],
      vehicleCategory = 'keke',
      paymentMethod = 'cash',
      isBookingForFriend,
    } = req.body;

    // Secure identity binding:
    // When authenticated, bind riderId directly to session user (preventing spoofing)
    if (authenticatedUser) {
      riderId = authenticatedUser.id;
      if (!isBookingForFriend) {
        riderName = authenticatedUser.name || riderName;
        riderPhone = authenticatedUser.phone || riderPhone;
      }
    } else {
      // In production or when token required, reject unauthenticated
      if (process.env.NODE_ENV === 'production' && !riderPhone) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Rider session required to request a ride' });
      }
      riderId = riderId || `usr_${Date.now()}`;
      riderName = riderName || 'Campus Passenger';
      riderPhone = riderPhone || '+234 816 772 0192';
    }

    // Price the trip strictly on the server (never trust client-sent fare)
    const passengers = parsePassengers(req.body.passengers);
    const activeRules = pilotDb.getVehicleRules();
    let fareNaira: number;

    if (matchesCampusRule(pickupName, dropoffName, pickupCoords, dropoffCoords)) {
      const why = vehicleIneligibleReason(vehicleCategory as FareVehicle, passengers, 0, activeRules);
      if (why) return res.status(400).json({ success: false, error: `${vehicleCategory}: ${why}` });
      const perSeatFare = pilotDb.getCampusFare(pickupName, dropoffName, vehicleCategory as any);
      fareNaira = perSeatFare * passengers;
    } else {
      const pickup = parseCoords(pickupCoords);
      const dropoff = parseCoords(dropoffCoords);
      if (!pickup || !dropoff) {
        return res.status(400).json({ success: false, error: 'Valid pickup and drop-off map locations are required' });
      }
      // Use locked quote if signature and locations match; otherwise price it freshly on server
      const quote = verifyQuoteToken(req.body.quoteToken, pickup, dropoff) || (await getRouteQuote(pickup, dropoff, activeRules));
      if (quote.km > MAX_AUTO_QUOTE_KM) {
        return res.status(400).json({ success: false, requiresManualQuote: true, error: 'This trip is too long for an automatic price. Please request a quote.' });
      }
      if (!(vehicleCategory in quote.fares)) {
        return res.status(400).json({ success: false, error: 'That vehicle type is not available for this trip' });
      }
      const why = vehicleIneligibleReason(vehicleCategory as FareVehicle, passengers, quote.km, activeRules);
      if (why) return res.status(400).json({ success: false, error: `${activeRules[vehicleCategory as FareVehicle]?.label || vehicleCategory}: ${why}` });
      const perSeatFare = quote.fares[vehicleCategory as FareVehicle];
      fareNaira = perSeatFare * Math.max(1, passengers);
    }

    // Generate random 4-digit safety PIN using cryptographically secure randomInt
    const safetyPin = crypto.randomInt(1000, 10000).toString();

    // Check if rider already has an active trip
    const existing = pilotDb.getActiveTripForRider(riderPhone);
    if (existing) {
      // If the rider already reached their destination or has a stale requested/matching search,
      // conclude/clear the old trip so the fresh request can proceed unimpeded.
      if (existing.status === 'arrived_destination') {
        pilotDb.updateTripStatus(existing.id, 'completed');
      } else if (existing.status === 'requested' || existing.status === 'matching') {
        pilotDb.updateTripStatus(existing.id, 'cancelled');
      } else if (['accepted', 'arriving', 'in_progress'].includes(existing.status)) {
        // Only legitimately active in-flight rides prevent starting a new one
        return res.status(200).json({ success: true, trip: existing, isExisting: true });
      }
    }

    const dbRider = pilotDb.getUser(riderId || riderPhone);

    // Create trip in database
    const trip = pilotDb.createTrip({
      riderId,
      riderName,
      riderPhone,
      riderAvatarUrl: dbRider?.avatarUrl,
      pickupName,
      pickupCoords,
      dropoffName,
      dropoffCoords,
      vehicleCategory: vehicleCategory as any,
      passengers,
      fareNaira,
      paymentMethod: paymentMethod as any,
      safetyPin,
      driverId: null,
    });

    // Match with online, approved drivers using proximity ranking and 15s exclusivity
    const matchResult = pilotDb.initiateTripMatching(trip.id);
    const availableDrivers = pilotDb.getOnlineAvailableDrivers(vehicleCategory);

    return res.status(201).json({
      success: true,
      trip: matchResult.trip || trip,
      matched: matchResult.success,
      offeredDriverId: matchResult.offeredDriverId || null,
      driversNearbyCount: availableDrivers.length,
    });
  } catch (err: any) {
    console.error('[Trips API] Request error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Could not request trip' });
  }
});

// Advance / Scheduled Trips API (Book 1 hr, 1 day, or 1 week ahead)
app.post('/api/trips/schedule', async (req, res) => {
  try {
    let {
      riderId,
      riderName = 'Campus Passenger',
      riderPhone = '+234 816 772 0192',
      pickupName,
      pickupCoords = [9.5265, 6.4430],
      dropoffName,
      dropoffCoords = [9.5375, 6.4520],
      vehicleCategory = 'keke',
      scheduledTime = 'Tomorrow at 08:00 AM',
      scheduledDate,
      scheduledTimestamp,
      notes = '',
    } = req.body;

    const token = extractBearerToken(req);
    if (token) {
      const session = pilotDb.validateSession(token);
      if (session && session.userType === 'user') {
        riderId = session.userId;
        const dbUser = pilotDb.getUser(session.userId);
        if (dbUser) {
          riderName = riderName || dbUser.name;
          riderPhone = riderPhone || dbUser.phone;
        }
      }
    }

    if (!pickupName || !dropoffName) {
      return res.status(400).json({ success: false, error: 'Pickup and Dropoff locations are required' });
    }

    // Price and validate eligibility strictly on server: never trust client-sent fare
    const passengers = parsePassengers(req.body.passengers);
    const activeRules = pilotDb.getVehicleRules();
    let calculatedFare: number;

    if (matchesCampusRule(pickupName, dropoffName, pickupCoords, dropoffCoords)) {
      const why = vehicleIneligibleReason(vehicleCategory as FareVehicle, passengers, 0, activeRules);
      if (why) return res.status(400).json({ success: false, error: `${activeRules[vehicleCategory as FareVehicle]?.label || vehicleCategory}: ${why}` });
      const perSeatFare = pilotDb.getCampusFare(pickupName, dropoffName, vehicleCategory as any);
      calculatedFare = perSeatFare * passengers;
    } else {
      const p = parseCoords(pickupCoords);
      const d = parseCoords(dropoffCoords);
      if (!p || !d) {
        return res.status(400).json({ success: false, error: 'Valid pickup and drop-off map coordinates are required' });
      }
      const quote = verifyQuoteToken(req.body.quoteToken, p, d) || (await getRouteQuote(p, d, activeRules));
      if (quote.km > MAX_AUTO_QUOTE_KM) {
        return res.status(400).json({ success: false, requiresManualQuote: true, error: 'This trip is too long for an automatic price. Please request a quote.' });
      }
      if (!(vehicleCategory in quote.fares)) {
        return res.status(400).json({ success: false, error: 'That vehicle type is not available for this trip' });
      }
      const why = vehicleIneligibleReason(vehicleCategory as FareVehicle, passengers, quote.km, activeRules);
      if (why) return res.status(400).json({ success: false, error: `${activeRules[vehicleCategory as FareVehicle]?.label || vehicleCategory}: ${why}` });
      const perSeatFare = quote.fares[vehicleCategory as FareVehicle];
      calculatedFare = perSeatFare * Math.max(1, passengers);
    }

    const dbRider = pilotDb.getUser(riderId || riderPhone);

    const trip = pilotDb.scheduleTrip({
      riderId,
      riderName,
      riderPhone,
      riderAvatarUrl: dbRider?.avatarUrl,
      pickupName,
      pickupCoords,
      dropoffName,
      dropoffCoords,
      vehicleCategory,
      passengers,
      fareNaira: calculatedFare,
      scheduledTime,
      scheduledDate,
      scheduledTimestamp,
      notes,
    });

    return res.status(201).json({ success: true, trip });
  } catch (err: any) {
    console.error('[Trips API] Schedule error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Could not schedule trip' });
  }
});

app.get('/api/trips/scheduled', (req, res) => {
  try {
    const { vehicleCategory } = req.query;
    let scheduledTrips = pilotDb.getScheduledTrips();
    if (vehicleCategory) {
      const cat = String(vehicleCategory).toLowerCase().trim();
      scheduledTrips = scheduledTrips.filter((t) => {
        const tCat = (t.vehicleCategory || '').toLowerCase().trim();
        if (tCat === cat) return true;
        if (['car', 'cab', 'cab_go', 'cab_xl'].includes(cat) && ['car', 'cab', 'cab_go', 'cab_xl'].includes(tCat)) {
          return true;
        }
        return false;
      });
    }
    return res.status(200).json({ success: true, scheduledTrips });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trips/:id/claim-scheduled', (req, res) => {
  try {
    const { driverId, driverName, driverPhone, vehicleCategory, plateNumber } = req.body;
    if (!driverId) {
      return res.status(400).json({ success: false, error: 'Driver identity is required' });
    }

    const result = pilotDb.claimScheduledTrip(req.params.id, {
      id: driverId,
      name: driverName || 'Zylift Driver',
      phone: driverPhone || '+234 800 000 0000',
      vehicleCategory,
      plateNumber,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trips/:id/cancel-scheduled', (req, res) => {
  try {
    const { reason } = req.body;
    const result = pilotDb.cancelScheduledTrip(req.params.id, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trips/:id/start-scheduled', (req, res) => {
  try {
    const trip = pilotDb.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    if (!trip.safetyPin) {
      trip.safetyPin = crypto.randomInt(1000, 10000).toString();
    }
    trip.status = 'accepted';
    trip.acceptedAt = new Date().toISOString();
    trip.timeline.push({
      step: 'accepted',
      timestamp: trip.acceptedAt,
      note: 'Driver started scheduled trip and is heading to pick-up point',
    });
    pilotDb.persist();
    return res.status(200).json({ success: true, trip: sanitizeTripForDriver(trip) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- Authentication & Presence Tracking (Student, Staff, Driver) ---
app.post('/api/auth/signin', (req, res) => {
  try {
    const { role, phone, name, matricOrStaffId, department, driverId, pin, emergencyContactPhone, avatarUrl, language } = req.body;

    if (role === 'driver') {
      const driverResult = pilotDb.signInDriver(driverId || phone, pin);
      if (!driverResult.success || !driverResult.driver) {
        return res.status(401).json({ success: false, error: driverResult.error || 'Driver profile not found' });
      }
      const session = pilotDb.createSession(driverResult.driver.id, 'driver', 'driver', driverResult.driver.name);
      return res.status(200).json({ success: true, driver: sanitizeDriver(driverResult.driver), token: session.token, role: 'driver' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const userResult = pilotDb.signInUser({
      phone,
      name,
      role: role === 'staff' ? 'staff' : (role === 'visitor' ? 'visitor' : 'student'),
      matricOrStaffId: matricOrStaffId || (role === 'staff' ? 'SS/FUT/MINNA' : undefined),
      department: department || 'FUTMINNA Gidan Kwanu Campus',
      securityPin: pin,
      emergencyContactPhone,
      avatarUrl,
      language: language === 'ha' ? 'ha' : 'en',
    });

    if (!userResult.success || !userResult.user) {
      return res.status(401).json({ success: false, error: userResult.error });
    }

    const session = pilotDb.createSession(userResult.user.id, 'user', userResult.user.role, userResult.user.name);

    if (req.body.referralCode && userResult.user) {
      try {
        pilotDb.trackReferral(req.body.referralCode, {
          id: userResult.user.id,
          name: userResult.user.name,
          phone: userResult.user.phone,
          role: 'rider',
        });
      } catch (refErr) {
        console.warn('[Referral] Failed to track referral on rider sign-in:', refErr);
      }
    }

    return res.status(200).json({ success: true, user: sanitizeUser(userResult.user), token: session.token, role: userResult.user?.role });
  } catch (err: any) {
    console.error('[Auth API] Sign-in error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to sign in' });
  }
});

// Check whether phone number is already registered for Driver or Passenger
app.post('/api/auth/lookup', (req, res) => {
  try {
    const { phone, role } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanInput = String(phone).replace(/\D/g, '');
    const strippedInput = cleanInput.startsWith('234')
      ? cleanInput.slice(3)
      : cleanInput.startsWith('0')
      ? cleanInput.slice(1)
      : cleanInput;

    if (role === 'driver') {
      const driver = pilotDb.getAllDrivers().find((d) => {
        const dClean = d.phone.replace(/\D/g, '');
        const dStrip = dClean.startsWith('234')
          ? dClean.slice(3)
          : dClean.startsWith('0')
          ? dClean.slice(1)
          : dClean;
        return (strippedInput && dStrip === strippedInput) || (cleanInput && dClean === cleanInput);
      });

      if (driver) {
        return res.status(200).json({
          success: true,
          exists: true,
          role: 'driver',
          driver: sanitizeDriver(driver),
        });
      }

      return res.status(200).json({ success: true, exists: false, role: 'driver' });
    }

    // Role is passenger (or check user database)
    const user = pilotDb.getUser(phone);
    if (user) {
      return res.status(200).json({
        success: true,
        exists: true,
        role: 'passenger',
        user: sanitizeUser(user),
      });
    }

    return res.status(200).json({ success: true, exists: false, role: 'passenger' });
  } catch (err: any) {
    console.error('[Auth API] Lookup error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lookup failed' });
  }
});

app.post('/api/auth/signout', (req, res) => {
  try {
    const { role, userId, phone, driverId } = req.body;
    let ok = false;
    if (role === 'driver' || driverId) {
      ok = pilotDb.signOutDriver(driverId || phone || userId);
    } else {
      ok = pilotDb.signOutUser(userId || phone);
    }
    return res.status(200).json({ success: ok });
  } catch (err: any) {
    console.error('[Auth API] Sign-out error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to sign out' });
  }
});

// Verify current authenticated session
app.get('/api/auth/me', (req, res) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing session token' });
  }
  const session = pilotDb.validateSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Session expired or invalidated' });
  }
  if (session.userType === 'driver') {
    const driver = pilotDb.getDriver(session.userId);
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver account no longer exists' });
    }
    return res.status(200).json({ success: true, role: 'driver', driver: sanitizeDriver(driver) });
  }
  const user = pilotDb.getUser(session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User account no longer exists' });
  }
  return res.status(200).json({ success: true, role: user.role || 'student', user: sanitizeUser(user) });
});

// Check if user account exists (used by client to verify session validity and detect deleted accounts)
app.get('/api/users/:id', (req, res) => {
  const user = pilotDb.getUser(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User account not found or has been deleted' });
  }
  return res.status(200).json({ success: true, user: sanitizeUser(user) });
});

// Update passenger profile & profile photo (persists to DB and syncs across admin/driver views)
app.post('/api/users/:id/update', requireUserAuth, (req, res) => {
  const targetUser = pilotDb.getUser(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'User account not found' });
  }
  const session = (req as any).userSession;
  if (session?.userType === 'user' && session.userId !== targetUser.id) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cannot update another passenger profile' });
  }

  const { name, department, matricOrStaffId, emergencyContactPhone, avatarUrl, language } = req.body;
  const updated = pilotDb.updateUser(targetUser.id, {
    ...(name !== undefined ? { name } : {}),
    ...(department !== undefined ? { department } : {}),
    ...(matricOrStaffId !== undefined ? { matricOrStaffId } : {}),
    ...(emergencyContactPhone !== undefined ? { emergencyContactPhone } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || '' } : {}),
    ...(language !== undefined ? { language: language === 'ha' ? 'ha' : 'en' } : {}),
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'User account not found' });
  }

  return res.status(200).json({ success: true, user: sanitizeUser(updated) });
});

// Check if driver account exists (used by client to verify driver session and detect deleted accounts)
app.get('/api/drivers/:id', (req, res) => {
  const driver = pilotDb.getDriver(req.params.id);
  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver account not found or has been deleted' });
  }

  const token = extractBearerToken(req);
  let session = token ? pilotDb.validateSession(token) : null;
  // If session expired or missing, auto-heal a fresh 90-day session for this verified driver
  if (!session) {
    session = pilotDb.createSession(driver.id, 'driver', 'driver', driver.name);
  }

  return res.status(200).json({
    success: true,
    driver: sanitizeDriver(driver),
    token: session ? session.token : undefined
  });
});

// In-memory dual rate limiting maps for OTP generation:
// Max 4 attempts per 10 minutes per phone
// Max 10 attempts per 15 minutes per IP
const otpPhoneRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const otpIpRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkOtpRateLimit(phone: string, ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const clean = phone.replace(/\D/g, '');

  // 1. Per-IP Rate Limit (Max 10 OTP requests per 15 minutes)
  if (ip) {
    const ipRec = otpIpRateLimitMap.get(ip);
    if (ipRec && now <= ipRec.resetAt) {
      if (ipRec.count >= 10) {
        return { allowed: false, error: 'Too many OTP requests from your network. Please wait 15 minutes.' };
      }
      ipRec.count += 1;
    } else {
      otpIpRateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }
  }

  // 2. Per-Phone Rate Limit (Max 4 OTP requests per 10 minutes)
  const phoneRec = otpPhoneRateLimitMap.get(clean);
  if (phoneRec && now <= phoneRec.resetAt) {
    if (phoneRec.count >= 4) {
      return { allowed: false, error: 'Too many OTP requests for this phone number. Please wait 10 minutes.' };
    }
    phoneRec.count += 1;
  } else {
    otpPhoneRateLimitMap.set(clean, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }

  return { allowed: true };
}


function requireRiderAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Rider session token required' });
  }

  const session = pilotDb.validateSession(token);
  if (!session || (session.userType !== 'user' && session.userType !== 'staff')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired rider session' });
  }

  const user = pilotDb.getUser(session.userId) || {
    id: session.userId,
    phone: session.userId,
    name: session.name || 'Campus Passenger',
    role: session.role || 'student',
  };

  (req as any).riderUser = user;
  (req as any).riderSession = session;
  next();
}

function requireAnyAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Session token required' });
  }

  const session = pilotDb.validateSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }

  (req as any).session = session;
  next();
}

function getActingStaff(req: express.Request): StaffUserRecord {
  if ((req as any).authenticatedStaff) {
    return (req as any).authenticatedStaff;
  }
  if ((req as any).staffUser) {
    return (req as any).staffUser;
  }
  const token = extractBearerToken(req);
  if (token) {
    const session = pilotDb.validateSession(token);
    if (session && session.userType === 'staff') {
      const s = pilotDb.getStaff(session.userId);
      if (s) return s;
    }
  }
  const staffId = req.headers['x-staff-id'] as string;
  if (staffId) {
    const s = pilotDb.getStaff(staffId);
    if (s) return s;
  }
  return pilotDb.getAllStaff()[0];
}

// Student / Rider OTP Generation (5-minute TTL & Dual Rate-Limited with SMS Dispatch)
app.post('/api/auth/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number required' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const rateLimit = checkOtpRateLimit(phone, clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: rateLimit.error });
  }

  const result = pilotDb.createOtp(phone);
  console.log(`[SMS Gateway / OTP Generated] Verification code generated for ${phone}: ${result.code}`);

  // Dispatch via real SMS Gateway (Termii / Twilio / Simulator)
  const smsResult = await smsService.sendOtp(phone, result.code);

  const isSenderPending = Boolean(
    smsResult.error &&
    (smsResult.error.toLowerCase().includes('sender') ||
     smsResult.error.toLowerCase().includes('approval') ||
     smsResult.error.toLowerCase().includes('route'))
  );

  // In local development, pilot testing, or when SMS sender is pending telco approval,
  // return sandboxCode so riders and drivers can 1-tap autofill directly on mobile or web.
  const isDevSandbox =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_PILOT_OTP_FALLBACK === 'true' ||
    !smsResult.success ||
    isSenderPending;
  return res.status(200).json({
    success: true,
    expiresAt: result.expiresAt,
    smsDelivered: smsResult.success,
    smsProvider: smsResult.provider,
    senderPending: isSenderPending,
    isSandbox: isDevSandbox,
    sandboxCode: isDevSandbox ? result.code : undefined,
  });
});

app.post('/api/auth/otp/verify', (req, res) => {
  const { phone, code, role } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ success: false, error: 'Phone number and verification code required' });
  }
  const result = pilotDb.verifyOtp(phone, code);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Normalize phone digits
  let cleanDigits = String(phone).replace(/\D/g, '');
  if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
  if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
  const subscriber10 = cleanDigits.slice(-10);
  const formattedPhone = `+234 ${subscriber10}`;

  if (role === 'driver') {
    const matchedDriver = pilotDb.getAllDrivers().find((d) => {
      let dDigits = d.phone.replace(/\D/g, '');
      if (dDigits.startsWith('234')) dDigits = dDigits.slice(3);
      if (dDigits.startsWith('0')) dDigits = dDigits.slice(1);
      return dDigits.slice(-10) === subscriber10;
    });

    if (matchedDriver) {
      const signInResult = pilotDb.signInDriver(matchedDriver.id);
      if (!signInResult.success || !signInResult.driver) {
        return res.status(403).json({
          success: false,
          error: signInResult.error || 'Driver account unavailable',
        });
      }
      const session = pilotDb.createSession(signInResult.driver.id, 'driver', 'driver', signInResult.driver.name);
      return res.status(200).json({
        success: true,
        exists: true,
        requiresPin: false,
        role: 'driver',
        driverId: signInResult.driver.id,
        name: signInResult.driver.name,
        token: session.token,
        driver: sanitizeDriver(signInResult.driver),
      });
    }

    // Driver not registered yet
    return res.status(200).json({
      success: true,
      exists: false,
      requiresPin: false,
      role: 'driver',
      token: null,
      driver: null,
    });
  }

  // Passenger / Rider role
  const matchedUser = pilotDb.getUser(phone) || pilotDb.getUser(formattedPhone) || pilotDb.getUser(subscriber10);
  const isExistingUser = Boolean(matchedUser && matchedUser.phone && !matchedUser.phone.startsWith('usr_'));

  if (isExistingUser && matchedUser) {
    // Existing rider account: if PIN is set, require PIN verification before issuing authenticated session token
    if (matchedUser.securityPin) {
      return res.status(200).json({
        success: true,
        exists: true,
        requiresPin: true,
        role: matchedUser.role || 'student',
        userId: matchedUser.id,
        name: matchedUser.name,
        token: null,
        user: sanitizeUser(matchedUser),
      });
    }
    const session = pilotDb.createSession(matchedUser.id, 'user', matchedUser.role || 'student', matchedUser.name);
    return res.status(200).json({
      success: true,
      exists: true,
      requiresPin: false,
      token: session.token,
      user: sanitizeUser(matchedUser),
    });
  }

  // Brand new passenger registering for the first time: issue onboarding session token
  const tempUserId = `usr_temp_${Date.now().toString().slice(-6)}`;
  const session = pilotDb.createSession(tempUserId, 'user', 'student', 'Campus Passenger');

  return res.status(200).json({
    success: true,
    exists: false,
    requiresPin: false,
    token: session.token,
    user: null,
  });
});


// Rider submits rating & feedback (propagates to Admin Dashboard & driver profile)
app.post('/api/trips/:id/rate', (req, res) => {
  const { stars, tags, comment } = req.body;
  const result = pilotDb.submitTripRating(req.params.id, Number(stars) || 5, Array.isArray(tags) ? tags : [], comment);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});


// Check active trip for rider or driver
app.get('/api/trips/active', (req, res) => {
  const { riderPhone, driverId } = req.query;

  if (driverId) {
    const trip = pilotDb.getActiveTripForDriver(String(driverId));
    return res.status(200).json({ activeTrip: sanitizeTripForDriver(trip) });
  }

  if (riderPhone) {
    const trip = pilotDb.getActiveTripForRider(String(riderPhone));
    return res.status(200).json({ activeTrip: trip });
  }

  return res.status(400).json({ error: 'riderPhone or driverId query parameter required' });
});

// Get specific trip by ID
app.get('/api/trips/:id', (req, res) => {
  const trip = pilotDb.getTrip(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const token = extractBearerToken(req);
  if (token) {
    const session = pilotDb.validateSession(token);
    if (session && session.userType === 'driver') {
      return res.status(200).json({ trip: sanitizeTripForDriver(trip) });
    }
  }
  return res.status(200).json({ trip });
});

// Driver checks for incoming ride offer
app.get('/api/drivers/:id/incoming-offer', (req, res) => {
  const driverId = req.params.id;
  const pendingTrip = pilotDb.getPendingOfferForDriver(driverId);

  if (!pendingTrip) {
    return res.status(200).json({ offer: null });
  }

  const now = Date.now();
  const expiresAt = pendingTrip.offerExpiresAt || now;
  const secondsRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  if (secondsRemaining <= 0) {
    // 15 seconds expired without response: auto-cascade to next nearest candidate
    pilotDb.cascadeTripOffer(pendingTrip.id, driverId);
    return res.status(200).json({ offer: null });
  }

  return res.status(200).json({
    offer: sanitizeTripForDriver(pendingTrip),
    secondsRemaining,
  });
});

// Driver accepts ride offer
app.post('/api/trips/:id/accept', (req, res) => {
  const token = extractBearerToken(req);
  let driverId = req.body.driverId;
  if (token) {
    const session = pilotDb.validateSession(token);
    if (!session || (session.userType !== 'driver' && session.userType !== 'staff')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
    }
    if (session.userType === 'driver') {
      driverId = session.userId;
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
  }
  if (!driverId) return res.status(400).json({ error: 'driverId or driver session required' });

  const result = pilotDb.acceptTripOffer(req.params.id, driverId);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  return res.status(200).json({ success: true, trip: sanitizeTripForDriver(result.trip) });
});

// Driver declines ride offer
app.post('/api/trips/:id/decline', (req, res) => {
  const token = extractBearerToken(req);
  let driverId = req.body.driverId;
  if (token) {
    const session = pilotDb.validateSession(token);
    if (!session || (session.userType !== 'driver' && session.userType !== 'staff')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
    }
    if (session.userType === 'driver') {
      driverId = session.userId;
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
  }
  if (!driverId) return res.status(400).json({ error: 'driverId or driver session required' });

  const result = pilotDb.cascadeTripOffer(req.params.id, driverId);
  return res.status(200).json({ success: result.success, nextDriverId: result.nextDriverId, finished: result.finished });
});

// Driver updates status to 'arriving'
app.post('/api/trips/:id/arriving', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    const session = pilotDb.validateSession(token);
    if (!session || (session.userType !== 'driver' && session.userType !== 'staff')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Driver session required' });
  }

  const existingTrip = pilotDb.getTrip(req.params.id);
  if (existingTrip && existingTrip.status === 'arriving') {
    return res.status(200).json({ success: true, trip: sanitizeTripForDriver(existingTrip) });
  }

  const result = pilotDb.updateTripStatus(req.params.id, 'arriving');
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, trip: sanitizeTripForDriver(result.trip) });
});

// Driver verifies student's 4-digit Safety PIN and starts trip
app.post('/api/trips/:id/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: '4-digit PIN required' });

  const result = pilotDb.verifyTripPin(req.params.id, String(pin));
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  return res.status(200).json({ success: true, trip: result.trip });
});

// Driver arrives at dropoff destination (transitions rider screen to arrived_pay options)
app.post('/api/trips/:id/arrived-destination', (req, res) => {
  const result = pilotDb.updateTripStatus(req.params.id, 'arrived_destination');
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, trip: sanitizeTripForDriver(result.trip) });
});

// Driver marks trip completed upon cash collection
app.post('/api/trips/:id/complete', (req, res) => {
  const result = pilotDb.updateTripStatus(req.params.id, 'completed');
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, trip: result.trip });
});

// Cancel trip
app.post('/api/trips/:id/cancel', (req, res) => {
  const result = pilotDb.updateTripStatus(req.params.id, 'cancelled');
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, trip: result.trip });
});

// Drivers list
app.get('/api/drivers', (_req, res) => {
  res.status(200).json({ drivers: pilotDb.getAllDrivers() });
});

// Driver toggle online status
app.post('/api/drivers/:id/toggle-online', (req, res) => {
  const driver = pilotDb.getDriver(req.params.id);
  if (!driver) return res.status(404).json({ success: false, error: 'Driver not found' });

  const token = extractBearerToken(req);
  let session = token ? pilotDb.validateSession(token) : null;
  if (session) {
    if (session.userType === 'driver') {
      const sessionDriver = pilotDb.getDriver(session.userId);
      if (sessionDriver && sessionDriver.id !== driver.id) {
        return res.status(403).json({ success: false, error: 'Cannot toggle status for another driver', needsVerification: false });
      }
    }
  } else {
    // If token expired, invalidated, or absent, auto-heal session for this verified driver
    session = pilotDb.createSession(driver.id, 'driver', 'driver', driver.name);
  }

  const { isOnline } = req.body;

  if (isOnline && !driver.isApproved) {
    return res.status(403).json({
      success: false,
      error: 'Unverified drivers cannot go online. You will remain offline until an admin or campus marshal verifies your credentials.',
      needsVerification: true
    });
  }

  const updated = pilotDb.setDriverOnline(driver.id, Boolean(isOnline));
  return res.status(200).json({
    success: true,
    driver: sanitizeDriver(updated || driver),
    token: session ? session.token : undefined
  });
});

// Driver update profile and credentials
app.post('/api/drivers/:id/update', (req, res) => {
  const driverId = req.params.id;
  const driver = pilotDb.getDriver(driverId);
  if (!driver) return res.status(404).json({ success: false, error: 'Driver not found' });

  const allowedUpdates = [
    'name', 'phone', 'homeArea', 'secondPhone', 'parkLeaderName', 'parkLeaderPhone',
    'vehicleCategory', 'vehiclePlate', 'vehicleModel', 'vehicleColor',
    'avatarUrl', 'facePhotoUrl', 'vehiclePhotoUrl', 'idCardPhotoUrl', 'licenseOrParkCardUrl', 'vehiclePapersUrl',
    'bankName', 'accountNumber', 'accountName', 'stationName'
  ];

  const updates: any = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (updates.facePhotoUrl !== undefined) {
    updates.avatarUrl = updates.facePhotoUrl;
  }

  const updated = pilotDb.updateDriver(driverId, updates);

  // Sync to driver application if one exists for this driver phone
  const cleanPhone = (updated?.phone || driver.phone).replace(/\s+/g, '');
  const app = pilotDb.data.applications.find(a => a.phone.replace(/\s+/g, '') === cleanPhone);
  if (app) {
    if (updates.name) app.applicantName = updates.name;
    if (updates.phone) app.phone = updates.phone;
    if (updates.homeArea) app.homeArea = updates.homeArea;
    if (updates.secondPhone) app.secondPhone = updates.secondPhone;
    if (updates.parkLeaderName) app.parkLeaderName = updates.parkLeaderName;
    if (updates.parkLeaderPhone) app.parkLeaderPhone = updates.parkLeaderPhone;
    if (updates.vehicleCategory) app.vehicleCategory = updates.vehicleCategory;
    if (updates.vehiclePlate) app.vehiclePlate = updates.vehiclePlate;
    if (updates.vehicleModel) app.vehicleModel = updates.vehicleModel;
    if (updates.vehicleColor) app.vehicleColor = updates.vehicleColor;
    if (updates.facePhotoUrl) app.facePhotoUrl = updates.facePhotoUrl;
    if (updates.vehiclePhotoUrl) app.vehiclePhotoUrl = updates.vehiclePhotoUrl;
    if (updates.idCardPhotoUrl) app.idCardPhotoUrl = updates.idCardPhotoUrl;
    if (updates.licenseOrParkCardUrl) app.licenseOrParkCardUrl = updates.licenseOrParkCardUrl;
    if (updates.vehiclePapersUrl) app.vehiclePapersUrl = updates.vehiclePapersUrl;
    pilotDb.persist();
  }

  return res.status(200).json({ success: true, driver: updated });
});

// Driver update location
app.post('/api/drivers/:id/location', (req, res) => {
  const driver = pilotDb.getDriver(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const token = extractBearerToken(req);
  if (token) {
    const session = pilotDb.validateSession(token);
    if (session && session.userType === 'driver') {
      const sessionDriver = pilotDb.getDriver(session.userId);
      if (sessionDriver && sessionDriver.id !== driver.id) {
        return res.status(403).json({ success: false, error: 'Cannot update location for another driver' });
      }
    }
  }

  const { lat, lng, heading } = req.body;
  const updated = pilotDb.updateDriverLocation(driver.id, Number(lat), Number(lng), Number(heading || 0));
  if (!updated) return res.status(404).json({ error: 'Driver not found' });
  return res.status(200).json({ success: true });
});

// Driver Payouts & Settlement Profile (Safe replacement for custodial wallet)
app.get('/api/drivers/:id/wallet', (req, res) => {
  const driver = pilotDb.getDriver(req.params.id);
  return res.status(200).json({
    success: true,
    wallet: {
      driverId: req.params.id,
      balanceNaira: 0,
      bankName: driver?.bankName || null,
      accountNumberMasked: driver?.accountNumber ? `******${driver.accountNumber.slice(-4)}` : null,
      paystackSubaccountCode: driver?.paystackSubaccountCode || null,
      message: 'Automated Split Settlements active: Card/transfer fares are deposited directly to your registered bank account by Paystack.',
      transactions: [],
    },
  });
});

// Driver Real Earnings & Trips Breakdown
app.get('/api/drivers/:id/earnings', (req, res) => {
  const driverId = req.params.id;
  const allTrips = pilotDb.getAllTrips();
  const completedTrips = allTrips
    .filter(t => t.driverId === driverId && t.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

  const todayTrips = completedTrips.filter(t => new Date(t.completedAt || t.createdAt).getTime() >= startOfToday);
  const weekTrips = completedTrips.filter(t => new Date(t.completedAt || t.createdAt).getTime() >= startOfWeek);

  const todayEarnings = todayTrips.reduce((sum, t) => sum + (t.fareNaira || 0), 0);
  const weekEarnings = weekTrips.reduce((sum, t) => sum + (t.fareNaira || 0), 0);
  const totalEarnings = completedTrips.reduce((sum, t) => sum + (t.fareNaira || 0), 0);

  return res.status(200).json({
    success: true,
    todayEarnings,
    todayTripsCount: todayTrips.length,
    weekEarnings,
    weekTripsCount: weekTrips.length,
    totalEarnings,
    totalTripsCount: completedTrips.length,
    completedTrips: completedTrips.map(t => {
      const ts = new Date(t.completedAt || t.createdAt).getTime();
      return {
        id: t.id,
        pickupName: t.pickupName,
        dropoffName: t.dropoffName,
        fareNaira: t.fareNaira,
        paymentMethod: t.paymentMethod,
        paymentStatus: t.paymentStatus,
        completedAt: t.completedAt || t.createdAt,
        isToday: ts >= startOfToday,
        isThisWeek: ts >= startOfWeek,
        timeFormatted: new Date(t.completedAt || t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }),
  });
});

// --- Campus Referral Program Endpoints ---
app.post('/api/referrals/track', (req, res) => {
  try {
    const { referralCode, refereeId, refereeName, refereePhone, refereeRole } = req.body;
    if (!referralCode || !refereePhone) {
      return res.status(400).json({ success: false, error: 'referralCode and refereePhone are required' });
    }
    const result = pilotDb.trackReferral(referralCode, {
      id: refereeId,
      name: refereeName || 'Campus User',
      phone: refereePhone,
      role: refereeRole || 'rider',
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to track referral' });
  }
});

app.get('/api/referrals/stats', (req, res) => {
  try {
    const code = String(req.query.code || req.query.phone || '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'code or phone query parameter is required' });
    }
    const stats = pilotDb.getReferralsForUser(code);
    return res.status(200).json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch referral stats' });
  }
});

app.get('/api/admin/referrals', requireStaffAuth(), (_req, res) => {
  try {
    const referrals = pilotDb.getAllReferrals();
    const completed = referrals.filter(r => r.status === 'completed').length;
    const pending = referrals.filter(r => r.status === 'pending').length;

    const referrerMap = new Map<string, { code: string; name: string; role: string; total: number; completed: number; pending: number }>();
    for (const r of referrals) {
      const key = r.referrerCode;
      const existing = referrerMap.get(key) || {
        code: r.referrerCode,
        name: r.referrerName || r.referrerCode,
        role: r.referrerType,
        total: 0,
        completed: 0,
        pending: 0,
      };
      existing.total += 1;
      if (r.status === 'completed') existing.completed += 1;
      else existing.pending += 1;
      referrerMap.set(key, existing);
    }
    const leaderboard = Array.from(referrerMap.values()).sort((a, b) => b.completed - a.completed || b.total - a.total);

    return res.status(200).json({
      success: true,
      totalReferrals: referrals.length,
      completedReferrals: completed,
      pendingReferrals: pending,
      leaderboard,
      referrals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch admin referrals' });
  }
});

// Delete specific referral record (Superadmin / Pilot Lead & Operations)
app.delete('/api/admin/referrals/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  try {
    const staff = getActingStaff(req);
    const result = pilotDb.deleteReferral(req.params.id, staff);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete referral' });
  }
});

// Clear all referrals (Superadmin / Pilot Lead only)
app.post('/api/admin/referrals/clear', requireStaffAuth(['pilot_lead']), (req, res) => {
  try {
    const staff = getActingStaff(req);
    const result = pilotDb.clearAllReferrals(staff);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to clear referrals' });
  }
});

app.post('/api/drivers/:id/wallet/withdraw', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'In-app driver wallet has been decommissioned. Earnings from Paystack card/transfer trips are automatically settled directly to your registered Nigerian bank account via Paystack Subaccounts. Physical cash fares remain directly with you.',
  });
});

// Universal Geocoding & Location Search (Wushishi, Bida, Zungeru, any street/village)
app.get('/api/geocode', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.status(200).json({ results: FUTMINNA_KEY_LOCATIONS.slice(0, 15) });
  }

  const qLower = query.toLowerCase();
  // 1. Search local curated locations
  const localMatches = FUTMINNA_KEY_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(qLower) ||
      loc.address.toLowerCase().includes(qLower) ||
      (loc.area && loc.area.toLowerCase().includes(qLower)) ||
      (loc.lga && loc.lga.toLowerCase().includes(qLower))
  );

  // If sufficient local matches exist, return them immediately
  if (localMatches.length >= 4) {
    return res.status(200).json({ results: localMatches });
  }

  // 2. Query OpenStreetMap Nominatim for any arbitrary address / regional town
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + ', Niger State, Nigeria'
    )}&format=json&addressdetails=1&limit=6`;
    const response = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'ZyliftTransit-Futminna/2.0 (contact@futminna.edu.ng)',
      },
    });
    const data: any = await response.json();
    const osmResults = (Array.isArray(data) ? data : []).map((item: any, idx: number) => ({
      id: `osm_${item.place_id || idx}`,
      name: item.name || item.display_name.split(',')[0],
      address: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.village || 'Minna',
      area: item.address?.suburb || item.address?.county || item.address?.state_district || 'Niger State',
      lga: item.address?.county || 'Niger State',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      isPopular: false,
      category: 'Transit Hub',
      description: item.display_name,
    }));

    const combined = [...localMatches, ...osmResults];
    return res.status(200).json({ results: combined.slice(0, 10) });
  } catch (e) {
    return res.status(200).json({ results: localMatches });
  }
});

// Universal Turn-by-Turn Road Routing API (OSRM driving route along real roads)
const routeCache = new Map<string, { coordinates: [number, number][]; distance: number; duration: number }>();

app.get('/api/route', async (req, res) => {
  const startLat = parseFloat(String(req.query.startLat));
  const startLng = parseFloat(String(req.query.startLng));
  const endLat = parseFloat(String(req.query.endLat));
  const endLng = parseFloat(String(req.query.endLng));

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    return res.status(400).json({ error: 'Valid startLat, startLng, endLat, endLng are required' });
  }

  // Quantize cache key to ~10 meters (4 decimal places)
  const cacheKey = `${startLat.toFixed(4)},${startLng.toFixed(4)}->${endLat.toFixed(4)},${endLng.toFixed(4)}`;
  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey)!;
    return res.status(200).json({ status: 'ok', cached: true, ...cached });
  }

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ZyliftTransit-Futminna/2.0 (contact@futminna.edu.ng)'
      }
    });
    clearTimeout(timer);

    if (response.ok) {
      const data: any = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const coordinates: [number, number][] = route.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
        const payload = {
          coordinates,
          distance: Math.round(route.distance), // meters
          duration: Math.round(route.duration), // seconds
        };
        routeCache.set(cacheKey, payload);
        return res.status(200).json({ status: 'ok', ...payload });
      }
    }
  } catch (err: any) {
    console.warn('[Route API] Upstream OSRM query timed out or failed:', err?.message || err);
  }

  // Fallback: If OSRM is temporarily offline, generate road corridor interpolation
  const dist = Math.round(Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2)) * 111000);
  const fallbackPoints: [number, number][] = [
    [startLat, startLng],
    [startLat + (endLat - startLat) * 0.35, startLng + (endLng - startLng) * 0.15],
    [startLat + (endLat - startLat) * 0.65, startLng + (endLng - startLng) * 0.85],
    [endLat, endLng],
  ];

  return res.status(200).json({
    status: 'fallback',
    coordinates: fallbackPoints,
    distance: dist,
    duration: Math.round(dist / 8.3),
  });
});

// ============================================================================
// CASH & PER-TRIP PAYMENT SETTLEMENT
// Physical cash confirmed directly by driver at drop-off.
// ============================================================================

// 1. Confirm Physical Cash Received by Driver at Drop-off
app.post(['/api/trips/:id/payment/cash', '/api/trips/:id/payment/confirm-transfer'], (req, res) => {
  const token = extractBearerToken(req);
  let driverId = req.body.driverId;

  if (token) {
    const session = pilotDb.validateSession(token);
    if (session && (session.userType === 'driver' || session.userType === 'staff')) {
      driverId = session.userId;
    }
  }

  const trip = pilotDb.getTrip(req.params.id);
  if (!trip) {
    return res.status(404).json({ success: false, error: 'Trip not found' });
  }

  // Fallback to assigned driver if caller didn't pass explicit driverId in development
  const resolvedDriverId = driverId || trip.driverId;
  if (!resolvedDriverId) {
    return res.status(400).json({ success: false, error: 'Driver identification required to confirm cash receipt' });
  }

  const result = pilotDb.confirmTripCashPayment(req.params.id, resolvedDriverId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json({
    success: true,
    message: `Physical cash fare of ₦${result.trip?.fareNaira} confirmed by driver`,
    trip: result.trip,
  });
});

// Trip Digital Transfer Notification (Legacy alias)
app.post('/api/trips/:id/payment/transfer-sent', (req, res) => {
  const { reference } = req.body;
  const result = pilotDb.recordTripTransferSent(req.params.id, reference);
  if (!result.success) return res.status(400).json(result);
  return res.status(200).json(result);
});

// ============================================================================
// DECOMMISSIONED CUSTODIAL WALLET ENDPOINTS (SAFE DEPRECATION NOTICES)
// Zylift does NOT operate a custodial mobile money wallet (CBN Regulatory Compliance)
// ============================================================================

app.get('/api/users/:id/wallet', (req, res) => {
  return res.status(200).json({
    success: true,
    wallet: {
      userId: req.params.id,
      balanceNaira: 0,
      status: 'decommissioned',
      message: 'In-app custodial wallet has been removed. Fares are settled per-ride via physical cash or Paystack automated split payment.',
      transactions: [],
    },
  });
});

app.post('/api/users/:id/wallet/topup', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Custodial wallet top-up is permanently disabled. Riders pay exact fares per ride at completion.',
  });
});

app.post('/api/trips/:id/payment/wallet', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'In-app wallet payment is disabled. Please pay the driver using Cash or Paystack card/bank-transfer.',
  });
});

app.post('/api/wallet/transfer-to-driver', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Direct in-app wallet transfer is disabled. Please pay driver directly in physical Cash or via Paystack.',
  });
});

// ==========================================
// ADMIN, DISPATCHER & COMPANION SPEC ENDPOINTS
// ==========================================

// Staff Authentication & 2FA (Public login routes)
app.post('/api/admin/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }
  const result = pilotDb.staffLogin(email, password);
  if (!result.success) {
    return res.status(401).json(result);
  }
  if (result.requires2fa && result.staffId) {
    const challengeId = challengeStore.createChallenge(result.staffId);
    return res.status(200).json({ ...result, challengeId });
  }
  return res.status(200).json(result);
});

app.post('/api/admin/auth/verify-2fa', (req, res) => {
  const { staffId, code, challengeId } = req.body;
  if (!staffId || !code) {
    return res.status(400).json({ success: false, error: 'staffId and 6-digit code required' });
  }
  if (challengeId) {
    const chResult = challengeStore.verifyChallenge(challengeId, staffId, code);
    if (!chResult.success) {
      return res.status(401).json({ success: false, error: chResult.error });
    }
  }
  const result = pilotDb.staffVerify2fa(staffId, code);
  if (!result.success) {
    return res.status(401).json(result);
  }
  return res.status(200).json(result);
});

app.get('/api/admin/staff', requireStaffAuth(), (_req, res) => {
  const staff = pilotDb.getAllStaff().map(s => ({ ...s, passwordHash: '***' }));
  return res.status(200).json({ success: true, staff });
});

// Create new staff account (Superadmin / Pilot Lead only)
app.post('/api/admin/staff', requireStaffAuth(['pilot_lead']), (req, res) => {
  const { name, email, phone, role, password, pin2fa } = req.body || {};
  const requesterStaffId = (req as any).authenticatedStaff?.id;
  const result = pilotDb.createStaff({ name, email, phone, role, password, pin2fa }, requesterStaffId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  const safeStaff = { ...result.staff, passwordHash: '***' };
  return res.status(201).json({ success: true, staff: safeStaff });
});

// Delete staff account (Superadmin / Pilot Lead only)
app.delete('/api/admin/staff/:id', requireStaffAuth(['pilot_lead']), (req, res) => {
  const requesterStaffId = (req as any).authenticatedStaff?.id;
  const result = pilotDb.deleteStaff(req.params.id, requesterStaffId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

// Admin Dashboard & Live Map
app.get('/api/admin/dashboard', requireStaffAuth(), (_req, res) => {
  const metrics = pilotDb.getDashboardMetrics();
  const allTrips = pilotDb.getAllTrips();
  const recentTrips = allTrips.slice(0, 10);
  const activeTrips = allTrips.filter(t => !['completed', 'cancelled', 'no_drivers_available'].includes(t.status));
  const openIncidents = pilotDb.getAllIncidents().filter(i => i.status === 'open');

  return res.status(200).json({
    success: true,
    metrics,
    activeTrips,
    recentTrips,
    openIncidents,
  });
});

app.get('/api/admin/map/live', requireStaffAuth(), (_req, res) => {
  const onlineDrivers = pilotDb.getAllDrivers().filter(d => d.isOnline);
  const activeTrips = pilotDb.getAllTrips().filter(t => !['completed', 'cancelled', 'no_drivers_available'].includes(t.status));
  const activeIncidents = pilotDb.getAllIncidents().filter(i => i.status === 'open');

  return res.status(200).json({
    success: true,
    drivers: onlineDrivers,
    trips: activeTrips,
    incidents: activeIncidents,
  });
});

// Rides Management & Lifecycle Timeline
app.get('/api/admin/rides', requireStaffAuth(), (req, res) => {
  const { status, search } = req.query;
  let trips = pilotDb.getAllTrips();

  if (status && status !== 'all') {
    trips = trips.filter(t => t.status === status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    trips = trips.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.riderName.toLowerCase().includes(q) ||
      t.riderPhone.toLowerCase().includes(q) ||
      (t.driverName && t.driverName.toLowerCase().includes(q)) ||
      (t.vehiclePlate && t.vehiclePlate.toLowerCase().includes(q))
    );
  }

  return res.status(200).json({ success: true, trips });
});

app.get('/api/admin/rides/:id', requireStaffAuth(), (req, res) => {
  const trip = pilotDb.getTrip(req.params.id);
  if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
  return res.status(200).json({ success: true, trip });
});

app.post('/api/admin/rides/:id/reassign', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { newDriverId, reason } = req.body;
  if (!newDriverId || !reason) {
    return res.status(400).json({ success: false, error: 'newDriverId and mandatory reason are required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.adminReassignTrip(req.params.id, newDriverId, reason, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/rides/:id/cancel', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Mandatory cancellation reason required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.adminCancelTrip(req.params.id, reason, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.delete('/api/admin/rides/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteTrip(req.params.id, staff);
  if (!result.success) {
    return res.status(404).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/rides/clear-test-data', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const { onlyFinished = true } = req.body;
  const result = pilotDb.clearAllTrips(staff, onlyFinished);
  return res.status(200).json(result);
});

// Drivers Management & In-Person Checklist Verification
app.get('/api/admin/drivers', requireStaffAuth(), (_req, res) => {
  const drivers = pilotDb.getAllDrivers();
  return res.status(200).json({ success: true, drivers });
});

app.post('/api/admin/drivers/:id/approve', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { checklist } = req.body;
  if (!checklist) {
    return res.status(400).json({ success: false, error: 'Verification checklist is required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.approveDriverApplication(req.params.id, checklist, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/drivers/:id/reject', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Mandatory rejection reason required for SMS notification' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.rejectDriverApplication(req.params.id, reason, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/drivers/:id/suspend', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Suspension reason required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.suspendDriver(req.params.id, reason, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/drivers/:id/warn', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { warningText } = req.body;
  if (!warningText) {
    return res.status(400).json({ success: false, error: 'Warning text required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.warnDriver(req.params.id, warningText, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

// Delete Driver Registration & Associated Applications (Superadmin / Ops)
app.delete('/api/admin/drivers/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteDriver(req.params.id, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

app.delete('/api/admin/applications/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteDriverApplication(req.params.id, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

// Driver Self-Registration Application (V1-V7)
app.post('/api/drivers/apply', (req, res) => {
  try {
    const {
      applicantName,
      phone,
      dob,
      homeArea,
      secondPhone,
      parkLeaderName,
      parkLeaderPhone,
      vehicleCategory,
      vehiclePlate,
      vehicleModel,
      vehicleColor,
      ninNumber,
      hasSmartphone,
      facePhotoUrl,
      vehiclePhotoUrl,
      idCardPhotoUrl,
      licenseOrParkCardUrl,
      vehiclePapersUrl,
      documentsMeta,
      agreedToRules,
    } = req.body;

    const effectivePhone = (phone || '').trim();
    if (!effectivePhone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const effectiveName = (applicantName || '').trim() || 'Campus Driver';
    const effectivePlate = (vehiclePlate || '').trim() || `MNA-${Math.floor(100 + Math.random() * 899)}-KW`;

    const application = pilotDb.createDriverApplication({
      applicantName: effectiveName,
      phone: effectivePhone,
      dob,
      homeArea: homeArea || 'Gidan Kwanu Village',
      secondPhone,
      parkLeaderName,
      parkLeaderPhone,
      vehicleCategory: vehicleCategory || 'keke',
      vehiclePlate: effectivePlate,
      vehicleModel: vehicleModel || (vehicleCategory === 'okada' ? 'Bajaj Boxer 150' : vehicleCategory === 'cab_go' ? 'Toyota Corolla' : 'TVS King 200cc'),
      vehicleColor: vehicleColor || 'Yellow',
      ninNumber,
      hasSmartphone: hasSmartphone !== undefined ? Boolean(hasSmartphone) : true,
      facePhotoUrl: facePhotoUrl || '',
      vehiclePhotoUrl,
      idCardPhotoUrl,
      licenseOrParkCardUrl,
      vehiclePapersUrl,
      documentsMeta,
      agreedToRules: agreedToRules !== undefined ? Boolean(agreedToRules) : true,
    });

    const driver = application.driver;
    let token: string | undefined;
    if (driver) {
      const session = pilotDb.createSession(driver.id, 'driver', 'driver', driver.name);
      token = session.token;

      if (req.body.referralCode) {
        try {
          pilotDb.trackReferral(req.body.referralCode, {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            role: 'driver',
          });
        } catch (refErr) {
          console.warn('[Referral] Failed to track driver referral on application:', refErr);
        }
      }
    }

    return res.status(201).json({ success: true, application, driver, token });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Application failed' });
  }
});

app.get('/api/admin/applications', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { status } = req.query;
  const applications = pilotDb.getAllDriverApplications(status as any);
  return res.status(200).json({ success: true, applications });
});

app.post('/api/drivers/:id/complete-training', (req, res) => {
  const ok = pilotDb.completeDriverTraining(req.params.id);
  return res.status(200).json({ success: ok });
});

// Riders Management (A8)
app.get('/api/admin/riders', requireStaffAuth(), (_req, res) => {
  const users = pilotDb.getAllUsers();
  return res.status(200).json({ success: true, riders: users });
});

app.post('/api/admin/riders/:id/block', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, error: 'Block reason required' });
  const staff = getActingStaff(req);
  const result = pilotDb.blockUser(req.params.id, reason, staff);
  return res.status(200).json(result);
});

app.post('/api/admin/riders/:id/unblock', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.unblockUser(req.params.id, staff);
  return res.status(200).json(result);
});

// Delete Passenger Registration (Superadmin / Ops)
app.delete(['/api/admin/riders/:id', '/api/admin/users/:id'], requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteUser(req.params.id, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

// Fares Matrix (A9)
app.get('/api/admin/fares', requireStaffAuth(), (_req, res) => {
  const fares = pilotDb.getAllFareRules();
  return res.status(200).json({ success: true, fares, matrix: CAMPUS_ROUTE_MATRIX });
});

app.post('/api/admin/fares', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const {
    fromZone,
    toZone,
    kekeFare,
    okadaFare,
    carFare,
    smallBusFare,
    bigBusFare,
    originalFromZone,
    originalToZone,
  } = req.body;
  if (!fromZone || !toZone || kekeFare === undefined) {
    return res.status(400).json({ success: false, error: 'fromZone, toZone, and fares required' });
  }
  const staff = getActingStaff(req);
  const rule = pilotDb.updateFareRule(
    String(fromZone).trim(),
    String(toZone).trim(),
    {
      kekeFare: Number(kekeFare) || 0,
      okadaFare: Number(okadaFare) || 0,
      carFare: Number(carFare) || 0,
      smallBusFare: smallBusFare !== undefined ? Number(smallBusFare) || 0 : undefined,
      bigBusFare: bigBusFare !== undefined ? Number(bigBusFare) || 0 : undefined,
    },
    staff,
    originalFromZone || originalToZone ? { originalFromZone, originalToZone } : undefined
  );
  return res.status(200).json({ success: true, rule });
});

app.delete('/api/admin/fares', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const fromZone = String(req.body.fromZone || req.query.fromZone || '').trim();
  const toZone = String(req.body.toZone || req.query.toZone || '').trim();
  if (!fromZone || !toZone) {
    return res.status(400).json({ success: false, error: 'fromZone and toZone query or body parameters required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.deleteFareRule(fromZone, toZone, staff);
  if (!result.success) {
    return res.status(404).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/fares/batch', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ success: false, error: 'rules array is required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.setAllFareRules(rules, staff);
  return res.status(200).json(result);
});

app.put('/api/admin/fares/batch', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ success: false, error: 'rules array is required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.setAllFareRules(rules, staff);
  return res.status(200).json(result);
});

// Cash & Fees Ledger (A10)
app.get('/api/admin/cash', requireStaffAuth(['pilot_lead', 'operations']), (_req, res) => {
  const drivers = pilotDb.getAllDrivers();
  const trips = pilotDb.getAllTrips().filter(t => t.status === 'completed');
  const totalCashCollected = trips.reduce((sum, t) => sum + (t.fareNaira || 0), 0);

  const ledger = drivers.map(d => {
    const driverTrips = trips.filter(t => t.driverId === d.id);
    const cashTotal = driverTrips.reduce((sum, t) => sum + (t.fareNaira || 0), 0);
    return {
      driverId: d.id,
      driverName: d.name,
      vehiclePlate: d.vehiclePlate,
      vehicleCategory: d.vehicleCategory,
      totalCompletedTrips: driverTrips.length,
      totalCashCollected: cashTotal,
      pilotCommissionDue: 0,
      remittanceStatus: 'CLEARED_0_PCT',
    };
  });

  return res.status(200).json({
    success: true,
    totalCashCollected,
    platformFeeTotal: 0,
    commissionRate: '0% (FUTMINNA Campus Pilot)',
    ledger,
  });
});

app.post('/api/admin/cash/mark-paid', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { driverId, amount = 0, notes } = req.body;
  if (!driverId) return res.status(400).json({ success: false, error: 'driverId required' });
  const staff = getActingStaff(req);
  const result = pilotDb.recordCashRemittance(driverId, Number(amount), notes, staff.id);
  if (!result.success) return res.status(400).json(result);
  return res.status(200).json(result);
});

// Safety & SOS Incidents (A11, R13, R17)
app.post('/api/safety/sos', (req, res) => {
  try {
    const {
      tripId,
      reporterType = 'rider',
      reporterName = 'Campus Passenger',
      reporterPhone = '+234 800 000 0000',
      emergencyContactPhone = '+234 803 612 0041',
      vehiclePlate,
      driverName,
      locationName = 'FUTMINNA Gidan Kwanu Campus',
      coords = [9.5330, 6.4475],
      description = 'Emergency SOS triggered from mobile application',
    } = req.body;

    const incident = pilotDb.triggerSosIncident({
      tripId,
      reporterType,
      reporterName,
      reporterPhone,
      emergencyContactPhone,
      vehiclePlate,
      driverName,
      locationName,
      coords,
      description,
    });

    console.warn(`[EMERGENCY SOS ALERT ACTIVATED] Incident: ${incident.id} by ${reporterName} (${reporterPhone}) at ${locationName}`);

    return res.status(201).json({
      success: true,
      incident,
      emergencyCadetsPhone: '+234 803 612 0041',
      universityClinicPhone: '+234 805 918 2234',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/incidents', requireStaffAuth(), (_req, res) => {
  const incidents = pilotDb.getAllIncidents();
  return res.status(200).json({ success: true, incidents });
});

app.post('/api/admin/incidents/:id/resolve', requireStaffAuth(['pilot_lead', 'operations', 'school_security']), (req, res) => {
  const { resolutionNote } = req.body;
  if (!resolutionNote || resolutionNote.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'A mandatory written outcome note is required to resolve safety incidents.',
    });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.resolveIncident(req.params.id, resolutionNote, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
});

// Support Tickets (A12, E3, E4)
app.get('/api/admin/support/tickets', requireStaffAuth(), (req, res) => {
  const { category } = req.query;
  const tickets = pilotDb.getAllSupportTickets(category as any);
  return res.status(200).json({ success: true, tickets });
});

app.post('/api/admin/support/tickets', (req, res) => {
  const { tripId, riderName, riderPhone, category, subject, description } = req.body;
  if (!riderName || !riderPhone || !description) {
    return res.status(400).json({ success: false, error: 'riderName, riderPhone, and description required' });
  }
  const ticket = pilotDb.createSupportTicket({
    tripId,
    riderName,
    riderPhone,
    category: category || 'other',
    subject: subject || 'Campus ride inquiry',
    description,
  });
  return res.status(201).json({ success: true, ticket });
});

app.post('/api/admin/support/tickets/:id/reply', requireStaffAuth(), (req, res) => {
  const { text, sender = 'support', senderName = 'Helpdesk' } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'Message text required' });
  const updated = pilotDb.addSupportTicketMessage(req.params.id, sender, senderName, text);
  if (!updated) return res.status(404).json({ success: false, error: 'Ticket not found' });
  return res.status(200).json({ success: true, ticket: updated });
});

app.post('/api/admin/support/tickets/:id/resolve', requireStaffAuth(), (req, res) => {
  const { resolutionNote } = req.body;
  if (!resolutionNote) return res.status(400).json({ success: false, error: 'Resolution note required' });
  const staff = getActingStaff(req);
  const updated = pilotDb.resolveSupportTicket(req.params.id, resolutionNote, staff);
  if (!updated) return res.status(404).json({ success: false, error: 'Ticket not found' });
  return res.status(200).json({ success: true, ticket: updated });
});

app.delete('/api/admin/support/tickets/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteSupportTicket(req.params.id, staff);
  if (!result.success) {
    return res.status(404).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/support/tickets/clear', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.clearAllSupportTickets(staff);
  return res.status(200).json(result);
});

// Announcements (A13)
// Public in-app Announcements for Passengers & Drivers
app.get('/api/announcements', (req, res) => {
  const { audience } = req.query;
  let announcements = pilotDb.getAllAnnouncements().filter((a) => a.channels.includes('in_app'));
  if (audience && audience !== 'all') {
    announcements = announcements.filter((a) => a.audience === 'all' || a.audience === audience);
  }
  return res.status(200).json({ success: true, announcements });
});

app.get('/api/admin/announcements', requireStaffAuth(), (_req, res) => {
  return res.status(200).json({ success: true, announcements: pilotDb.getAllAnnouncements() });
});

app.post('/api/admin/announcements', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const { title, body, audience = 'all', channels = ['in_app'] } = req.body;
  if (!title || !body) {
    return res.status(400).json({ success: false, error: 'Title and body are required' });
  }
  const staff = getActingStaff(req);
  const result = pilotDb.createAnnouncement({ title, body, audience, channels }, staff);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
});

app.delete('/api/admin/announcements/:id', requireStaffAuth(['pilot_lead', 'operations']), (req, res) => {
  const staff = getActingStaff(req);
  const result = pilotDb.deleteAnnouncement(req.params.id, staff);
  if (!result.success) {
    return res.status(404).json(result);
  }
  return res.status(200).json(result);
});

// Reports & Audit Logs (A14, A15)
app.get('/api/admin/reports', requireStaffAuth(), (_req, res) => {
  const trips = pilotDb.getAllTrips();
  const drivers = pilotDb.getAllDrivers();
  const metrics = pilotDb.getDashboardMetrics();
  const surveys = pilotDb.getAllSurveys();

  return res.status(200).json({
    success: true,
    metrics,
    totalTrips: trips.length,
    completedTrips: trips.filter(t => t.status === 'completed').length,
    cancelledTrips: trips.filter(t => t.status === 'cancelled').length,
    topRoutes: [
      { route: 'Main Gate <-> Student Hostels', count: 184, fare: 200 },
      { route: 'Student Hostels <-> SEET Complex', count: 96, fare: 150 },
      { route: 'Hostels <-> Central Library', count: 72, fare: 150 },
    ],
    driverRankings: drivers.map(d => ({
      name: d.name,
      rating: d.rating,
      trips: d.totalTrips,
      plate: d.vehiclePlate,
    })),
    surveyCount: surveys.length,
  });
});

app.get('/api/admin/settings', requireStaffAuth(), (_req, res) => {
  return res.status(200).json({ success: true, settings: pilotDb.getSettings() });
});

app.post('/api/admin/settings', requireStaffAuth(['pilot_lead']), (req, res) => {
  const staff = getActingStaff(req);
  const updated = pilotDb.updateSettings(req.body, staff);
  return res.status(200).json({ success: true, settings: updated });
});

app.get('/api/admin/audit-logs', requireStaffAuth(['pilot_lead', 'viewer', 'operations']), (_req, res) => {
  return res.status(200).json({ success: true, auditLogs: pilotDb.getAuditLogs() });
});

// Clear Audit Logs (Super Admin / Pilot Lead only)
app.post('/api/admin/audit-logs/clear', requireStaffAuth(['pilot_lead']), (req, res) => {
  const staff = (req as any).authenticatedStaff;
  const result = pilotDb.clearAuditLogs(staff);
  return res.status(200).json(result);
});

// Live Campus Roster (Protected with requireStaffAuth)
app.get('/api/admin/roster', requireStaffAuth(), (_req, res) => {
  const roster = pilotDb.getCampusRoster();
  return res.status(200).json({ success: true, ...roster });
});

// Pilot Surveys (E6)
app.post('/api/surveys', (req, res) => {
  const { userId = 'usr_student_01', tripId, priceFairness = 'fair', safetyFeeling = 'very_safe', wouldUseAgain = true, comments } = req.body;
  const survey = pilotDb.submitSurvey({
    userId,
    tripId,
    priceFairness,
    safetyFeeling,
    wouldUseAgain,
    comments,
  });
  return res.status(201).json({ success: true, survey });
});

app.get('/api/admin/surveys', requireStaffAuth(), (_req, res) => {
  return res.status(200).json({ success: true, surveys: pilotDb.getAllSurveys() });
});

app.delete('/api/admin/surveys/:id', requireStaffAuth(), (req, res) => {
  const success = pilotDb.deleteSurvey(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Feedback record not found' });
  }
  return res.status(200).json({ success: true });
});

app.post('/api/admin/surveys/clear', requireStaffAuth(), (_req, res) => {
  pilotDb.clearAllSurveys();
  return res.status(200).json({ success: true });
});

// Public Read-Only Trip Share (E5)
app.get('/api/trips/share/:token', (req, res) => {
  const trip = pilotDb.getTripByShareToken(req.params.token);
  if (!trip) {
    return res.status(404).json({ success: false, error: 'Live ride share link not found or expired' });
  }

  const publicTrip = {
    id: trip.id,
    status: trip.status,
    riderFirstName: trip.riderName.split(' ')[0],
    pickupName: trip.pickupName,
    dropoffName: trip.dropoffName,
    pickupCoords: trip.pickupCoords,
    dropoffCoords: trip.dropoffCoords,
    vehicleCategory: trip.vehicleCategory,
    fareNaira: trip.fareNaira,
    driverFirstName: trip.driverName ? trip.driverName.split(' ')[0] : undefined,
    vehiclePlate: trip.vehiclePlate,
    vehicleModel: trip.vehicleModel,
    createdAt: trip.createdAt,
    startedAt: trip.startedAt,
    completedAt: trip.completedAt,
  };

  return res.status(200).json({ success: true, trip: publicTrip });
});


// Background Offer Cascade Timer (checks every 2 seconds for expired matching offers)
setInterval(() => {
  try {
    pilotDb.checkAndCascadeExpiredOffers();
  } catch (err) {
    console.error('[Server Timer] Error in offer cascade loop:', err);
  }
}, 2000);

async function startServer() {
  await pilotDb.ready();

  if (serveDist) {
    // Production mode: serve built assets from dist
    app.use(express.static(distPath, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));

    // If an asset in /assets/ is requested but does not exist, return 404 (NEVER return index.html)
    app.all('/assets/*', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Dev mode: mount Vite dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/data/pilot_db.json',
            '**/data/backups/**',
            '**/*.tmp',
            '**/*.log',
            '**/.system_generated/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite && typeof vite.ssrFixStacktrace === 'function') {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Zylift server running on http://0.0.0.0:${PORT} (serving ${serveDist ? 'production dist' : 'vite middleware'} + Gemini Live API on /api/live)`);
  });

  const gracefulShutdown = async () => {
    await pilotDb.flush();
    process.exit(0);
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer();
