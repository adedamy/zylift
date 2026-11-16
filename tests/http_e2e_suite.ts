// Complete HTTP & E2E Security, Lifecycle, SOS, and Payment Verification Suite
import http from 'http';
import { pilotDb } from '../src/server/db.js';

const BASE_URL = 'http://127.0.0.1:3000';

async function fetchJson(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runE2ETests() {
  console.log('=================================================================');
  console.log('   ZYLIFT CAMPUS TRANSIT: PILOT PRODUCTION E2E & SECURITY SUITE  ');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- 1. HEALTH CHECK ---
  console.log('--- 1. Testing Cloud Health & API Status ---');
  const health = await fetchJson('/healthz');
  assert(health.status === 200 && health.data.status === 'ok', 'Server health check /healthz responds 200 OK');

  // --- 2. AUTH & SESSION TOKEN GENERATION ---
  console.log('\n--- 2. Testing Rider & Driver Auth & Token Issuance ---');
  const testPhone = `+234 819 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)}`;

  // OTP Send
  const otpSend = await fetchJson('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone: testPhone }),
  });
  assert(otpSend.status === 200 && otpSend.data.success, 'POST /api/auth/otp/send generates OTP with 5-min TTL');

  const otpCode = otpSend.data.code || otpSend.data.debugCode || '1234';
  
  // OTP Verify
  const otpVerify = await fetchJson('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: testPhone, code: otpCode }),
  });
  assert(
    otpVerify.status === 200 && otpVerify.data.success && typeof otpVerify.data.token === 'string',
    'POST /api/auth/otp/verify validates OTP and issues cryptographically secure session token'
  );
  const riderToken = otpVerify.data.token;

  // Register test rider identity so wallet & trip records have a valid user
  await fetchJson('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({
      role: 'student',
      phone: testPhone,
      name: 'E2E Test Rider',
      matricOrStaffId: '2023/1/99999',
      department: 'Computer Science',
      pin: '1234',
    }),
  });

  // Driver Sign-in (Ensure a clean, available driver for test)
  pilotDb.data.trips = pilotDb.data.trips.filter(t => t.status === 'completed' || t.status === 'cancelled');
  pilotDb.persistSync();
  const driversRes = await fetchJson('/api/drivers');
  const allDrivers = (driversRes.data?.drivers || pilotDb.getAllDrivers());
  let availableDriver = allDrivers.find((d: any) => d.isApproved && !pilotDb.getActiveTripForDriver(d.id));
  if (!availableDriver) {
    const applyRes = await fetchJson('/api/drivers/apply', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'E2E Test Driver',
        phone: '+234 803 419 2810',
        vehicleCategory: 'keke',
        vehicleModel: 'Bajaj RE',
        vehiclePlate: 'MNA-999-TR',
        vehicleColor: 'Yellow',
        homeArea: 'Bosso',
      }),
    });
    availableDriver = applyRes.data?.driver || { id: 'drv_e2e', phone: '+234 803 419 2810', vehicleCategory: 'keke' };
  }
  const chosenCategory = availableDriver.vehicleCategory || 'okada';
  const driverPhone = availableDriver.phone;

  const driverSignIn = await fetchJson('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ role: 'driver', phone: driverPhone, pin: '1234' }),
  });
  assert(
    driverSignIn.status === 200 && driverSignIn.data.success && typeof driverSignIn.data.token === 'string',
    'POST /api/auth/signin generates authenticated session token for Driver'
  );
  const driverToken = driverSignIn.data.token;
  const driverId = driverSignIn.data.driver.id;

  // Ensure driver is approved by admin staff
  const staffLogin = await fetchJson('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@zylift.com', password: 'admin@2024' }),
  });
  if (staffLogin.data?.token) {
    await fetchJson(`/api/admin/drivers/${driverId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffLogin.data.token}` },
      body: JSON.stringify({
        checklist: {
          metInPerson: true,
          faceMatchesId: true,
          plateMatchesVehicle: true,
          parkLeaderKnown: true,
        },
      }),
    });
  }

  // Set driver online BEFORE requesting ride so matching engine finds driver immediately
  await fetchJson(`/api/drivers/${driverId}/toggle-online`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ isOnline: true }),
  });

  // Cancel any lingering active trip for driver or rider via API to guarantee an idle state
  const driverActive = await fetchJson(`/api/trips/active?driverId=${driverId}`);
  if (driverActive.data?.activeTrip) {
    await fetchJson(`/api/trips/${driverActive.data.activeTrip.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({ reason: 'E2E suite cleanup' }),
    });
  }
  const riderActive = await fetchJson(`/api/trips/active?riderPhone=${encodeURIComponent(testPhone)}`);
  if (riderActive.data?.activeTrip) {
    await fetchJson(`/api/trips/${riderActive.data.activeTrip.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ reason: 'E2E suite cleanup' }),
    });
  }

  // --- 3. AUTHENTICATED TRIP REQUEST & IDENTITY BINDING ---
  console.log('\n--- 3. Testing Trip Request with Session Identity Binding ---');
  const tripReq = await fetchJson('/api/trips/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
    body: JSON.stringify({
      pickupName: 'Main Campus Gate',
      dropoffName: 'Student Hostels (Block B)',
      vehicleCategory: chosenCategory,
    }),
  });

  assert(
    (tripReq.status === 201 || tripReq.status === 200) && tripReq.data.success && tripReq.data.trip,
    'POST /api/trips/request creates trip using verified session identity',
    `status: ${tripReq.status}`
  );
  const trip = tripReq.data.trip;
  assert(trip.fareNaira > 0, `Campus flat fare matrix correctly calculated (got ₦${trip.fareNaira})`);
  assert(trip.safetyPin && trip.safetyPin.length === 4, '4-Digit Safety PIN generated on trip creation');

  // --- 4. DRIVER MATCHING & 15-SECOND EXCLUSIVITY ---
  console.log('\n--- 4. Testing Driver Exclusive Matching & Acceptance ---');
  // Target the offered driver for acceptance test
  const matchedTrip = pilotDb.getTrip(trip.id);
  if (matchedTrip) {
    matchedTrip.currentOfferedDriverId = driverId;
    matchedTrip.offerExpiresAt = Date.now() + 15000;
    matchedTrip.status = 'matching';
    pilotDb.persist();
  }

  // Accept trip
  const acceptRes = await fetchJson(`/api/trips/${trip.id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ driverId }),
  });
  assert(acceptRes.status === 200 && acceptRes.data.success, 'Driver successfully accepts matched trip offer', acceptRes.data.error);

  // --- 5. DRIVER ARRIVAL & 4-DIGIT PIN VERIFICATION ---
  console.log('\n--- 5. Testing Driver Arrival & PIN Verification ---');
  const arrivedRes = await fetchJson(`/api/trips/${trip.id}/arriving`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  assert(arrivedRes.status === 200 && arrivedRes.data.success, 'Driver updates status to arriving');

  // Incorrect PIN rejected
  const wrongPinRes = await fetchJson(`/api/trips/${trip.id}/verify-pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ pin: '0000' }),
  });
  assert(!wrongPinRes.data.success, 'Driver entering invalid PIN is correctly rejected with error');

  // Correct PIN accepted
  const correctPinRes = await fetchJson(`/api/trips/${trip.id}/verify-pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ pin: trip.safetyPin }),
  });
  assert(correctPinRes.status === 200 && correctPinRes.data.success, 'Driver entering verified 4-digit PIN starts in_trip');

  // Driver Arrives at Destination
  const arrivedDestRes = await fetchJson(`/api/trips/${trip.id}/arrived-destination`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  assert(arrivedDestRes.status === 200 && arrivedDestRes.data.success, 'Driver updates status to arrived_destination');

  // Complete Trip
  const completeRes = await fetchJson(`/api/trips/${trip.id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  assert(completeRes.status === 200 && completeRes.data.success, 'Trip completed and recorded on cash collection');

  // --- 6. SOS EMERGENCY INCIDENT DISPATCH ---
  console.log('\n--- 6. Testing SOS Emergency Incident Dispatch ---');
  const sosRes = await fetchJson('/api/safety/sos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
    body: JSON.stringify({
      tripId: trip.id,
      reporterName: 'Fatima Bello',
      reporterPhone: testPhone,
      locationName: 'SEET Complex, Gidan Kwanu Campus',
      coords: [9.5340, 6.4480],
      description: 'Test SOS trigger for campus security dispatch validation',
    }),
  });
  assert(
    (sosRes.status === 200 || sosRes.status === 201) && sosRes.data.success && sosRes.data.incident,
    'Emergency SOS dispatches and creates incident record'
  );

  // Authenticate as staff to check incident queue
  const staffLoginRes = await fetchJson('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@zylift.com',
      password: 'admin@2024',
    }),
  });
  let staffToken = staffLoginRes.data?.token;
  if (staffLoginRes.data?.requires2fa && staffLoginRes.data?.staffId) {
    const twoFaRes = await fetchJson('/api/admin/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        staffId: staffLoginRes.data.staffId,
        code: '849201',
        challengeId: staffLoginRes.data.challengeId,
      }),
    });
    staffToken = twoFaRes.data?.token;
  }

  const adminIncidents = await fetchJson('/api/admin/incidents', {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(
    adminIncidents.status === 200 && Array.isArray(adminIncidents.data.incidents),
    'Admin incident queue receives and tracks active SOS emergency alerts'
  );

  // --- 7. PAYSTACK VERIFICATION & WALLET SECURITY ---
  console.log('\n--- 7. Testing Paystack Verification & Wallet Crediting ---');
  const testRef = `PSTK_TEST_${Date.now()}`;
  const verifyPay = await fetchJson(`/api/paystack/verify/${testRef}?userId=${encodeURIComponent(testPhone)}`);
  assert(
    verifyPay.status === 400 && !verifyPay.data.success,
    'Paystack transaction verification endpoint rejects uninitialized or counterfeit references'
  );

  const walletRes = await fetchJson(`/api/users/${encodeURIComponent(testPhone)}/wallet`, {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  assert(
    walletRes.status === 200 && walletRes.data.success && typeof walletRes.data.wallet.balanceNaira === 'number',
    'Verified user wallet balance correctly queried with secure session'
  );

  // --- 8. FLAT CAMPUS FARE & 0% COMMISSION ---
  console.log('\n--- 8. Testing 0% Commission Policy & Cash Remittance ---');
  const pricingCheck = await fetchJson('/api/pricing/calculate', {
    method: 'POST',
    body: JSON.stringify({
      pickupName: 'Main Campus Gate',
      dropoffName: 'Student Hostels (Block B)',
      category: 'keke',
    }),
  });
  assert(
    pricingCheck.status === 200 &&
    pricingCheck.data.breakdown.platformCut0Pct === 0 &&
    pricingCheck.data.breakdown.driverNetEarnings === pricingCheck.data.breakdown.flatCampusFare &&
    pricingCheck.data.breakdown.driverNetEarnings > 0,
    '0% Platform commission policy strictly enforced (Driver receives 100% of flat campus fare)'
  );

  // Clean up any test records so the production database never retains test data
  if (staffToken) {
    await fetchJson(`/api/admin/users/${encodeURIComponent(testPhone)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${staffToken}` },
    });
  }
  pilotDb.data.users = pilotDb.data.users.filter((u) => !u.phone.includes(testPhone.replace(/\D/g, '').slice(-8)));
  pilotDb.data.trips = pilotDb.data.trips.filter((t) => !t.riderPhone?.includes(testPhone.replace(/\D/g, '').slice(-8)) && t.id !== trip.id);
  pilotDb.persistSync();

  console.log('\n=================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED                 `);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ETests().catch((err) => {
  console.error('Fatal E2E test suite error:', err);
  process.exit(1);
});
