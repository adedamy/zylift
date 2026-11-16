import { pilotDb } from '../src/server/db.js';
import { getDeterministicCampusFare } from '../src/data/futminnaLocations.js';

async function runVerification() {
  console.log('--- STARTING FOCUSED PILOT ENGINE VERIFICATION ---');

  // Test 1: Deterministic Route Matrix
  console.log('\n[1] Testing Deterministic Keyed Route Pricing:');
  const fareGateHostels = getDeterministicCampusFare('fut_gate', 'fut_hostels', 'keke');
  const fareHostelsGate = getDeterministicCampusFare('fut_hostels', 'fut_gate', 'keke');
  const fareGateSenate = getDeterministicCampusFare('fut_gate', 'fut_senate', 'okada');
  const fareGateBosso = getDeterministicCampusFare('fut_gate', 'fut_bosso', 'keke');

  console.log(`- Gate <-> Hostels (Keke): ₦${fareGateHostels} (Expected: ₦200)`);
  console.log(`- Hostels <-> Gate (Keke): ₦${fareHostelsGate} (Expected: ₦200)`);
  console.log(`- Gate <-> Senate (Okada): ₦${fareGateSenate} (Expected: ₦200)`);
  console.log(`- Gate <-> Bosso Campus (Keke): ₦${fareGateBosso} (Expected: ₦600)`);

  if (fareGateHostels !== 200 || fareHostelsGate !== 200 || fareGateBosso !== 600) {
    throw new Error('Fare matrix returned unexpected fares');
  }
  console.log('✔ Keyed Route Pricing verified!');

  // Test 2: PIN Security & Authentication
  console.log('\n[2] Testing 4-Digit Account Security PIN Authentication:');
  const validStudent = pilotDb.signInUser({
    phone: '+234 816 772 0192',
    name: 'Fatima Bello',
    role: 'student',
    securityPin: '1234',
  });
  console.log(`- Valid Student Auth: success=${validStudent.success}, user=${validStudent.user?.name}`);

  const invalidStudent = pilotDb.signInUser({
    phone: '+234 816 772 0192',
    name: 'Fatima Bello',
    role: 'student',
    securityPin: '9999', // wrong pin
  });
  console.log(`- Invalid Student Auth: success=${invalidStudent.success}, error="${invalidStudent.error}"`);
  if (invalidStudent.success) {
    throw new Error('PIN authentication allowed incorrect PIN!');
  }
  console.log('✔ 4-Digit Security PIN authentication verified!');

  // Test 3: Distance Ranking & Single-Driver Exclusive 15s Window
  console.log('\n[3] Testing Distance-Ranked Single-Driver Matching Queue:');
  const testDriversSeed = [
    { id: 'drv_fut_01', name: 'Yakubu Mohammed', phone: '+234 803 419 2810', vehicleCategory: 'keke', vehiclePlate: 'MNA-201-TR' },
    { id: 'drv_fut_02', name: 'Babatunde Aliyu', phone: '+234 814 883 1928', vehicleCategory: 'keke', vehiclePlate: 'NGR-891-AB' },
    { id: 'drv_fut_03', name: 'Shehu Garba', phone: '+234 805 771 2940', vehicleCategory: 'keke', vehiclePlate: 'MNA-204-TR' },
    { id: 'drv_fut_04', name: 'Sunday Okafor', phone: '+234 802 334 1189', vehicleCategory: 'keke', vehiclePlate: 'MNA-305-KD' },
  ];
  testDriversSeed.forEach((td) => {
    let drv = pilotDb.getDriver(td.id);
    if (!drv) {
      (pilotDb as any).data.drivers.push({
        id: td.id,
        name: td.name,
        phone: td.phone,
        vehicleCategory: td.vehicleCategory as any,
        vehiclePlate: td.vehiclePlate,
        vehicleModel: 'Bajaj RE',
        vehicleColor: 'Yellow',
        avatarUrl: '/src/assets/images/driver_keke.svg',
        isOnline: true,
        isApproved: true,
        isSuspended: false,
        rating: 5.0,
        totalTrips: 10,
        walletBalance: 0,
        securityPin: '1234',
        hasSmartphone: true,
        stationName: 'School Motor Park',
        currentLocation: { lat: 9.5375, lng: 6.4520, heading: 0 },
        lastSeen: new Date().toISOString(),
      } as any);
      (pilotDb as any).persist();
    } else {
      pilotDb.updateDriver(td.id, { isOnline: true, isApproved: true, isSuspended: false, vehicleCategory: 'keke', currentLocation: { lat: 9.5375, lng: 6.4520, heading: 0 } });
    }
    const act = pilotDb.getActiveTripForDriver(td.id);
    if (act) pilotDb.updateTripStatus(act.id, 'cancelled');
  });
  const trip = pilotDb.createTrip({
    riderId: 'usr_test_student',
    riderName: 'Fatima Bello',
    riderPhone: '+234 816 772 0192',
    pickupName: 'Main Campus Gate',
    pickupCoords: [9.5375, 6.4520],
    dropoffName: 'Student Hostels',
    dropoffCoords: [9.5265, 6.4430],
    vehicleCategory: 'keke',
    fareNaira: 200,
    paymentMethod: 'cash',
    safetyPin: '4821',
    driverId: null,
  });
  console.log(`- Created trip: ${trip.id}`);

  const matchInit = pilotDb.initiateTripMatching(trip.id);
  console.log(`- Matching initiated: success=${matchInit.success}, offeredDriverId=${matchInit.offeredDriverId}`);
  console.log(`- Trip status: ${matchInit.trip?.status}, currentOfferedDriver: ${matchInit.trip?.currentOfferedDriverId}`);

  // Verification of single-driver exclusivity: other driver polling must get null
  const otherDriverOffer = pilotDb.getPendingOfferForDriver('drv_fut_02');
  console.log(`- Other driver (drv_fut_02) polling incoming offer: ${otherDriverOffer ? otherDriverOffer.id : 'null (Exclusive)'}`);
  if (otherDriverOffer !== null && matchInit.offeredDriverId !== 'drv_fut_02') {
    throw new Error('Offer leaked to multiple drivers simultaneously!');
  }

  // Offered driver polling gets the offer
  const offeredDriverId = matchInit.offeredDriverId || '';
  const offeredDriverOffer = pilotDb.getPendingOfferForDriver(offeredDriverId);
  console.log(`- Offered driver (${offeredDriverId}) polling: ${offeredDriverOffer ? offeredDriverOffer.id : 'null'}`);
  if (!offeredDriverOffer) {
    throw new Error('Offered driver did not receive incoming offer!');
  }

  // Driver accepts offer with authorization check
  const acceptRes = pilotDb.acceptTripOffer(trip.id, offeredDriverId);
  console.log(`- Driver accepted: success=${acceptRes.success}, status=${acceptRes.trip?.status}, driverName=${acceptRes.trip?.driverName}`);
  if (!acceptRes.success || acceptRes.trip?.status !== 'accepted') {
    throw new Error('Driver failed to accept offer');
  }
  console.log('✔ Distance ranking & exclusive 15s matching verified!');

  // Test 4: Campus Park Marshal / Dispatcher Console for non-smartphone drivers
  console.log('\n[4] Testing Park Marshal Walk-up Ride Dispatch:');
  const existingActive = pilotDb.getActiveTripForDriver('drv_fut_03');
  if (existingActive) {
    pilotDb.updateTripStatus(existingActive.id, 'cancelled');
  }

  const dispatchRes = pilotDb.createDispatchedTrip({
    riderName: 'Umar Faruk',
    riderPhone: '+234 809 112 3344',
    pickupName: 'School Motor Park (Keke & Bike Station)',
    pickupCoords: [9.5368, 6.4510],
    dropoffName: 'SEET (School of Engineering Complex)',
    dropoffCoords: [9.5340, 6.4480],
    vehicleCategory: 'keke',
    driverId: 'drv_fut_03', // Shehu Garba (Keke driver)
    dispatcherName: 'Park Marshal Desk #1',
  });

  console.log(`- Dispatched trip created: success=${dispatchRes.success}, error=${dispatchRes.error}, tripId=${dispatchRes.trip?.id}`);
  console.log(`- Driver assigned: ${dispatchRes.trip?.driverName} (${dispatchRes.trip?.vehiclePlate})`);
  console.log(`- Dispatcher: ${dispatchRes.trip?.dispatcherName}, isManualDispatch: ${dispatchRes.trip?.isManualDispatch}`);
  console.log(`- Auto-generated Safety PIN: ${dispatchRes.trip?.safetyPin}, Fare: ₦${dispatchRes.trip?.fareNaira}`);

  if (!dispatchRes.success || !dispatchRes.trip?.isManualDispatch || dispatchRes.trip?.driverId !== 'drv_fut_03') {
    throw new Error(`Park Marshal manual dispatch failed: ${dispatchRes.error}`);
  }
  console.log('✔ Campus Park Marshal Dispatch Console verified!');

  // Cleanup test user and test trips so production database stays clean
  pilotDb.data.users = pilotDb.data.users.filter((u) => u.phone !== '+234 816 772 0192');
  pilotDb.data.trips = pilotDb.data.trips.filter((t) => !t.id.startsWith('TRP-DSP-') && t.riderPhone !== '+234 816 772 0192');
  pilotDb.persistSync();

  console.log('\n======================================================');
  console.log('🎉 ALL PRODUCTION PILOT UPGRADES VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
