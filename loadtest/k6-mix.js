// MedScout API load test. Three scenarios, chosen with SCENARIO:
//
//   capacity     (default) ~30 req/s mix of signups and returning users. Start the server with
//                LOADTEST_DISABLE_LIMITER=1: this measures the app, not the limiter.
//   limiter      the same mix with the limiter ON, every session presenting its own client
//                address, plus one abusive client that must get 429s without hurting anyone else.
//   slow_google  steady /pharmacies/nearby load while the mock Google goes slow; /health and
//                login must stay fast and nearby must degrade to 503, never 500.
//
//   BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
//   SCENARIO=limiter     BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
//   SCENARIO=slow_google BASE_URL=http://127.0.0.1:8001 MOCK_CONTROL_URL=http://127.0.0.1:8002 k6 run loadtest/k6-mix.js
//
// BASE_URL is required and has no default. Production is refused unless ALLOW_PROD=1 (don't).
// Never run this against a target that has real LOOPS / GOOGLE / SENTRY / APPLE settings
// (loadtest/local_server.py blanks them and keeps every outbound call on the machine).
//
// Common env:
//   PEAK_SIGNUPS_PER_SEC   3     new-user sessions at peak          (capacity, limiter)
//   PEAK_RETURNING_PER_SEC 3     returning-user sessions at peak    (capacity, limiter)
//   POOL_SIZE              60    pre-registered users (slow_google: 150)
//   HOLD                   5m    time at peak
//   INCLUDE_NEARBY         0     1 = new users also call /pharmacies/nearby (needs the mock)
//   RUN_ID                 epoch keeps emails unique across runs
//   SIM_CLIENTS            1 for a loopback BASE_URL, else 0
//                          1 = every session sends X-Forwarded-For: <its own address>. This only
//                          works against local_server.py (see README, "What the limiter sees").
// Remote targets:
//   HOST_HEADER            send this Host header (e.g. api.getmedscout.com when BASE_URL is an IP)
//   DIRECT_IP              resolve BASE_URL's hostname to this IP (correct SNI + Host, normal cert)
//   INSECURE_TLS=1         skip TLS verification (same as k6's --insecure-skip-tls-verify)
// limiter:
//   ABUSER                 1     include the abusive client (needs SIM_CLIENTS=1)
//   ABUSER_RPS             3
// slow_google:
//   NEARBY_RPS             4     steady rate on /pharmacies/nearby
//   DURATION               4m
//   SLOW_AT                60    seconds after start when the mock goes slow (needs MOCK_CONTROL_URL)
//   SLOW_SECONDS           90
//   SLOW_LATENCY_MS        4000
//   MOCK_CONTROL_URL       e.g. http://127.0.0.1:8002 (mock_upstreams.py); omit if the mock was
//                          started with its own MOCK_SLOW_START/MOCK_SLOW_SECONDS

import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) {
  throw new Error('BASE_URL is required, e.g. BASE_URL=http://127.0.0.1:8001');
}
const PROD = /getmedscout\.com/i;
if ((PROD.test(BASE_URL) || PROD.test(__ENV.HOST_HEADER || '')) && __ENV.ALLOW_PROD !== '1') {
  throw new Error('Refusing to load-test production. Point BASE_URL at a local or staging copy.');
}

const SCENARIO = __ENV.SCENARIO || 'capacity';
if (!['capacity', 'limiter', 'slow_google'].includes(SCENARIO)) {
  throw new Error(`Unknown SCENARIO ${SCENARIO}: use capacity, limiter or slow_google`);
}

