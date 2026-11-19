import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

test('runner reports blocked, passing and failing API responses without leaking credentials', async () => {
  let mode = 'blocked', calls = 0;
  const server = createServer((req,res) => {
    calls++;
    const health = req.url === '/api/health.php';
    const fail = mode === 'blocked' || (mode === 'failed' && calls > 6);
    if (!health) assert.equal(req.headers.authorization, 'Bearer fixture-secret');
    res.writeHead(fail ? 500 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: !fail, data: [] }));
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  try {
    for (mode of ['blocked','passed','failed']) {
      calls = 0;
      const output = `artifacts/load-test/runner-validation-${mode}`;
      const child = spawn(process.execPath, ['scripts/pos-load-test.mjs', `--url=http://127.0.0.1:${server.address().port}`, '--stages=2', '--seconds=0.3', '--pause=100', '--stores=cafe', `--output=${output}`], { env: { ...process.env, LOAD_TEST_ACCOUNTS: '', LOAD_TEST_TOKEN: 'fixture-secret' }, stdio: 'ignore' });
      const code = await new Promise((r,j) => { child.on('exit',r); child.on('error',j); });
      const raw = await readFile(`${output}/report.json`,'utf8');
      const report = JSON.parse(raw);
      assert.equal(report.status,mode);
      assert.equal(code,mode === 'passed' ? 0 : mode === 'blocked' ? 2 : 1);
      assert.ok(!raw.includes('fixture-secret'));
      if (mode === 'blocked') assert.equal(calls,1);
      else assert.ok(report.stages[0].requests > 0);
    }
  } finally { await new Promise(r => server.close(r)); }
});
