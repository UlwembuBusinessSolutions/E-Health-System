// Synthetic sessions and API responses only. No real logins or patient records.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const INITIAL = Date.parse('2030-01-10T08:00:00Z');
function token(expiry) { return `test.${Buffer.from(JSON.stringify({ roles: ['ORG_ADMIN'], exp: Math.floor(expiry / 1000), jti: 'session-test' })).toString('base64url')}.test`; }
async function scenario() {
  let now = INITIAL, lastActivity = INITIAL, expiry = INITIAL + 3600000, failContinue = false, forceLocked = false;
  const calls = { activity: 0, continuation: 0, logout: 0, metadata: 0 };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(value => { if (!sessionStorage.getItem('test.initialized')) { sessionStorage.setItem('test.initialized', 'yes'); sessionStorage.setItem('ulwembu.tenantToken', value); sessionStorage.setItem('ulwembu.tenantSlug', 'session-test'); } }, token(expiry));
  const metadata = () => ({ serverTime: new Date(now).toISOString(), expiresAt: new Date(expiry).toISOString(), idleExpiresAt: new Date(lastActivity + 900000).toISOString(), idleTimeoutSeconds: 900, warningSeconds: 60 });
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    let result = { items: [] };
    if (path.endsWith('/auth/me')) result = { id: 'test', firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid' };
    else if (path.endsWith('/auth/session')) { calls.metadata++; result = metadata(); }
    else if (path.endsWith('/session/activity')) { calls.activity++; lastActivity = now; result = metadata(); }
    else if (path.endsWith('/session/continue')) {
      calls.continuation++;
      if (failContinue) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      if (forceLocked) return route.fulfill({ status: 419, json: { message: 'Session locked' } });
      lastActivity = now; expiry = now + 3600000; result = { ...metadata(), accessToken: token(expiry) };
    }
    else if (path.endsWith('/auth/logout')) { calls.logout++; return route.fulfill({ status: 204 }); }
    else if (path.endsWith('/mail-settings')) result = { host: 'smtp.example.invalid', port: 587, username: 'test', passwordSet: true, fromAddress: 'test@example.invalid' };
    else if (path.endsWith('/organization')) result = { displayName: 'Preview Clinic', slug: 'session-test' };
    await route.fulfill({ json: result });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(INITIAL) });
  await page.goto('http://localhost:5173/app/settings?section=email');
  await page.getByLabel('SMTP host').waitFor();
  await page.waitForFunction(() => !!sessionStorage.getItem('ulwembu.tenantToken'));
  const advance = async milliseconds => { now += milliseconds; await page.clock.fastForward(milliseconds); };
  return { page, context, calls, errors, advance, fail: value => { failContinue = value; }, lock: () => { forceLocked = true; }, setExpiry: value => { expiry = value; } };
}
try {
  const s = await scenario();
  const { page } = s;
  const activity = page.waitForResponse(r => r.url().includes('/session/activity'));
  await page.getByLabel('SMTP host').fill('unsaved.example.invalid');
  await activity;
  const original = await page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken'));
  await s.advance(840000);
  const modal = page.getByRole('dialog', { name: 'Still working?' });
  await modal.waitFor();
  assert.equal(await modal.getByRole('button', { name: 'Continue session' }).evaluate(el => el === document.activeElement), true);
  const activityBeforeWarning = s.calls.activity;
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  assert.equal(await modal.isVisible(), true);
  assert.equal(s.calls.activity, activityBeforeWarning);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/session-warning-desktop.png' });
  s.fail(true);
  await modal.getByRole('button', { name: 'Continue session' }).click();
  await modal.getByRole('alert').waitFor();
  assert.equal(await modal.isVisible(), true);
  s.fail(false);
  await modal.getByRole('button', { name: 'Continue session' }).click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.getByLabel('SMTP host').inputValue(), 'unsaved.example.invalid');
  assert.notEqual(await page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')), original);
  await s.advance(841000);
  await modal.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/session-warning-mobile.png' });
  await modal.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL('**/org/session-test/login');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')), null);
  assert.equal(s.calls.logout, 1);
  assert.deepEqual(s.errors, []);
  await s.context.close();

  const expired = await scenario();
  await expired.advance(901000);
  await expired.page.waitForURL('**/org/session-test/login');
  assert.equal(await expired.page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')), null);
  assert.equal(expired.calls.continuation, 0);
  assert.equal(expired.calls.activity, 0);
  await expired.context.close();

  const locked = await scenario();
  await locked.advance(840000);
  await locked.page.getByRole('dialog').waitFor();
  locked.lock();
  await locked.page.getByRole('button', { name: 'Continue session' }).click();
  await locked.page.waitForURL('**/org/session-test/login');
  assert.equal(await locked.page.evaluate(() => sessionStorage.getItem('ulwembu.tenantToken')), null);
  await locked.context.close();
  console.log('PASS: warning timing, modal focus/Escape, explicit continuation, failed renewal, preserved draft, renewed token, log out, idle expiry, locked response and mobile overflow.');
} finally { await browser.close(); }