const API = `${BASE_URL}/api/v1`;
const HOSTNAME = BASE_URL.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
const IS_LOOPBACK = /^(127\.|localhost$|\[?::1\]?$)/.test(HOSTNAME);
const SIM_CLIENTS = (__ENV.SIM_CLIENTS !== undefined ? __ENV.SIM_CLIENTS : (IS_LOOPBACK ? '1' : '0')) === '1';
const HOST_HEADER = __ENV.HOST_HEADER || '';
const RUN_ID = __ENV.RUN_ID || String(Math.floor(Date.now() / 1000));
// Password for the throwaway accounts this run creates. Generated fresh in setup() (or taken
// from LOADTEST_PASSWORD) and handed to every session through setup data, so no fixed
// password is ever committed or shared between runs.
function makeRunPassword() {
  if (__ENV.LOADTEST_PASSWORD) return __ENV.LOADTEST_PASSWORD;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = 'lt-';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
const POOL_SIZE = parseInt(__ENV.POOL_SIZE || (SCENARIO === 'slow_google' ? '150' : '60'), 10);
const PEAK_SIGNUPS = parseInt(__ENV.PEAK_SIGNUPS_PER_SEC || '3', 10);
const PEAK_RETURNING = parseInt(__ENV.PEAK_RETURNING_PER_SEC || '3', 10);
const HOLD = __ENV.HOLD || '5m';
function seconds(d) {   // '90s' | '5m' -> seconds
  const m = /^(\d+)([sm])$/.exec(d);
  if (!m) throw new Error(`bad duration ${d}: use e.g. 90s or 5m`);
  return parseInt(m[1], 10) * (m[2] === 'm' ? 60 : 1);
}
const INCLUDE_NEARBY = __ENV.INCLUDE_NEARBY === '1';
const ABUSER = (__ENV.ABUSER || '1') === '1' && SIM_CLIENTS;
const ABUSER_RPS = parseInt(__ENV.ABUSER_RPS || '3', 10);
const NEARBY_RPS = parseInt(__ENV.NEARBY_RPS || '4', 10);
const DURATION = __ENV.DURATION || '4m';
const SLOW_AT = parseInt(__ENV.SLOW_AT || '60', 10);
const SLOW_SECONDS = parseInt(__ENV.SLOW_SECONDS || '90', 10);
const SLOW_LATENCY_MS = parseInt(__ENV.SLOW_LATENCY_MS || '4000', 10);
const MOCK_CONTROL_URL = (__ENV.MOCK_CONTROL_URL || '').replace(/\/+$/, '');

// Metrics beyond k6's defaults.
const rateLimited = new Rate('rate_limited');           // 429 where none was expected (tag who=legit|abuser)
const serverErrors = new Counter('server_errors');      // any 5xx except a deliberate nearby 503
const reportThrottled = new Counter('report_throttled'); // the expected per-account 60 s report throttle
const nearby503 = new Counter('nearby_503');            // guards/deadline tripped: the intended degradation
const nearbyBad = new Counter('nearby_bad');            // nearby answered anything but 200 or a proper 503
const nearby503NoRetryAfter = new Counter('nearby_503_without_retry_after');
const registerDuration = new Trend('register_duration', true);
const loginDuration = new Trend('login_duration', true);
const mapDuration = new Trend('map_duration', true);
const pharmaciesDuration = new Trend('pharmacies_duration', true);

// 4xx the test expects must not count toward http_req_failed.
const OK = http.expectedStatuses({ min: 200, max: 299 }, 409);
const OK_OR_429 = http.expectedStatuses({ min: 200, max: 299 }, 429);
const OK_NEARBY = http.expectedStatuses({ min: 200, max: 299 }, 503);
const ABUSER_OK = http.expectedStatuses({ min: 200, max: 299 }, 401, 429);

// ---- simulated client addresses ---------------------------------------------
// Each session claims its own address by sending X-Forwarded-For. local_server.py runs Uvicorn
// exactly like production (trusts 127.0.0.1, reads X-Forwarded-For), so the app's limiter sees
// this address as request.client.host. Different offsets keep scenarios from sharing addresses.
const OFFSET = { new: 0, returning: 1 << 20, setup: 2 << 20, nearby: 3 << 20, probe: 4 << 20 };
function simIp(n) {
  n = n % 16777216;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}
const ABUSER_IP = '203.0.113.200';

export const options = (() => {
  const thresholdsCommon = {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  };
  let scenarios, thresholds;
  const tail = [{ target: 0, duration: '1m' }];
  const ramp = (peak) => [
    { target: 1, duration: '1m' },
    { target: peak, duration: '2m' },
    { target: peak, duration: HOLD },
    ...tail,
  ];
  const mix = () => ({
    new_users: {
      executor: 'ramping-arrival-rate', exec: 'newUserSession', startRate: 0, timeUnit: '1s',
      preAllocatedVUs: 40, maxVUs: 200, stages: ramp(PEAK_SIGNUPS),
    },
    returning_users: {
      executor: 'ramping-arrival-rate', exec: 'returningSession', startRate: 0, timeUnit: '1s',
      preAllocatedVUs: 40, maxVUs: 200, stages: ramp(PEAK_RETURNING),
    },
  });

  if (SCENARIO === 'capacity') {
    scenarios = mix();
    thresholds = {
      ...thresholdsCommon,
      http_req_duration: ['p(95)<800', 'p(99)<2000'],
      'http_req_duration{name:register}': ['p(95)<1500'],
      'http_req_duration{name:login}': ['p(95)<1500'],
      'http_req_duration{name:map}': ['p(95)<800'],
      'http_req_duration{name:pharmacies}': ['p(95)<800'],
      rate_limited: ['rate<0.01'],
      server_errors: ['count==0'],
      dropped_iterations: ['count<1'],
    };
  } else if (SCENARIO === 'limiter') {
    scenarios = mix();
    if (ABUSER) {
      scenarios.abuser = {
        executor: 'constant-arrival-rate', exec: 'abuserSession', rate: ABUSER_RPS, timeUnit: '1s',
        duration: `${60 + 120 + seconds(HOLD) + 60}s`, preAllocatedVUs: 10, maxVUs: 50,
      };
    }
    thresholds = {
      ...thresholdsCommon,
      http_req_duration: ['p(95)<800', 'p(99)<2000'],
      'http_req_duration{name:register}': ['p(95)<1500'],
      'http_req_duration{name:login}': ['p(95)<1500'],
      // Real users (own address / own token) must never be limited ...
      'rate_limited{who:legit}': ['rate<0.01'],
      server_errors: ['count==0'],
      dropped_iterations: ['count<1'],
      ...(ABUSER ? { 'rate_limited{who:abuser}': ['rate>0.5'] } : {}),   // ... and the abuser must be.
    };
  } else {
    scenarios = {
      nearby_load: {
        executor: 'constant-arrival-rate', exec: 'nearbyLoad', rate: NEARBY_RPS, timeUnit: '1s',
        duration: DURATION, preAllocatedVUs: 40, maxVUs: 150,
      },
      probe_health: {
        executor: 'constant-arrival-rate', exec: 'probeHealth', rate: 2, timeUnit: '1s',
        duration: DURATION, preAllocatedVUs: 5, maxVUs: 30,
      },
      probe_login: {
        executor: 'constant-arrival-rate', exec: 'probeLogin', rate: 1, timeUnit: '1s',
        duration: DURATION, preAllocatedVUs: 5, maxVUs: 30,
      },
    };
    if (MOCK_CONTROL_URL) {
      scenarios.trigger_slow = {
        executor: 'per-vu-iterations', exec: 'triggerSlow', vus: 1, iterations: 1, startTime: `${SLOW_AT}s`, maxDuration: '30s',
      };
    }
    thresholds = {
      ...thresholdsCommon,
      'http_req_duration{name:health}': ['p(95)<1000'],     // the API stays responsive ...
      'http_req_duration{name:login}': ['p(95)<1000'],
      nearby_bad: ['count==0'],                              // ... nearby only ever answers 200 or 503, never 500/429/other
      nearby_503_without_retry_after: ['count==0'],
      server_errors: ['count==0'],
      nearby_503: ['count>0'],                               // ... and the guards really tripped
      dropped_iterations: ['count<1'],
    };
  }

  const opts = { scenarios, thresholds, setupTimeout: '10m' };
  if (__ENV.DIRECT_IP) opts.hosts = { [HOSTNAME]: __ENV.DIRECT_IP };
  if (__ENV.INSECURE_TLS === '1') opts.insecureSkipTLSVerify = true;
  return opts;
})();

// ---- helpers ---------------------------------------------------------------

function headersFor(token, ip) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (SIM_CLIENTS && ip) h['X-Forwarded-For'] = ip;
  if (HOST_HEADER) h.Host = HOST_HEADER;
  return h;
}

