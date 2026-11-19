// Run after starting QueueLifecycleLiveApiTest with -Dqueue.browser.hold=true.
// Usage: node scripts/verify-queue-browser.cjs <frontend-directory>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('../.tools/browser/node_modules/playwright');

const frontend = path.resolve(process.argv[2] || '');
const fixturePath = path.resolve('target/queue-browser-fixture.json');
const donePath = path.resolve('target/queue-browser.done');
const artifacts = path.resolve('target/queue-browser');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
let browser, vite, page, fixture;
const pass = message => { checks.push(message); console.log('PASS: ' + message); };

(async () => {
  assert.ok(fs.existsSync(path.join(frontend, 'node_modules/vite/bin/vite.js')), 'Frontend dependencies must be installed');
  for (let i = 0; !fs.existsSync(fixturePath) && i < 180; i++) await sleep(2000);
  assert.ok(fs.existsSync(fixturePath), 'Live browser fixture must be ready');
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fs.mkdirSync(artifacts, { recursive: true });
  vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
    cwd: frontend, windowsHide: true, env: { ...process.env, VITE_API_BASE_URL: fixture.baseUrl }, stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://localhost:5180')).ok) break; } catch {}
    if (i === 59) throw Error('Frontend server did not start');
    await sleep(1000);
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname);
  });
  await page.goto('http://localhost:5180/org/smoke-a/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Email/).fill(fixture.email);
  await page.getByLabel(/^Password/).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app', { waitUntil: 'domcontentloaded' });
  await page.goto('http://localhost:5180/app/queue', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Queue', exact: true }).waitFor();
  const row = token => page.getByRole('row').filter({ has: page.getByText('#' + token.tokenNumber, { exact: true }) });
  await row(fixture.priority).waitFor();
  await row(fixture.normal).waitFor();
  await row(fixture.cancellable).waitFor();
  pass('Nurse signs in through the UI and sees all three server-backed tokens');
  await page.screenshot({ path: path.join(artifacts, '01-queue-desktop.png'), fullPage: true });

  const apiGet = async suffix => page.evaluate(async ({ base, suffix }) => {
    const response = await fetch(base + suffix, { headers: {
      Authorization: 'Bearer ' + sessionStorage.getItem('ulwembu.tenantToken'),
      'X-Tenant-ID': sessionStorage.getItem('ulwembu.tenantSlug'),
      'X-Clinic-ID': sessionStorage.getItem('ulwembu.activeClinic'),
    } });
    if (!response.ok) throw Error('Read failed: ' + response.status);
    return response.json();
  }, { base: fixture.baseUrl, suffix });
  const baseline = (await apiGet('/api/v1/queue?facilityId=' + fixture.clinicId)).items[0].token;
  assert.equal(baseline.id, fixture.priority.id);

  const callNext = async () => {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/queue/call-next') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Call next patient', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    return (await response.json()).token;
  };
  const action = async (token, name) => {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/tokens/' + token.id + '/transition') && r.request().method() === 'POST'),
      row(token).getByRole('button', { name, exact: true }).click(),
    ]);
    assert.equal(response.status(), 200, name + ' must succeed');
    return response.json();
  };

  assert.equal((await callNext()).id, fixture.priority.id);
  await row(fixture.priority).getByRole('button', { name: 'Complete', exact: true }).waitFor();
  await action(fixture.priority, 'Stop');
  await row(fixture.priority).getByRole('button', { name: 'Resume', exact: true }).waitFor();
  assert.ok(!(await apiGet('/api/v1/queue?facilityId=' + fixture.clinicId)).items.some(e => e.token.id === fixture.priority.id));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await row(fixture.priority).getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, '02-stopped-after-reload.png'), fullPage: true });
  pass('Stop removes the token from the waiting queue; Resume remains available after reload');
  const resumed = await action(fixture.priority, 'Resume');
  for (const key of ['id', 'issuedAt', 'priority', 'tokenNumber']) assert.equal(resumed[key], baseline[key]);
  assert.equal((await callNext()).id, fixture.priority.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await row(fixture.priority).getByRole('button', { name: 'Complete', exact: true }).waitFor();
  pass('Resume preserves priority, persisted issue time and identity; called token survives reload');
  const completed = await action(fixture.priority, 'Complete');
  assert.ok(completed.completedAt);
  assert.equal(completed.status, 'COMPLETED');
  await row(fixture.priority).waitFor({ state: 'hidden' });
  await page.getByRole('status').filter({ hasText: 'Completed' }).waitFor();
  pass('Complete from Called records the timestamp and removes the token from the UI');
  assert.equal((await callNext()).id, fixture.normal.id);
  await action(fixture.normal, 'Start service');
  await row(fixture.normal).getByText('IN SERVICE', { exact: true }).waitFor();
  await action(fixture.normal, 'Complete');
  await row(fixture.normal).waitFor({ state: 'hidden' });
  pass('Called → In service → Completed works through the UI');

  await page.setViewportSize({ width: 390, height: 844 });
  const cancel = row(fixture.cancellable).getByRole('button', { name: 'Cancel token', exact: true });
  const mobileBounds = await cancel.boundingBox();
  assert.ok(mobileBounds && mobileBounds.x >= 0 && mobileBounds.x + mobileBounds.width <= 390,
    'Mobile cancellation must be reachable without horizontal scrolling');
  assert.equal(await cancel.isDisabled(), true);
  await row(fixture.cancellable).getByRole('combobox').selectOption('PATIENT_LEFT');
  assert.equal(await cancel.isEnabled(), true);
  await page.screenshot({ path: path.join(artifacts, '03-mobile-cancellation.png'), fullPage: true });
  const cancelled = await action(fixture.cancellable, 'Cancel token');
  assert.equal(cancelled.reasonCode, 'PATIENT_LEFT');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.ok(cancelled.cancelledAt);
  await row(fixture.cancellable).waitFor({ state: 'hidden' });
  await page.getByText('No one is waiting right now.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Call next patient', exact: true }).isDisabled(), true);
  pass('Mobile cancellation is visible without horizontal scrolling, requires a reason, and removes the token');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('No one is waiting right now.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, '04-empty-queue-mobile.png'), fullPage: true });
  assert.equal((await apiGet('/api/v1/queue/open?facilityId=' + fixture.clinicId)).items.length, 0);
  pass('Completed/cancelled tokens stay removed after reload; empty queue disables Call next');

  const login = await context.request.post(fixture.baseUrl + '/api/v1/auth/login', {
    headers: { 'X-Tenant-ID': fixture.tenant }, data: { email: 'admin@live.example', password: fixture.password },
  });
  assert.equal(login.status(), 200);
  const admin = (await login.json()).accessToken;
  const auditResponse = await context.request.get(fixture.baseUrl + '/api/v1/admin/audit', {
    headers: { Authorization: 'Bearer ' + admin, 'X-Tenant-ID': fixture.tenant, 'X-Clinic-ID': fixture.clinicId },
  });
  assert.equal(auditResponse.status(), 200);
  const audit = (await auditResponse.json()).items;
  for (const [token, event] of [[fixture.priority, 'QUEUE_TOKEN_STOPPED'], [fixture.priority, 'QUEUE_TOKEN_RESUMED'],
    [fixture.priority, 'QUEUE_TOKEN_COMPLETED'], [fixture.normal, 'QUEUE_TOKEN_SERVICE_STARTED'],
    [fixture.normal, 'QUEUE_TOKEN_COMPLETED'], [fixture.cancellable, 'QUEUE_TOKEN_CANCELLED']]) {
    assert.ok(audit.some(row => row.entityId === token.id && row.action === event && row.clinicContextId === fixture.clinicId), event);
  }
  const cancellation = audit.find(row => row.entityId === fixture.cancellable.id && row.action === 'QUEUE_TOKEN_CANCELLED');
  assert.equal(JSON.parse(cancellation.afterValue).reasonCode, 'PATIENT_LEFT');
  pass('Every browser lifecycle action is persisted in the audit log, including cancellation reason');
  assert.deepEqual(errors, []);
  pass('No JavaScript page errors or failed API responses');
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ status: 'PASS', checks, screenshots: fs.readdirSync(artifacts).filter(f => /^0[1-4]-.*\.png$/.test(f)) }, null, 2));
  fs.writeFileSync(donePath, 'PASS');
})().catch(async error => {
  console.error(error.message);
  if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  fs.mkdirSync(artifacts, { recursive: true });
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ status: 'FAIL', checks, error: error.message }, null, 2));
  if (fixture) fs.writeFileSync(donePath, 'FAIL');
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (vite) vite.kill();
});
