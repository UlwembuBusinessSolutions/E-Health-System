// Synthetic API responses; checks tenant audit interactions, not backend authorization.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const token = `test.${Buffer.from(JSON.stringify({ roles: ['ORG_ADMIN'] })).toString('base64url')}.test`;
await context.addInitScript(token => {
  sessionStorage.setItem('ulwembu.tenantToken', token);
  sessionStorage.setItem('ulwembu.tenantSlug', 'audit-test');
}, token);
let lastQuery, exported, empty = false;
const entries = Array.from({ length: 51 }, (_, i) => ({ id: `event-${i}`, action: ['PATIENT_UPDATED', 'STAFF_LOGIN', 'AUDIT_LOG_EXPORTED'][i % 3], entityType: 'PATIENT', entityId: `record-${i}`, actorName: 'Thandi Mokoena', createdAt: new Date().toISOString(), beforeValue: '{"status":"pending"}', afterValue: '{"status":"active"}', ipAddress: '192.0.2.1', deviceSignature: 'Synthetic browser for UI verification' }));
await context.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) return route.continue();
  let result = { items: [] };
  if (url.pathname.endsWith('/auth/me')) result = { id: 'admin', firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid' };
  else if (url.pathname.endsWith('/organization')) result = { displayName: 'Preview Clinic', slug: 'audit-test' };
  else if (url.pathname.endsWith('/audit/export')) {
    exported = url;
    return route.fulfill({ contentType: 'text/csv', headers: { 'Content-Disposition': 'attachment; filename="audit.csv"' }, body: 'Action\nPATIENT_UPDATED\n' });
  } else if (url.pathname.endsWith('/audit')) {
    lastQuery = url;
    const page = Number(url.searchParams.get('page'));
    result = { items: empty ? [] : entries.slice(page * 50, page * 50 + 50), page, size: 50, totalItems: empty ? 0 : 51, hasMore: !empty && page === 0 };
  }
  await route.fulfill({ json: result });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://localhost:5173/app/audit');
  await page.locator('.ta-event').first().waitFor();
  assert.equal(await page.locator('.ta-event').count(), 50);
  await page.locator('.ta-event summary').first().click();
  await page.getByText('192.0.2.1', { exact: true }).first().waitFor();
  assert.match(await page.locator('.ta-changes').first().innerText(), /pending/);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/tenant-audit-desktop.png' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await page.getByText('Page 1', { exact: true }).waitFor();
  assert.equal(lastQuery.searchParams.get('page'), '0');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await download;
  assert.equal(exported.searchParams.get('from'), await page.getByLabel('From', { exact: true }).inputValue());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.ta-event summary').first().click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/tenant-audit-mobile.png' });
  const allHistory = page.waitForResponse(r => r.url().includes('/admin/audit?') && !r.url().includes('from='));
  await page.getByRole('button', { name: 'All history', exact: true }).click();
  await allHistory;
  assert.equal(lastQuery.searchParams.has('from'), false);
  empty = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('No activity recorded yet', { exact: true }).waitFor();
  await page.getByLabel('From', { exact: true }).fill('2026-09-22');
  await page.getByLabel('To', { exact: true }).fill('2026-09-01');
  await page.getByText('Check your date range', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Export CSV' }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: details, pagination, date presets, export dates, mobile overflow, all history, empty state, invalid range.');
} catch (error) { console.log(await page.locator('body').innerText()); console.log(errors); throw error; } finally { await browser.close(); }