// opts: { ip, cb (expected-status callback), who, throttleExpected }
function req(method, path, name, body, token, opts = {}) {
  const params = { headers: headersFor(token, opts.ip), tags: { name } };
  if (opts.cb) params.responseCallback = opts.cb;
  if (opts.who) params.tags.who = opts.who;
  const payload = body === undefined ? null : JSON.stringify(body);
  return record(http.request(method, `${API}${path}`, payload, params), opts);
}

function record(res, opts = {}) {
  const who = opts.who || 'legit';
  if (res.status === 429) {
    if (opts.throttleExpected) reportThrottled.add(1);
    else rateLimited.add(true, { who });
  } else {
    rateLimited.add(false, { who });
  }
  if (res.status >= 500 && !opts.nearby) serverErrors.add(1);
  return res;
}

function register(email, ip, password) {
  const res = req('POST', '/auth/register', 'register', { email, password, platform: 'ios' }, null, { ip, cb: OK });
  registerDuration.add(res.timings.duration);
  return res;
}

function login(email, ip, password, extra = {}) {
  const params = { headers: headersFor(null, ip), tags: { name: 'login', ...(extra.tags || {}) }, responseCallback: extra.cb || OK };
  delete params.headers['Content-Type'];            // login is form-encoded: let k6 set it
  const res = record(http.post(`${API}/auth/login`, { username: email, password }, params), extra);
  loginDuration.add(res.timings.duration);
  return res;
}

