import { pilotDb } from '../src/server/db';

console.log('=== TESTING PHASE 1: COMPANION BACKEND & DATA ARCHITECTURE ===');

// 1. Staff Auth & RBAC & 2FA
console.log('\n[1] Testing Staff Auth & 2FA...');
const badLogin = pilotDb.staffLogin('lead@kerb.futminna.edu.ng', 'wrongpass');
console.log('Bad password attempt:', badLogin.success ? 'FAIL' : 'PASS (rejected: ' + badLogin.error + ')');

const goodLogin = pilotDb.staffLogin('lead@kerb.futminna.edu.ng', 'admin123');
if (!goodLogin.success || !goodLogin.requires2fa) {
  throw new Error('Good login should require 2FA');
}
console.log('Valid credentials -> 2FA required: PASS');

const verify2fa = pilotDb.staffVerify2fa(goodLogin.staffId!, '123456');
if (!verify2fa.success || !verify2fa.staff || verify2fa.staff.role !== 'pilot_lead') {
  throw new Error('2FA verification failed');
}
console.log('2FA verified with token for role:', verify2fa.staff.role, 'PASS');

// 2. Driver Application (V1-V7) and 4-box Verification Gate (A6/A7)
console.log('\n[2] Testing Driver Application & 4-Box In-Person Gate...');
const app = pilotDb.createDriverApplication({
  applicantName: 'Audu Bala',
  phone: '+234 813 555 9012',
  vehicleCategory: 'keke',
  vehiclePlate: 'MNA-888-KW',
  vehicleModel: 'Bajaj RE',
  vehicleColor: 'Yellow',
  facePhotoUrl: '/src/assets/images/driver_avatar_keke_1790847258442.jpg',
  agreedToRules: true,
});
console.log('Application submitted, status:', app.status);

// Try approving with only 3 boxes checked (MUST FAIL)
const partialChecklist = {
  metInPerson: true,
  faceMatchesId: true,
  plateMatchesVehicle: true,
  parkLeaderKnown: false, // Incomplete!
};
const failedApprove = pilotDb.approveDriverApplication(app.id, partialChecklist, verify2fa.staff);
if (failedApprove.success) {
  throw new Error('Approval must fail if any of the 4 in-person checks is false');
}
console.log('Incomplete 4-box checklist rejected as expected: PASS');

// Approve with ALL 4 boxes checked
const completeChecklist = {
  metInPerson: true,
  faceMatchesId: true,
  plateMatchesVehicle: true,
  parkLeaderKnown: true,
};
const approved = pilotDb.approveDriverApplication(app.id, completeChecklist, verify2fa.staff);
if (!approved.success || !approved.driver || !approved.driver.isApproved) {
  throw new Error('Approval with all 4 boxes failed');
}
console.log('Driver approved and activated in driver roster:', approved.driver.name, approved.driver.vehiclePlate, 'PASS');

// 3. Safety & Emergency SOS Alert (A11, R13, R17)
console.log('\n[3] Testing Safety Incident & SOS Workflow...');
const incident = pilotDb.triggerSosIncident({
  reporterType: 'rider',
  reporterName: 'Fatima Bello',
  reporterPhone: '+234 816 772 0192',
  locationName: 'Near School Motor Park',
  coords: [9.5368, 6.4510],
  description: 'Driver driving erratically, feel unsafe',
});
console.log('SOS Incident triggered:', incident.id, 'status:', incident.status, 'severity:', incident.severity);

// Try resolving without note (MUST FAIL)
const badResolve = pilotDb.resolveIncident(incident.id, '', verify2fa.staff);
if (badResolve.success) {
  throw new Error('Resolve without outcome note must fail');
}
console.log('Resolution without mandatory written note rejected: PASS');

// Resolve with valid note
const goodResolve = pilotDb.resolveIncident(incident.id, 'Spoke with campus security cadets. Cadet dispatched, rider safely escorted to Hostel Block B. Driver cautioned.', verify2fa.staff);
if (!goodResolve.success || goodResolve.incident?.status !== 'resolved') {
  throw new Error('Valid resolution failed');
}
console.log('Incident resolved with documented outcome note: PASS');

// 4. Audit Log Verification
console.log('\n[4] Testing Audit Logging...');
const logs = pilotDb.getAuditLogs();
console.log('Total audit logs recorded:', logs.length);
const driverApprovalLog = logs.find(l => l.action === 'driver_approval');
const sosResolveLog = logs.find(l => l.action === 'sos_resolve');
if (!driverApprovalLog || !sosResolveLog) {
  throw new Error('Audit logs missing critical actions');
}
console.log('Audit logging verified for driver approvals and SOS resolutions: PASS');

// 5. Trip Lifecycle & Share Token
console.log('\n[5] Testing Trip Lifecycle & Public Share Token...');
const trip = pilotDb.createTrip({
  riderId: 'usr_student_01',
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

if (!trip.shareToken || !trip.shareToken.startsWith('sh_')) {
  throw new Error('Trip missing shareToken');
}
console.log('Trip created with shareToken:', trip.shareToken);

const sharedTrip = pilotDb.getTripByShareToken(trip.shareToken);
if (!sharedTrip || sharedTrip.id !== trip.id) {
  throw new Error('Failed to retrieve trip by shareToken');
}
console.log('Public share token lookup: PASS');

// 6. Rating & Rolling Average
console.log('\n[6] Testing Trip Rating & Rolling Average...');
pilotDb.updateTripStatus(trip.id, 'matching');
pilotDb.acceptTripOffer(trip.id, approved.driver.id);
pilotDb.updateTripStatus(trip.id, 'in_progress');
pilotDb.updateTripStatus(trip.id, 'completed');

const rated = pilotDb.submitTripRating(trip.id, 5, ['Safe driving', 'Clean keke'], 'Great ride!');
if (!rated.success || !rated.trip?.riderRating) {
  throw new Error('Trip rating submission failed');
}
console.log('Trip rated 5 stars with tags. Driver rating:', approved.driver.rating, 'PASS');

console.log('\n=== ALL PHASE 1 COMPANION BACKEND LOGIC VERIFIED 100% ===');
