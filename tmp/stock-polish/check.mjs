import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STOCK_TEST_BASE_URL || 'http://127.0.0.1:5187';
const server = process.env.STOCK_TEST_BASE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5187'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let quantity = 3, threshold = 5, posted, reorderPosted, dispensePosted, stockRequests = 0, rejectCount = true, prescriberMode = false;
  const token = `test.${Buffer.from(JSON.stringify({ roles: ['Stock Control Manager'] })).toString('base64url')}.test`;
  await page.addInitScript(token => { sessionStorage.setItem('ulwembu.tenantToken', token); sessionStorage.setItem('ulwembu.tenantSlug', 'demo'); }, token);
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const respond = json => route.fulfill({ json });
    if (path === '/api/v1/auth/me') return respond({ id: 'actor', firstName: 'Stock', lastName: 'Manager', email: 'stock@example.invalid' });
    if (path === '/api/v1/pharmacy/duty') return respond({ status: 'NO_DISPENSER', absenceId: 'duty', absenceExpiresAt: new Date(Date.now() + 3600000).toISOString(), activeShifts: [], history: [] });
    if (path === '/api/v1/prescriptions/dispensing-capabilities') return respond({ canDispense: !prescriberMode, canPrescribe: prescriberMode });
    if (path === '/api/v1/organization') return respond({ displayName: 'Test clinic', slug: 'demo', status: 'ACTIVE', primaryColor: null });
    if (path === '/api/v1/facilities') return respond({ items: [{ id: 'clinic-a', name: 'Clinic A' }, { id: 'clinic-b', name: 'Clinic B' }] });
    if (path === '/api/v1/pharmacy/stock') { stockRequests++; return respond({ items: [{ productId: 'product', code: 'MED', displayName: 'Test medicine', baseUnit: 'TABLET', available: url.searchParams.get('facilityId') === 'clinic-b' ? 0 : quantity, reorderThreshold: threshold, status: quantity <= threshold ? 'Low stock' : 'In stock' }] }); }
    if (path === '/api/v1/pharmacy/stock/alerts') { const available = url.searchParams.get('facilityId') === 'clinic-b' ? 0 : quantity; return respond({ items: threshold !== null && available <= threshold ? [{ productId: 'product', displayName: 'Test medicine', available, reorderThreshold: threshold, baseUnit: 'TABLET' }] : [] }); }
    if (path === '/api/v1/pharmacy/stock/accounts') return respond({ items: [{ accountId: 'account', batchId: 'batch', locationId: 'location', lotNumber: 'LOT-1', bucket: 'AVAILABLE', quantity }] });
    if (path === '/api/v1/pharmacy/ledger') return respond({ items: [], page: 0, size: 10, hasMore: false, totalItems: 0 });
    if (path === '/api/v1/pharmacy/stock/reorder-level') { reorderPosted = route.request().postDataJSON(); threshold = reorderPosted.reorderThreshold; return route.fulfill({ status: 204 }); }
    if (path === '/api/v1/pharmacy/stock/counts') {
      posted = route.request().postDataJSON(); assert.ok(route.request().headers()['idempotency-key']);
      if (rejectCount) return route.fulfill({ status: 409, json: { message: 'Stock changed during counting. Refresh and recount before posting.' } });
      quantity = posted.countedQuantity; return respond({ transactionId: 'movement' });
    }
    if (path.includes('/dispense')) { dispensePosted = route.request().postDataJSON(); return route.fulfill({ status: 204 }); }
    if (path === '/api/v1/prescriptions/queue') return respond({ items: [{ id: 'rx', serialNumber: 'RX-TEST', patientName: 'Sample Patient', patientMpi: 'MPI-TEST', facilityId: 'clinic-a', createdAt: '2026-09-29T10:00:00Z', items: [{ id: 'rx-item', drugName: 'Test medicine', dosage: 'Daily', quantity: 2, status: 'PENDING' }] }] });
    return respond({ items: [] });
  });
  await page.goto(`${base}/app/pharmacy/stock`);
  await page.getByRole('alert').filter({ hasText: 'Reorder alert' }).waitFor();
  await page.getByLabel('Search stock', {exact:true}).fill('missing');
  await page.getByText('No products match these filters.', {exact:true}).waitFor();
  await page.getByRole('button', {name:'Clear filters'}).click();
  await page.getByLabel('Stock status', {exact:true}).selectOption('empty');
  await page.getByText('No products match these filters.', {exact:true}).waitFor();
  await page.getByLabel('Stock status', {exact:true}).selectOption('reorder');
  await page.getByRole('link', {name:'Test medicine',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({width:1440,height:1100});
  await page.getByRole('button', { name: 'Count Test medicine', exact: true }).click();
  await page.getByLabel('Batch / stock account').selectOption('account');
  await page.getByLabel('Counted quantity').fill('1');
  await page.getByLabel('Reason for count / variance').fill('Cycle count C-1');
  assert.equal(await page.getByRole('button', { name: 'Post audited count' }).isDisabled(), true);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Post audited count' }).click();
  await page.getByRole('alert').filter({ hasText: 'Stock changed during counting' }).waitFor();
  rejectCount = false;
  await page.getByRole('button', { name: 'Refresh and recount' }).click();
  await page.getByLabel('Batch / stock account').selectOption('account');
  await page.getByLabel('Counted quantity').fill('1');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Post audited count' }).click();
  await page.getByText('Stock count recorded as an audited adjustment.', { exact: true }).waitFor();
  assert.deepEqual(posted, { facilityId: 'clinic-a', productId: 'product', accountId: 'account', expectedQuantity: 3, countedQuantity: 1, reason: 'Cycle count C-1' });
  await page.getByRole('button', { name: 'Set reorder level for Test medicine' }).click();
  await page.getByLabel('Reorder threshold').fill('0');
  await page.getByRole('button', { name: 'Save reorder level' }).click();
  await page.getByText('Reorder level updated.', { exact: true }).waitFor();
  assert.equal(reorderPosted.reorderThreshold, 0);
  await page.getByRole('alert').filter({ hasText: 'Reorder alert' }).waitFor({ state: 'hidden' });
  const beforePoll = stockRequests; await page.waitForTimeout(5500); assert.ok(stockRequests > beforePoll);
  await mkdir('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/stock-control.png', fullPage: true });
  await page.getByLabel('Facility', { exact: true }).selectOption('clinic-b');
  await page.getByRole('alert').filter({ hasText: 'Test medicine: 0 tablet on hand' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: /stock control/ }).count(), 0);
  await page.goto(`${base}/app/pharmacy`);
  await page.getByRole('button', { name: 'Dispense', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Dispense', exact: true }).isDisabled(), true);
  await page.getByLabel('Stock product for Test medicine').selectOption('product');
  await page.getByRole('button', { name: 'Dispense', exact: true }).click();
  await page.waitForTimeout(500); assert.deepEqual(dispensePosted, { productId: 'product', prescriberDispensed: false, noDispenserOnDuty: false });
  prescriberMode = true;
  await page.reload();
  await page.getByLabel('Stock product for Test medicine').selectOption('product');
  assert.equal(await page.getByRole('button', { name: 'Dispense', exact: true }).isDisabled(), true);
  await page.getByRole('checkbox', { name: /No pharmacy dispenser/ }).check();
  await page.getByRole('button', { name: 'Dispense', exact: true }).click();
  await page.waitForTimeout(500);
  assert.deepEqual(dispensePosted, { productId: 'product', prescriberDispensed: true, noDispenserOnDuty: true });
  assert.equal(await page.getByRole('checkbox', { name: /No pharmacy dispenser/ }).isChecked(), false);
  await page.screenshot({ path: 'test-results/prescriber-dispensing.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: stock alerts/counts/reorder/clinic switching, normal dispensing, prescriber confirmation required, reporting flags, and confirmation reset after success. API mocked.');
} finally { await browser?.close(); server?.kill(); }