// Denver-area coordinates, jittered so reports spread across the map.
function jitter(base, spread) {
  return +(base + (Math.random() - 0.5) * spread).toFixed(5);
}

function addPharmacy(token, i, ip) {
  return req('POST', '/pharmacies/', 'pharmacy_create', {
    name: `Load Pharmacy ${i}`,
    phone: '555-0100',
    address: null,          // no address + coordinates given => no geocode call
    latitude: jitter(39.7392, 0.2),
    longitude: jitter(-104.9903, 0.2),
    zip_code: '80202',
  }, token, { ip });
}

function browse(token, ip) {
  group('browse', () => {
    const ph = req('GET', '/pharmacies/?medication_name=Adderall&strength=20mg&sort_by=proximity&lat=39.74&lng=-104.99',
      'pharmacies', undefined, token, { ip });
    pharmaciesDuration.add(ph.timings.duration);
    check(ph, { 'pharmacies 200': (r) => r.status === 200 });

    const map = req('GET', '/availability/map?sources=community,fda,ashp,my_logs&lat=39.74&lng=-104.99&radius_miles=25&medication_name=Adderall',
      'map', undefined, token, { ip });
    mapDuration.add(map.timings.duration);
    check(map, { 'map 200': (r) => r.status === 200 });

    const sh = req('GET', '/availability/shortage-status?medication_name=Adderall', 'shortage', undefined, token, { ip });
    check(sh, { 'shortage 200': (r) => r.status === 200 });
  });
}

