import { getRouteQuote, listOptions, createQuoteToken, verifyQuoteToken, vehicleIneligibleReason, parseCoords } from './src/server/fareEngine.js';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const suleja: [number, number] = [9.18, 7.18];
const minna: [number, number] = [9.6139, 6.5569];
const gate: [number, number] = [9.5375, 6.452];
const hostels: [number, number] = [9.5265, 6.443];

// --- capacity / vehicle rules (user's capacities) ---
ok('okada carries 2', vehicleIneligibleReason('okada', 2, 3) === null);
ok('okada rejects 3', vehicleIneligibleReason('okada', 3, 3) !== null);
ok('keke carries 5', vehicleIneligibleReason('keke', 5, 5) === null);
ok('keke rejects 6', vehicleIneligibleReason('keke', 6, 5) !== null);
ok('car carries 10', vehicleIneligibleReason('cab_go', 10, 5) === null);
ok('car rejects 11', vehicleIneligibleReason('cab_go', 11, 5) !== null);
ok('small bus carries 18', vehicleIneligibleReason('small_bus', 18, 5) === null);
ok('small bus rejects 19', vehicleIneligibleReason('small_bus', 19, 5) !== null);
ok('big bus carries 80', vehicleIneligibleReason('big_bus', 80, 5) === null);
ok('big bus hidden from 1 passenger', vehicleIneligibleReason('big_bus', 1, 5) !== null);
ok('okada not offered for 100 km', vehicleIneligibleReason('okada', 1, 100) !== null);
ok('keke not offered for 100 km', vehicleIneligibleReason('keke', 1, 100) !== null);
ok('car offered for 100 km', vehicleIneligibleReason('cab_go', 1, 100) === null);

// --- coordinate validation ---
ok('valid coords accepted', parseCoords([9.5, 6.4]) !== null);
ok('out-of-Nigeria coords rejected', parseCoords([51.5, -0.12]) === null);
ok('garbage coords rejected', parseCoords(['a', 'b']) === null && parseCoords(null) === null);

(async () => {
  // --- 1) fallback path (no ORS key) ---
  delete process.env.ORS_API_KEY;
  const near = await getRouteQuote(gate, hostels);
  ok('fallback quote marked approximate', near.approximate === true, `(${near.km} km)`);

  // --- 2) mocked ORS response (MOCK numbers, not real road data) ---
  process.env.ORS_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  let calls = 0; let lastBody: any;
  globalThis.fetch = (async (_u: any, init: any) => {
    calls++; lastBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ routes: [{ summary: { distance: 100000, duration: 6600 } }] }), { status: 200 });
  }) as any;
  const long = await getRouteQuote(suleja, minna);
  ok('ORS used (mock 100 km / 110 min)', long.km === 100 && long.minutes === 110 && !long.approximate);
  ok('ORS gets [lng,lat] order', lastBody.coordinates[0][0] === suleja[1] && lastBody.coordinates[0][1] === suleja[0]);
  await getRouteQuote(suleja, minna);
  ok('second identical quote served from cache', calls === 1);

  const { options, unavailable } = listOptions(long, 1);
  const cats = options.map(o => o.category);
  ok('100 km, 1 passenger -> only Car offered', cats.length === 1 && cats[0] === 'cab_go', JSON.stringify(cats));
  ok('okada/keke/buses listed as unavailable', unavailable.length === 4);
  const car = options[0].fareNaira;
  // base 500 + 150*(20 + 80*0.7) + 15*110 = 500 + 11400 + 1650 = 13550
  ok('car fare = 13550 (formula check)', car === 13550, `(got ${car})`);

  const group = listOptions(long, 12).options.map(o => o.category);
  ok('12 passengers on 100 km -> small bus only', group.length === 1 && group[0] === 'small_bus', JSON.stringify(group));
  const crowd = listOptions(long, 60).options.map(o => o.category);
  ok('60 passengers -> big bus only', crowd.length === 1 && crowd[0] === 'big_bus', JSON.stringify(crowd));

  // --- 3) quote token (price lock) ---
  const token = createQuoteToken(suleja, minna, long);
  ok('token verifies for same route', verifyQuoteToken(token, suleja, minna)?.fares.cab_go === 13550);
  ok('token rejected for different destination', verifyQuoteToken(token, suleja, hostels) === null);
  const tampered = token.slice(0, -3) + (token.endsWith('aaa') ? 'bbb' : 'aaa');
  ok('tampered token rejected', verifyQuoteToken(tampered, suleja, minna) === null);
  const [pl, sg] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString()), f: { cab_go: 1 } })).toString('base64url') + '.' + sg;
  ok('forged cheaper fare rejected', verifyQuoteToken(forged, suleja, minna) === null);
  ok('garbage token rejected', verifyQuoteToken('nope', suleja, minna) === null && verifyQuoteToken(undefined, suleja, minna) === null);

  // --- 4) ORS failure falls back safely ---
  routeFail: {
    process.env.ORS_API_KEY = 'test-key';
    globalThis.fetch = (async () => { throw new Error('network down'); }) as any;
    const fb = await getRouteQuote([9.3, 6.9], [9.4, 6.6]);
    ok('ORS outage -> approximate fallback, no crash', fb.approximate === true && fb.km > 0);
  }
  globalThis.fetch = realFetch;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
