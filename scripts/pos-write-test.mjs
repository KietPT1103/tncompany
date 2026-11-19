import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://tnservice.vn';
const storeId = 'store_5dd84056c279f9af40c3d0d6';
const path = '/api/pos.php?resource=live-orders&storeId=' + storeId;
const prefix = 'LOAD-' + randomUUID().slice(0, 12);
const output = 'artifacts/load-test/production-test-store-writes';
const report = { origin, storeId, prefix, stages: [] };
let token;
async function request(url, method = 'GET', body) {
  const response = await fetch(origin + url, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error(method + ' HTTP ' + response.status);
  const json = await response.json();
  if (!json.ok) throw Error(method + ' API error');
  return json.data;
}
const list = async () => {
  const data = await request(path);
  if (!Array.isArray(data?.items)) throw Error('Unexpected list response');
  return data.items.filter(item => item.orderKey.startsWith(prefix + '-'));
};
const remove = key => request(path + '&orderKey=' + encodeURIComponent(key), 'DELETE');
let keys = [];
try {
  const session = await request('/api/auth.php?action=login', 'POST', {
    login: process.env.POS_TEST_LOGIN, password: process.env.POS_TEST_PASSWORD,
  });
  token = session.token;
  const stores = await request('/api/stores.php');
  if (!stores.items.some(store => store.id === storeId && store.name.trim().toLowerCase() === 'test')) throw Error('Test store not verified');
  if ((await list()).length) throw Error('Test keys already exist');
  for (const count of [1, 5, 10, 20, 50]) {
    keys = Array.from({ length: count }, (_, i) => prefix + '-' + count + '-' + i);
    const stage = { count, operations: {} };
    report.stages.push(stage);
    for (const [operation, quantity] of [['create', 1], ['update', 2], ['delete', 0]]) {
      const results = await Promise.all(keys.map(async key => {
        const start = performance.now();
        try {
          if (quantity) await request(path, 'PUT', { storeId, orderKey: key,
            items: [{ menuId: 'load-test', name: 'Load test', quantity, price: 0 }] });
          else await remove(key);
          return { ms: performance.now() - start };
        } catch (error) { return { ms: performance.now() - start, error: error.message }; }
      }));
      const times = results.map(r => r.ms).sort((a, b) => a - b);
      const errors = results.flatMap(r => r.error ? [r.error] : []);
      const orders = await list();
      const verified = quantity ? orders.length === count && keys.every(key => orders.some(o =>
        o.orderKey === key && o.items.length === 1 && o.items[0].quantity === quantity)) : orders.length === 0;
      const p95Ms = Math.round(times[Math.ceil(count * 0.95) - 1]);
      stage.operations[operation] = { p95Ms, errors, verified };
      if (!verified || errors.length || p95Ms > 2000) throw Error('Stopped at ' + count + ' users / ' + operation);
    }
    keys = [];
    console.log('Passed ' + count + ' concurrent users');
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.reason = error.message;
} finally {
  if (keys.length) {
    try {
      for (const order of await list()) if (keys.includes(order.orderKey)) await remove(order.orderKey);
      report.remaining = (await list()).length;
    } catch { report.remaining = 'unverified'; }
  } else if (report.status === 'passed') report.remaining = 0;
  await mkdir(output, { recursive: true });
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