function submitReport(token, ip) {
  const res = req('POST', '/availability/report', 'report_create', {
    pharmacy_name: 'Load Pharmacy',
    pharmacy_address: '1 Test St',
    latitude: jitter(39.7392, 0.2),
    longitude: jitter(-104.9903, 0.2),
    zip_code: '80202',
    medication_name: 'Adderall',
    strength: '20mg',
    status: Math.random() < 0.4 ? 'in_stock' : 'out_of_stock',
  }, token, { ip, cb: OK_OR_429, throttleExpected: true });
  // 429 here is the per-account 60 s throttle, expected for returning users who reported recently.
  check(res, { 'report 201 or throttled': (r) => r.status === 201 || r.status === 429 });
  return res;
}

function logCall(token, pharmacyId, ip) {
  const res = req('POST', '/calls/', 'call_create', {
    pharmacy_id: pharmacyId,
    status: Math.random() < 0.4 ? 'in_stock' : 'out_of_stock',
    contribute_to_community: false,
    medication_name: 'Adderall',
    strength: '20mg',
  }, token, { ip });
  check(res, { 'call 201': (r) => r.status === 201 });
}

// ---- setup: pre-register the user pool ---------------------------------------------------

export function setup() {
  const password = makeRunPassword();
  const pool = [];
  const withPharmacy = SCENARIO !== 'slow_google';
  for (let i = 0; i < POOL_SIZE; i++) {
    const email = `lt-pool-${RUN_ID}-${i}@loadtest.example.com`;
    const res = register(email, simIp(OFFSET.setup + i), password);
    if (res.status === 429) {
      throw new Error(
        `Setup hit 429 after ${pool.length} users: register is limited per client address. ` +
        'Use a loopback target with SIM_CLIENTS=1, start the server with LOADTEST_DISABLE_LIMITER=1, or lower POOL_SIZE.');
    }
    if (res.status !== 201) throw new Error(`Setup register failed: ${res.status} ${res.body}`);
    const token = res.json('access_token');
    let pharmacyId = null;
    if (withPharmacy) {
      const ph = addPharmacy(token, 0, simIp(OFFSET.setup + i));
      pharmacyId = ph.status === 201 ? ph.json('id') : null;
    }
    pool.push({ email, token, pharmacyId });
  }
  return { pool, password };
}

// ---- mix scenarios (capacity, limiter) ----------------------------------------------------

// First session for a brand-new user: signup, add pharmacies, browse, report.
export function newUserSession(data) {
  const n = exec.scenario.iterationInTest;
  const ip = simIp(OFFSET.new + n);
  const email = `lt-new-${RUN_ID}-${n}@loadtest.example.com`;

  const reg = register(email, ip, data.password);
  if (!check(reg, { 'register 201': (r) => r.status === 201 })) return;
  const token = reg.json('access_token');
  sleep(1);

  req('GET', '/users/me', 'me', undefined, token, { ip });

  const ids = [];
  for (let i = 1; i <= 2; i++) {
    const ph = addPharmacy(token, i, ip);
    check(ph, { 'pharmacy 201': (r) => r.status === 201 });
    if (ph.status === 201) ids.push(ph.json('id'));
  }

  if (INCLUDE_NEARBY) {
    const nb = req('GET', `/pharmacies/nearby?lat=${jitter(39.74, 0.4)}&lng=${jitter(-104.99, 0.4)}`, 'nearby', undefined, token,
      { ip, cb: OK_NEARBY, nearby: true });
    check(nb, { 'nearby 200': (r) => r.status === 200 });
  }

  sleep(1);
  browse(token, ip);
  req('GET', '/scripts/?tone=polite&medication_name=Adderall&strength=20mg', 'script', undefined, token, { ip });

  if (ids.length) logCall(token, ids[0], ip);
  if (Math.random() < 0.5) submitReport(token, ip);   // contributing unlocks the community map
  sleep(1);
  browse(token, ip);
}

