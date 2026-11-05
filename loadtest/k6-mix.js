// MedScout API load test: ~30 req/s peak with a few signups/sec.
//
//   BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
//
// BASE_URL is required and there is no default. Production is refused unless
// ALLOW_PROD=1 is also set, and you should not set it. Never run this with real
// LOOPS_API_KEY / GOOGLE_PLACES_API_KEY / SENTRY_DSN in the target's environment
// (loadtest/local_server.py blanks them for you).
//
// Optional env:
//   PEAK_SIGNUPS_PER_SEC   default 3    new-user sessions at peak
//   PEAK_RETURNING_PER_SEC default 3    returning-user sessions at peak
//   POOL_SIZE              default 60   users pre-registered for returning sessions
//   HOLD                   default 5m   time at peak
//   INCLUDE_NEARBY         default 0    1 = also call /pharmacies/nearby (Google Places,
//                                       billed; needs the key, so only against a target
//                                       that really has one)
//   RUN_ID                 default epoch seconds; keeps emails unique across runs

import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) {
  throw new Error('BASE_URL is required, e.g. BASE_URL=http://127.0.0.1:8001');
}
if (/getmedscout\.com/i.test(BASE_URL) && __ENV.ALLOW_PROD !== '1') {
  throw new Error('Refusing to load-test production. Point BASE_URL at a local or staging copy.');
}

const API = `${BASE_URL}/api/v1`;
const RUN_ID = __ENV.RUN_ID || String(Math.floor(Date.now() / 1000));
const PASSWORD = 'LoadTest-pw-123';
const POOL_SIZE = parseInt(__ENV.POOL_SIZE || '60', 10);
const PEAK_SIGNUPS = parseInt(__ENV.PEAK_SIGNUPS_PER_SEC || '3', 10);
const PEAK_RETURNING = parseInt(__ENV.PEAK_RETURNING_PER_SEC || '3', 10);
const HOLD = __ENV.HOLD || '5m';
const INCLUDE_NEARBY = __ENV.INCLUDE_NEARBY === '1';

// Metrics worth watching beyond k6's defaults.
const rateLimited = new Rate('rate_limited');         // any 429: means a bucket collapsed
const serverErrors = new Counter('server_errors');     // any 5xx
const registerDuration = new Trend('register_duration', true);
const loginDuration = new Trend('login_duration', true);
const mapDuration = new Trend('map_duration', true);
const pharmaciesDuration = new Trend('pharmacies_duration', true);

// 4xx that the test expects (per-account report throttle, duplicate email) must
// not count toward http_req_failed. 429 is NOT in this list on purpose where it
// would signal limiter collapse; it is tracked via rate_limited instead.
const OK = http.expectedStatuses({ min: 200, max: 299 }, 409);
const OK_OR_THROTTLED = http.expectedStatuses({ min: 200, max: 299 }, 429);

