import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// No dependencies; configuration and credentials never enter the report.
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=') || 'true'];
}));
const base = new URL(options.url || 'http://127.0.0.1:8000');
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw Error('Invalid URL');
const stages = (options.stages || '5,10,20,50').split(',').map(Number);
const seconds = Number(options.seconds || 30);
const pause = Number(options.pause || 1000);
if (stages.some(n => !Number.isInteger(n) || n < 1 || n > 200) || !stages.length || !(seconds > 0 && seconds <= 1800) || !(pause >= 100 && pause <= 60000)) throw Error('Invalid stages/seconds/pause');
const accounts = process.env.LOAD_TEST_ACCOUNTS ? JSON.parse(process.env.LOAD_TEST_ACCOUNTS) : [];
const stores = (options.stores || 'cafe,restaurant').split(',');
const output = resolve(options.output || `artifacts/load-test/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const report = {
  startedAt: new Date().toISOString(), target: base.origin, status: 'blocked',
  configuration: { stages, seconds, pauseMs: pause, stores, accounts: accounts.length, sharedSessions: true },
  scenario: 'Authenticated POS reads; no checkout, printing or stock deductions',
  limitations: ['API test, not browser/rendering test', 'No payment, stock correctness or printer verification', ...( ['localhost','127.0.0.1','[::1]'].includes(base.hostname) ? ['Local PHP development server is single-threaded on Windows; results do not establish production capacity'] : ['Short bounded workload; does not establish maximum production capacity']), 'Existing GET handlers may initialize schema/default records', 'Simulated clients reuse the supplied authenticated sessions'],
  thresholds: { p95Ms: 2000, maxErrorRate: 0.01 }, preflight: [], stages: [],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function request(path, token, payload) {
  const start = performance.now();
  try {
    const r = await fetch(new URL(path, base), {
      method: payload ? 'POST' : 'GET', redirect: 'error',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    let json;
    try { json = await r.json(); } catch { /* HTML errors are failures too. */ }
    return { ok: r.ok && json?.ok === true, status: r.status, ms: performance.now() - start, data: json?.data };
  } catch { return { ok: false, status: 0, ms: performance.now() - start }; }
}
function summary(samples) {
  const times = samples.map(s => s.ms).sort((a,b) => a-b);
  const errors = samples.filter(s => !s.ok).length;
  const percentile = p => times.length ? Math.round(times[Math.max(0, Math.ceil(times.length*p)-1)]) : null;
  return { requests: samples.length, errors, errorRate: samples.length ? errors / samples.length : 1, p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: times.length ? Math.round(times.at(-1)) : null,
    statuses: samples.reduce((out,s) => ({ ...out, [s.status]: (out[s.status] || 0)+1 }), {}) };
}
async function run() {
  const health = await request('/api/health.php');
  report.preflight.push({ check: 'database', ok: health.ok, status: health.status });
  if (!health.ok) { report.reason = 'Database/API health check failed. No load was sent.'; return; }
  const identities = [];
  if (process.env.LOAD_TEST_TOKEN) identities.push({ token: process.env.LOAD_TEST_TOKEN });
  for (const account of accounts) {
    const login = await request('/api/auth.php?action=login', null, { login: account.username, password: account.password });
    if (!login.ok || !login.data?.token) { report.reason = 'Test account login failed'; return; }
    identities.push({ token: login.data.token, store: account.storeId });
  }
  if (!identities.length) { report.reason = 'Set LOAD_TEST_ACCOUNTS or LOAD_TEST_TOKEN for authorized test users'; return; }
  const routes = ['tables','surcharges','bills','shifts','live-orders'];
  const clients = Array.from({ length: Math.max(...stages) }, (_,i) => {
    const identity = identities[i % identities.length];
    return { ...identity, store: identity.store || stores[i % stores.length] };
  });
  const pathFor = (route, client) => `/api/pos.php?resource=${route}&storeId=${encodeURIComponent(client.store)}&limit=20`;
  for (const client of clients.slice(0, Math.max(identities.length, stores.length))) {
    for (const route of routes) {
      const r = await request(pathFor(route, client), client.token);
      report.preflight.push({ check: `${client.store}/${route}`, ok: r.ok, status: r.status });
      if (!r.ok) { report.reason = 'POS route/auth preflight failed. No load was sent.'; return; }
    }
  }
  for (const count of stages) {
    console.log(`Testing ${count} counters for ${seconds}s...`);
    const start = performance.now(), end = start + seconds*1000, samples = [];
    await Promise.all(clients.slice(0,count).map(async client => {
      let cursor = 0;
      while (performance.now() < end) {
        const route = routes[cursor++ % routes.length];
        samples.push({ ...await request(pathFor(route, client), client.token), route });
        if (performance.now() < end) await sleep(pause);
      }
    }));
    const stats = summary(samples);
    const stage = { counters: count, elapsedSeconds: +( (performance.now()-start)/1000).toFixed(2), ...stats,
      byRoute: Object.fromEntries(routes.map(route => [route, summary(samples.filter(s => s.route===route))])) };
    stage.requestsPerSecond = +(stage.requests / stage.elapsedSeconds).toFixed(2);
    stage.pass = stage.requests > 0 && stage.p95Ms <= report.thresholds.p95Ms && stage.errorRate <= report.thresholds.maxErrorRate;
    report.stages.push(stage);
    if (!stage.pass) { report.reason = 'Stopped at first failing stage to limit load'; break; }
  }
  report.status = report.stages.every(s => s.pass) ? 'passed' : 'failed';
}
try { await run(); } catch { report.reason = 'Unexpected runner/configuration error; inspect configuration locally'; }
report.finishedAt = new Date().toISOString();
await mkdir(output, { recursive: true });
await writeFile(resolve(output,'report.json'), JSON.stringify(report,null,2));
const lines = ['# POS load test', '', `Status: **${report.status}**`, `Target: ${report.target}`, `Started: ${report.startedAt}`, '', report.reason || '', '', report.scenario, '', '| Counters | Requests | Errors | p95 ms | Req/s | Result |', '|---|---|---|---|---|---|', ...report.stages.map(s => `| ${s.counters} | ${s.requests} | ${s.errors} | ${s.p95Ms} | ${s.requestsPerSecond} | ${s.pass ? 'PASS' : 'FAIL'} |`), '', '## Limits', ...report.limitations.map(s => `- ${s}`), '', '## Preflight', ...report.preflight.map(s => `- ${s.check}: ${s.ok ? 'PASS' : 'FAIL'} (HTTP ${s.status})`)];
await writeFile(resolve(output,'report.md'), lines.join('\n')+'\n');
console.log(`Result: ${report.status}. Report: ${resolve(output,'report.md')}`);
process.exitCode = report.status === 'passed' ? 0 : report.status === 'blocked' ? 2 : 1;