// Returning user opens the app: login, refresh, browse, sometimes report.
export function returningSession(data) {
  const n = exec.scenario.iterationInTest;
  const ip = simIp(OFFSET.returning + n);
  const u = data.pool[Math.floor(Math.random() * data.pool.length)];
  const lg = login(u.email, ip, data.password);
  if (!check(lg, { 'login 200': (r) => r.status === 200 })) return;
  const token = lg.json('access_token');

  req('POST', '/auth/refresh', 'refresh', undefined, token, { ip });
  req('GET', '/users/me', 'me', undefined, token, { ip });
  sleep(1);
  browse(token, ip);
  req('GET', '/calls/?limit=20', 'calls_list', undefined, token, { ip });

  if (Math.random() < 0.3) submitReport(token, ip);
  if (u.pharmacyId && Math.random() < 0.3) logCall(token, u.pharmacyId, ip);
  sleep(1);
  browse(token, ip);
}

// One abusive client at a fixed address: signup spam and password guessing. After its allowance
// (register 60/h, login 10/min, failed-login guard) every request must be a 429, while the legit
// sessions above, each with their own address, are never touched.
export function abuserSession(data) {
  const n = exec.scenario.iterationInTest;
  if (n % 2 === 0) {
    const res = req('POST', '/auth/register', 'abuser_register',
      { email: `lt-abuse-${RUN_ID}-${n}@loadtest.example.com`, password: data.password, platform: 'ios' },
      null, { ip: ABUSER_IP, who: 'abuser', cb: ABUSER_OK });
    check(res, { 'abuser register 201 or 429': (r) => r.status === 201 || r.status === 429 });
  } else {
    const victim = data.pool[0].email;
    const res = login(victim, ABUSER_IP, 'wrong-password', { who: 'abuser', cb: ABUSER_OK, tags: { who: 'abuser', name: 'abuser_login' } });
    check(res, { 'abuser login 401 or 429': (r) => r.status === 401 || r.status === 429 });
  }
}

// ---- slow_google scenario -----------------------------------------------------------------

// Steady nearby load. Each request asks for a different grid cell so every one needs its own
// Google call (nothing to coalesce), and comes from a different user and address so no per-user
// or per-address limit gets in the way: what is being exercised is the Places guards.
export function nearbyLoad(data) {
  const n = exec.scenario.iterationInTest;
  const u = data.pool[n % data.pool.length];
  const ip = simIp(OFFSET.nearby + n);
  const lat = (30 + (n % 400) * 0.01).toFixed(4);
  const lng = (-100 - Math.floor(n / 400) * 0.01).toFixed(4);
  const res = req('GET', `/pharmacies/nearby?lat=${lat}&lng=${lng}`, 'nearby', undefined, u.token,
    { ip, cb: OK_NEARBY, nearby: true });
  if (res.status === 200) return;
  if (res.status === 503) {
    nearby503.add(1);
    if (!res.headers['Retry-After'] && !res.headers['retry-after']) nearby503NoRetryAfter.add(1);
    check(res, { 'nearby 503 has a friendly detail': (r) => typeof r.json('detail') === 'string' });
  } else {
    nearbyBad.add(1);
    console.error(`nearby answered ${res.status}: ${String(res.body).slice(0, 200)}`);
  }
}

export function probeHealth() {
  // /health is unauthenticated and does no I/O
  const params = { headers: headersFor(null, null), tags: { name: 'health' } };
  const res = http.get(`${BASE_URL}/health`, params);
  check(res, { 'health 200': (r) => r.status === 200 });
}

export function probeLogin(data) {
  const n = exec.scenario.iterationInTest;
  const u = data.pool[n % data.pool.length];
  const lg = login(u.email, simIp(OFFSET.probe + n), data.password);
  check(lg, { 'probe login 200': (r) => r.status === 200 });
}

export function triggerSlow() {
  const url = `${MOCK_CONTROL_URL}/__control/slow?latency_ms=${SLOW_LATENCY_MS}&seconds=${SLOW_SECONDS}`;
  const res = http.get(url, { tags: { name: 'mock_control' } });
  check(res, { 'mock slow window opened': (r) => r.status === 200 });
  console.log(`mock Google slow window opened: ${SLOW_LATENCY_MS} ms for ${SLOW_SECONDS} s`);
}