export const options = {
  scenarios: {
    new_users: {
      executor: 'ramping-arrival-rate',
      exec: 'newUserSession',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 40,
      maxVUs: 200,
      stages: [
        { target: 1, duration: '1m' },
        { target: PEAK_SIGNUPS, duration: '2m' },
        { target: PEAK_SIGNUPS, duration: HOLD },
        { target: 0, duration: '1m' },
      ],
    },
    returning_users: {
      executor: 'ramping-arrival-rate',
      exec: 'returningSession',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 40,
      maxVUs: 200,
      stages: [
        { target: 1, duration: '1m' },
        { target: PEAK_RETURNING, duration: '2m' },
        { target: PEAK_RETURNING, duration: HOLD },
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    'http_req_duration{name:register}': ['p(95)<1500'],
    'http_req_duration{name:login}': ['p(95)<1500'],
    'http_req_duration{name:map}': ['p(95)<800'],
    'http_req_duration{name:pharmacies}': ['p(95)<800'],
    rate_limited: ['rate<0.01'],
    server_errors: ['count==0'],
    dropped_iterations: ['count<1'],
    checks: ['rate>0.99'],
  },
};

// ---- helpers ---------------------------------------------------------------

function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return { headers: h };
}

function record(res) {
  rateLimited.add(res.status === 429);
  if (res.status >= 500) serverErrors.add(1);
  return res;
}

function req(method, path, name, body, token, responseCallback) {
  const params = jsonHeaders(token);
  params.tags = { name };
  if (responseCallback) params.responseCallback = responseCallback;
  const payload = body === undefined ? null : JSON.stringify(body);
  return record(http.request(method, `${API}${path}`, payload, params));
}

function register(email) {
  const res = req('POST', '/auth/register', 'register',
    { email, password: PASSWORD, platform: 'ios' }, null, OK);
  registerDuration.add(res.timings.duration);
  return res;
}

function login(email) {
  const res = record(http.post(
    `${API}/auth/login`,
    { username: email, password: PASSWORD },   // form-encoded, not JSON
    { tags: { name: 'login' }, responseCallback: OK },
  ));
  loginDuration.add(res.timings.duration);
  return res;
}

// Stable-ish Denver-area coordinates, jittered so reports spread across the map.
function jitter(base, spread) {
  return +(base + (Math.random() - 0.5) * spread).toFixed(5);
}

function addPharmacy(token, i) {
  return req('POST', '/pharmacies/', 'pharmacy_create', {
    name: `Load Pharmacy ${i}`,
    phone: '555-0100',
    address: null,          // no address + coordinates given => no Google geocode call
    latitude: jitter(39.7392, 0.2),
    longitude: jitter(-104.9903, 0.2),
    zip_code: '80202',
  }, token);
}

function browse(token) {
  group('browse', () => {
    const ph = req('GET', '/pharmacies/?medication_name=Adderall&strength=20mg&sort_by=proximity&lat=39.74&lng=-104.99',
      'pharmacies', undefined, token);
    pharmaciesDuration.add(ph.timings.duration);
    check(ph, { 'pharmacies 200': (r) => r.status === 200 });

    const map = req('GET', '/availability/map?sources=community,fda,ashp,my_logs&lat=39.74&lng=-104.99&radius_miles=25&medication_name=Adderall',
      'map', undefined, token);
    mapDuration.add(map.timings.duration);
    check(map, { 'map 200': (r) => r.status === 200 });

    const sh = req('GET', '/availability/shortage-status?medication_name=Adderall', 'shortage', undefined, token);
    check(sh, { 'shortage 200': (r) => r.status === 200 });
  });
}

function submitReport(token) {
  const res = req('POST', '/availability/report', 'report_create', {
    pharmacy_name: 'Load Pharmacy',
    pharmacy_address: '1 Test St',
    latitude: jitter(39.7392, 0.2),
    longitude: jitter(-104.9903, 0.2),
    zip_code: '80202',
    medication_name: 'Adderall',
    strength: '20mg',
    status: Math.random() < 0.4 ? 'in_stock' : 'out_of_stock',
  }, token, OK_OR_THROTTLED);
  // 429 here is the per-account 60s throttle (expected for returning users who
  // reported recently); it is intentionally not counted as limiter collapse.
  check(res, { 'report 201 or throttled': (r) => r.status === 201 || r.status === 429 });
  return res;
}

function logCall(token, pharmacyId) {
  const res = req('POST', '/calls/', 'call_create', {
    pharmacy_id: pharmacyId,
    status: Math.random() < 0.4 ? 'in_stock' : 'out_of_stock',
    contribute_to_community: false,
    medication_name: 'Adderall',
    strength: '20mg',
  }, token);
  check(res, { 'call 201': (r) => r.status === 201 });
}

// ---- setup: pre-register the returning-user pool --------------------------

export function setup() {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const email = `lt-pool-${RUN_ID}-${i}@loadtest.example.com`;
    const res = register(email);
    if (res.status === 429) {
      throw new Error(
        `Setup hit 429 after ${pool.length} users: the register limiter (10/hour per IP) is on. ` +
        'Start the target with LOADTEST_DISABLE_LIMITER=1, or lower POOL_SIZE.');
    }
    if (res.status !== 201) throw new Error(`Setup register failed: ${res.status} ${res.body}`);
    const token = res.json('access_token');
    const ph = addPharmacy(token, 0);
    pool.push({ email, pharmacyId: ph.status === 201 ? ph.json('id') : null });
  }
  return { pool };
}

// ---- scenarios -------------------------------------------------------------

// First session for a brand-new user: signup, add pharmacies, browse, report.
export function newUserSession() {
  const n = exec.scenario.iterationInTest;
  const email = `lt-new-${RUN_ID}-${n}@loadtest.example.com`;

  const reg = register(email);
  if (!check(reg, { 'register 201': (r) => r.status === 201 })) return;
  const token = reg.json('access_token');
  sleep(1);

  req('GET', '/users/me', 'me', undefined, token);

  const ids = [];
  for (let i = 1; i <= 2; i++) {
    const ph = addPharmacy(token, i);
    check(ph, { 'pharmacy 201': (r) => r.status === 201 });
    if (ph.status === 201) ids.push(ph.json('id'));
  }

  if (INCLUDE_NEARBY) {
    const nb = req('GET', '/pharmacies/nearby?lat=39.74&lng=-104.99', 'nearby', undefined, token);
    check(nb, { 'nearby 200': (r) => r.status === 200 });
  }

  sleep(1);
  browse(token);
  req('GET', '/scripts/?tone=polite&medication_name=Adderall&strength=20mg', 'script', undefined, token);

  if (ids.length) logCall(token, ids[0]);
  if (Math.random() < 0.5) submitReport(token);   // contributing unlocks the community map
  sleep(1);
  browse(token);
}

// Returning user opens the app: login, refresh, browse, sometimes report.
export function returningSession(data) {
  const u = data.pool[Math.floor(Math.random() * data.pool.length)];
  const lg = login(u.email);
  if (!check(lg, { 'login 200': (r) => r.status === 200 })) return;
  const token = lg.json('access_token');

  req('POST', '/auth/refresh', 'refresh', undefined, token);
  req('GET', '/users/me', 'me', undefined, token);
  sleep(1);
  browse(token);
  req('GET', '/calls/?limit=20', 'calls_list', undefined, token);

  if (Math.random() < 0.3) submitReport(token);
  if (u.pharmacyId && Math.random() < 0.3) logCall(token, u.pharmacyId);
  sleep(1);
  browse(token);
}
