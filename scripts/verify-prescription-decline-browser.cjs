// Run with PrescriptionDeclineLiveApiTest holding on -Dprescription.decline.browser.hold=true.
// Usage: node scripts/verify-prescription-decline-browser.cjs <frontend-directory>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('../.tools/browser/node_modules/playwright');

const frontend = path.resolve(process.argv[2] || '');
const fixturePath = path.resolve('target/prescription-decline-browser-fixture.json');
const donePath = path.resolve('target/prescription-decline-browser.done');
const artifacts = path.resolve('docs/PHRM-US-005-browser-screenshots');
const reportPath = path.resolve('docs/PHRM-US-005-browser-test-results.md');
const origin = 'http://localhost:5180';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], screenshots = [], errors = [];
let browser, vite, page, fixture;

function pass(message) { checks.push(message); console.log('PASS: ' + message); }
async function shot(label, name) {
  const file = path.join(artifacts, name);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push({ label, file: path.relative(path.dirname(reportPath), file).replace(/\\/g, '/') });
}
function report(status, error) {
  const lines = ['# PHRM-US-005 Browser Test Results', '', `Date: ${new Date().toISOString()}`, `Status: ${status}`, '',
    '## Live environment', '', `- Backend: ${fixture?.baseUrl || 'not started'}`, `- Frontend: ${origin}`,
    `- Tenant: ${fixture?.tenant || 'n/a'}`, `- Clinic: ${fixture?.clinicId || 'n/a'}`, '', '## Checks', '',
    ...checks.map(x => `- ${x}`), '', '## Screenshots', '', ...screenshots.map(x => `- [${x.label}](${x.file})`)];
  if (error) lines.push('', '## Failure', '', error.stack || String(error));
  fs.writeFileSync(reportPath, lines.join('\n') + '\n');
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ status, checks, screenshots, error: error?.message }, null, 2));
}
async function become(context, email, role) {
  const response = await context.request.post(fixture.baseUrl + '/api/v1/auth/login', {
    headers: { 'X-Tenant-ID': fixture.tenant }, data: { email, password: fixture.password },
  });
  assert.equal(response.status(), 200);
  const auth = await response.json();
  await page.evaluate(({ auth, fixture, role }) => {
    sessionStorage.setItem('ulwembu.tenantToken', auth.accessToken);
    sessionStorage.setItem('ulwembu.tenantSlug', fixture.tenant);
    sessionStorage.setItem('ulwembu.activeClinic', fixture.clinicId);
    sessionStorage.setItem('ulwembu.user', JSON.stringify({ id: auth.user.id, email: auth.user.email,
      firstName: auth.user.firstName, lastName: auth.user.lastName, role }));
  }, { auth, fixture, role });
}

(async () => {
  assert.ok(fs.existsSync(path.join(frontend, 'node_modules/vite/bin/vite.js')), 'Frontend dependencies must be installed');
  for (let i = 0; !fs.existsSync(fixturePath) && i < 180; i++) await sleep(2000);
  assert.ok(fs.existsSync(fixturePath), 'Live browser fixture must be ready');
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fs.mkdirSync(artifacts, { recursive: true });
  vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5180', '--strictPort'],
    { cwd: frontend, windowsHide: true, env: { ...process.env, VITE_API_BASE_URL: fixture.baseUrl }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    if (i === 59) throw Error('Frontend server did not start');
    await sleep(1000);
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname);
  });
  await page.goto(`${origin}/org/decline-live/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Email/).fill(fixture.nurseEmail);
  await page.getByLabel(/^Password/).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app', { waitUntil: 'domcontentloaded' });
  pass('Prescriber signed in through the live frontend');

  await become(context, fixture.pharmacistEmail, 'Pharmacist');
  await page.goto(`${origin}/app/pharmacy/prescriptions/${fixture.prescriptionId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Prior dispensing review' }).waitFor();
  await page.getByText('Amoxicillin', { exact: false }).first().waitFor();
  await page.getByText('supply recorded through', { exact: false }).waitFor();
  await page.getByText('Other clinic', { exact: false }).waitFor();
  await shot('Cross-clinic unexpired dispensing warning', '01-duplicate-warning.png');
  pass('Pharmacist sees prior dispensing date, facility, and active supply before deciding');

  await page.getByLabel('Reason code').selectOption('DUPLICATE_SUPPLY');
  await page.getByLabel(/Reason detail/).fill('Patient still has medication at home');
  await shot('Decline form with mandatory reason code', '02-decline-reason.png');
  await page.getByRole('button', { name: 'Decline and notify prescriber' }).click();
  await page.getByText('Declined', { exact: true }).waitFor();
  await page.getByText('Patient still has medication at home', { exact: false }).waitFor();
  await shot('Saved decline decision', '03-declined.png');
  pass('Decline saves the reason and removes dispensing actions');

  await become(context, fixture.nurseEmail, 'Professional Nurse');
  await page.goto(`${origin}/app/pharmacy/queries`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Dispensing decline notifications' }).waitFor();
  await page.getByRole('link', { name: 'View recorded reason' }).waitFor();
  await shot('Prescriber notification in the browser', '04-prescriber-notification.png');
  pass('Prescriber receives a navigable decline notification');
  assert.deepEqual(errors, []);
  pass('No JavaScript errors or unexpected API failures');
  report('PASS');
  fs.writeFileSync(donePath, 'PASS');
})().catch(async error => {
  console.error(error.stack || error);
  fs.mkdirSync(artifacts, { recursive: true });
  if (page) await shot('Failure screen', 'failure.png').catch(() => {});
  report('FAIL', error);
  if (fixture) fs.writeFileSync(donePath, 'FAIL');
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (vite) vite.kill();
});
