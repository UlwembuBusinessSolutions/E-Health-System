// Run while PrescriptionQueryLiveApiTest is holding with -Dprescription.query.browser.hold=true.
// Usage: node scripts/verify-prescription-query-browser.cjs <frontend-directory>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('../.tools/browser/node_modules/playwright');

const frontend = path.resolve(process.argv[2] || '');
const fixturePath = path.resolve('target/prescription-query-browser-fixture.json');
const donePath = path.resolve('target/prescription-query-browser.done');
const artifacts = path.resolve('docs/PHRM-US-002-browser-screenshots');
const reportPath = path.resolve('docs/PHRM-US-002-browser-test-results.md');
const frontendOrigin = 'http://localhost:5180';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
let browser, vite, page, fixture;

function pass(message) {
  checks.push(message);
  console.log('PASS: ' + message);
}

async function loginThroughUi(email) {
  await page.goto(`${frontendOrigin}/org/query-live/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app', { waitUntil: 'domcontentloaded' });
  await page.evaluate(clinicId => sessionStorage.setItem('ulwembu.activeClinic', clinicId), fixture.clinicId);
}

async function becomeUser(context, email, role) {
  const response = await context.request.post(fixture.baseUrl + '/api/v1/auth/login', {
    headers: { 'X-Tenant-ID': fixture.tenant },
    data: { email, password: fixture.password },
  });
  assert.equal(response.status(), 200);
  const auth = await response.json();
  await page.evaluate(({ auth, tenant, clinicId, role }) => {
    sessionStorage.setItem('ulwembu.tenantToken', auth.accessToken);
    sessionStorage.setItem('ulwembu.tenantSlug', tenant);
    sessionStorage.setItem('ulwembu.activeClinic', clinicId);
    sessionStorage.setItem('ulwembu.user', JSON.stringify({
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      role,
    }));
  }, { auth, tenant: fixture.tenant, clinicId: fixture.clinicId, role });
}

async function screenshot(name) {
  const file = path.join(artifacts, name);
  await page.screenshot({ path: file, fullPage: true });
  return path.relative(path.dirname(reportPath), file).replace(/\\/g, '/');
}

function writeReport(status, screenshots, error) {
  const lines = [
    '# PHRM-US-002 Browser Test Results',
    '',
    `Date: ${new Date().toISOString()}`,
    `Status: ${status}`,
    '',
    '## Live Environment',
    '',
    `- Backend: ${fixture?.baseUrl ?? 'not started'}`,
    `- Frontend: ${frontendOrigin}`,
    `- Tenant: ${fixture?.tenant ?? 'n/a'}`,
    `- Clinic: ${fixture?.clinicId ?? 'n/a'}`,
    '',
    '## Checks',
    '',
    ...checks.map(check => `- ${check}`),
    '',
    '## Screenshots',
    '',
    ...screenshots.map(item => `- [${item.label}](${item.file})`),
  ];
  if (error) lines.push('', '## Failure', '', error);
  fs.writeFileSync(reportPath, lines.join('\n') + '\n');
}

(async () => {
  assert.ok(fs.existsSync(path.join(frontend, 'node_modules/vite/bin/vite.js')), 'Frontend dependencies must be installed');
  for (let i = 0; !fs.existsSync(fixturePath) && i < 180; i++) await sleep(2000);
  assert.ok(fs.existsSync(fixturePath), 'Live browser fixture must be ready');
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fs.mkdirSync(artifacts, { recursive: true });

  vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
    cwd: frontend,
    windowsHide: true,
    env: { ...process.env, VITE_API_BASE_URL: fixture.baseUrl },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(frontendOrigin)).ok) break; } catch {}
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
    if (response.url().includes('/api/') && response.status() >= 400 && !response.url().includes('/response')) {
      errors.push(response.status() + ' ' + new URL(response.url()).pathname);
    }
  });

  await loginThroughUi(fixture.nurseEmail);
  pass('Prescriber signs in through the real frontend against the live backend');

  await becomeUser(context, fixture.pharmacistEmail, 'Pharmacist');
  await page.goto(`${frontendOrigin}/app/pharmacy/prescriptions/${fixture.prescriptionId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Query prescriber', exact: true }).waitFor();
  await page.getByLabel('Query reason').fill('Please confirm the Warfarin and Ibuprofen interaction before dispensing.');
  await page.getByRole('button', { name: 'Check guideline warnings', exact: true }).click();
  await page.getByText('Bleeding risk', { exact: false }).waitFor();
  const screenshots = [];
  screenshots.push({ label: 'Guideline deviation shown before raising query', file: await screenshot('01-guideline-warning-before-query.png') });
  pass('Guideline deviation flagging appears before the pharmacist opens the query');

  await page.getByRole('button', { name: 'Raise query and hold', exact: true }).click();
  await page.getByText('Held', { exact: true }).waitFor();
  await page.getByText('Prescription on hold', { exact: true }).waitFor();
  screenshots.push({ label: 'Prescription held after pharmacist query', file: await screenshot('02-prescription-held.png') });
  pass('Raising a query places the prescription in HELD state');

  await becomeUser(context, fixture.nurseEmail, 'Professional Nurse');
  await page.goto(`${frontendOrigin}/app/pharmacy/queries`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Prescription queries', exact: true }).waitFor();
  await page.getByText('Please confirm the Warfarin and Ibuprofen interaction before dispensing.').waitFor();
  await page.getByLabel(/^Prescriber response/).fill('Interaction acknowledged; monitor INR and proceed with caution.');
  await page.getByRole('button', { name: 'Send response', exact: true }).click();
  await page.getByText('Response: Interaction acknowledged; monitor INR and proceed with caution.').waitFor();
  screenshots.push({ label: 'Prescriber responds from query inbox', file: await screenshot('03-prescriber-response.png') });
  pass('Prescriber receives the collaboration item and responds in the browser');

  await becomeUser(context, fixture.pharmacistEmail, 'Pharmacist');
  await page.goto(`${frontendOrigin}/app/pharmacy/prescriptions/${fixture.prescriptionId}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Pending', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Latest prescriber response', exact: true }).waitFor();
  screenshots.push({ label: 'Prescription returns to queue with response visible', file: await screenshot('04-returned-to-queue-response-visible.png') });
  pass('Pharmacist sees the returned prescription with the prescriber response visible');

  const prescriptionResponse = await context.request.get(fixture.baseUrl + `/api/v1/prescriptions/${fixture.prescriptionId}`, {
    headers: {
      Authorization: 'Bearer ' + await page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')),
      'X-Tenant-ID': fixture.tenant,
      'X-Clinic-ID': fixture.clinicId,
    },
  });
  assert.equal(prescriptionResponse.status(), 200);
  const prescription = await prescriptionResponse.json();
  assert.equal(prescription.status, 'PENDING');
  assert.equal(prescription.latestQuery.status, 'RESPONDED');
  pass('Backend confirms the browser query returned the prescription to PENDING');

  assert.deepEqual(errors, []);
  pass('No JavaScript page errors or unexpected failed API responses occurred during the browser flow');
  writeReport('PASS', screenshots);
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ status: 'PASS', checks, screenshots }, null, 2));
  fs.writeFileSync(donePath, 'PASS');
})().catch(async error => {
  console.error(error.message);
  fs.mkdirSync(artifacts, { recursive: true });
  const screenshots = [];
  if (page) {
    const file = await screenshot('failure.png').catch(() => null);
    if (file) screenshots.push({ label: 'Failure screenshot', file });
  }
  writeReport('FAIL', screenshots, error.stack || error.message);
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ status: 'FAIL', checks, error: error.message }, null, 2));
  if (fixture) fs.writeFileSync(donePath, 'FAIL');
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (vite) vite.kill();
});
