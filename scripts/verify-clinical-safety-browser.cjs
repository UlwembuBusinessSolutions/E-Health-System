// Run while ClinicalSafetyLiveApiTest is holding with -Dclinical.safety.browser.hold=true.
// Usage: node scripts/verify-clinical-safety-browser.cjs <frontend-directory>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('../.tools/browser/node_modules/playwright');

const frontend = path.resolve(process.argv[2] || '');
const fixturePath = path.resolve('target/clinical-safety-browser-fixture.json');
const donePath = path.resolve('target/clinical-safety-browser.done');
const artifacts = path.resolve('docs/PHRM-US-003-browser-screenshots');
const reportPath = path.resolve('docs/PHRM-US-003-browser-test-results.md');
const frontendOrigin = 'http://localhost:5180';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
let browser, vite, page, fixture;

function pass(message) {
  checks.push(message);
  console.log('PASS: ' + message);
}

async function loginThroughUi(email) {
  await page.goto(`${frontendOrigin}/org/clinical-live/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app', { waitUntil: 'domcontentloaded' });
  await page.evaluate(clinicId => sessionStorage.setItem('ulwembu.activeClinic', clinicId), fixture.clinicId);
}

async function becomePharmacist(context) {
  const response = await context.request.post(fixture.baseUrl + '/api/v1/auth/login', {
    headers: { 'X-Tenant-ID': fixture.tenant },
    data: { email: fixture.pharmacistEmail, password: fixture.password },
  });
  assert.equal(response.status(), 200);
  const auth = await response.json();
  await page.evaluate(({ auth, tenant, clinicId }) => {
    sessionStorage.setItem('ulwembu.tenantToken', auth.accessToken);
    sessionStorage.setItem('ulwembu.tenantSlug', tenant);
    sessionStorage.setItem('ulwembu.activeClinic', clinicId);
    sessionStorage.setItem('ulwembu.user', JSON.stringify({
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      role: 'Pharmacist',
    }));
  }, { auth, tenant: fixture.tenant, clinicId: fixture.clinicId });
}

async function screenshot(name) {
  const file = path.join(artifacts, name);
  await page.screenshot({ path: file, fullPage: true });
  return path.relative(path.dirname(reportPath), file).replace(/\\/g, '/');
}

function writeReport(status, screenshots, error) {
  const lines = [
    '# PHRM-US-003 Browser Test Results',
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
    if (response.url().includes('/api/') && response.status() >= 400) {
      errors.push(response.status() + ' ' + new URL(response.url()).pathname);
    }
  });

  await loginThroughUi(fixture.nurseEmail);
  pass('Nurse signs in through the real frontend against the live backend');

  await page.goto(`${frontendOrigin}/app/pharmacy/create?visitId=${fixture.visitId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Create Prescription', exact: true }).waitFor();
  await page.getByLabel('Drug Name 1').fill(fixture.drugs[0]);
  await page.getByLabel('Dosage 1').fill('1 tablet daily');
  await page.getByLabel('Quantity 1').fill('1');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Drug Name 2').fill(fixture.drugs[1]);
  await page.getByLabel('Dosage 2').fill('1 tablet daily');
  await page.getByLabel('Quantity 2').fill('1');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Drug Name 3').fill(fixture.drugs[2]);
  await page.getByLabel('Dosage 3').fill('1 capsule daily');
  await page.getByLabel('Quantity 3').fill('1');
  await page.getByRole('button', { name: 'Create Prescription', exact: true }).click();
  await page.getByRole('heading', { name: 'Clinical safety alerts', exact: true }).waitFor();
  await page.getByText('A high-severity clinical alert requires a documented override reason before prescribing.').waitFor();
  const screenshots = [];
  screenshots.push({ label: 'Prescribing blocks until override reason is recorded', file: await screenshot('01-prescribe-alerts.png') });
  pass('Prescribing displays ranked clinical alerts before submitting a high-risk combination');

  await page.getByLabel('Override reason required').fill('Prescriber reviewed benefit versus risk');
  await page.getByRole('button', { name: 'Create Prescription', exact: true }).click();
  await page.waitForURL('**/app/pharmacy/prescriptions/*', { waitUntil: 'domcontentloaded' });
  await page.getByText('Pending', { exact: true }).waitFor();
  const prescriptionId = new URL(page.url()).pathname.split('/').pop();
  screenshots.push({ label: 'Prescription created after clinical override', file: await screenshot('02-prescription-pending.png') });
  pass('Prescribing succeeds after an explicit clinical override reason');

  await becomePharmacist(context);
  await page.goto(`${frontendOrigin}/app/pharmacy/prescriptions/${prescriptionId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Dispense prescription', exact: true }).click();
  await page.getByRole('heading', { name: 'Clinical safety alerts', exact: true }).waitFor();
  screenshots.push({ label: 'Dispensing blocks until pharmacist override reason is recorded', file: await screenshot('03-dispense-alerts.png') });
  pass('Dispensing displays the same clinical alerts before release');

  await page.getByLabel('Override reason required').fill('Pharmacist confirmed prescriber decision');
  await page.getByRole('button', { name: 'Dispense prescription', exact: true }).click();
  await page.getByText('Dispensed', { exact: true }).waitFor();
  screenshots.push({ label: 'Prescription dispensed after pharmacist override', file: await screenshot('04-dispensed.png') });
  pass('Dispensing succeeds after a pharmacist override reason');

  const prescriptionResponse = await context.request.get(fixture.baseUrl + `/api/v1/prescriptions/${prescriptionId}`, {
    headers: {
      Authorization: 'Bearer ' + await page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')),
      'X-Tenant-ID': fixture.tenant,
      'X-Clinic-ID': fixture.clinicId,
    },
  });
  assert.equal(prescriptionResponse.status(), 200);
  assert.equal((await prescriptionResponse.json()).status, 'DISPENSED');
  pass('Backend confirms the browser-created prescription is DISPENSED');

  assert.deepEqual(errors, []);
  pass('No JavaScript page errors or failed API responses occurred during the browser flow');
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
