// UI contract check against synthetic API responses; does not send email or modify clinic data.
const { chromium } = require('../../target/pharmacy-browser/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
    const token = 'x.' + Buffer.from(JSON.stringify({ roles: ['ORG_ADMIN'] })).toString('base64url') + '.x';
    await context.addInitScript(t => {
      sessionStorage.setItem('ulwembu.tenantToken', t);
      sessionStorage.setItem('ulwembu.tenantSlug', 'synthetic-test');
    }, token);
    const warning = { supplyId: 'prior-supply', prescriptionItemId: 'prior-item', facilityId: 'other-clinic',
      facilityName: 'Other clinic', dispensedAt: '2026-09-30T10:00:00Z', supplyUntil: '2026-10-09', quantity: 7 };
    const item = { id: 'item', drugName: 'Test medicine', dosage: 'Daily', quantity: 30, dispensedQuantity: 7,
      productId: 'product', productName: 'Test medicine', packSize: 30, baseUnit: 'TABLET', status: 'PARTIALLY_DISPENSED',
      clinicalCheckStatus: 'PASSED', clinicalCheckNote: 'Reviewed', duplicateWarnings: [warning] };
    const rx = { id: 'rx', serialNumber: 'RX-TEST', patientName: 'Synthetic Patient', patientMpi: 'TEST-MPI',
      facilityId: 'clinic', prescriberName: 'Test Prescriber', status: 'PARTIALLY_DISPENSED', items: [item], createdAt: '2026-10-01T10:00:00Z' };
    const position = { accountId: 'account', productId: 'product', code: 'TEST', displayName: 'Test medicine',
      baseUnit: 'TABLET', packSize: 30, batchId: 'batch', lotNumber: 'TEST-LOT', expiryDate: '2027-01-01',
      locationId: 'location', locationName: 'Main', available: 50, physical: 50, reorderThreshold: 5, status: 'In stock' };
    let dispensePayload, declinePayload;
    await context.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/auth/me')) data = { id: 'user', firstName: 'Test', lastName: 'Pharmacist', email: 'test@example.invalid' };
      else if (path === '/api/v1/facilities') data = { items: [{ id: 'clinic', name: 'Current clinic' }] };
      else if (path.includes('/stock/positions')) data = { items: [position] };
      else if (path.includes('/prescriptions/queue')) data = { items: rx.status === 'DECLINED' ? [] : [rx] };
      else if (path.endsWith('/dispense')) {
        dispensePayload = route.request().postDataJSON();
        item.dispensedQuantity += dispensePayload.quantity; position.available -= dispensePayload.quantity;
        return route.fulfill({ status: 204 });
      } else if (path.endsWith('/decline')) {
        declinePayload = route.request().postDataJSON(); item.status = 'DECLINED'; rx.status = 'DECLINED';
        item.declineReason = declinePayload.reasonCode; item.declineNote = declinePayload.note;
        item.declinedAt = '2026-10-01T12:00:00Z';
        return route.fulfill({ status: 204 });
      } else if (path.includes('/prescriptions/')) data = rx;
      else if (path.includes('/ledger')) data = { items: [], totalItems: 0, hasMore: false };
      else if (path.includes('/products')) data = { items: [{ id: 'product', displayName: 'Test medicine', baseUnit: 'TABLET', active: true }], hasMore: false };
      else data = { displayName: 'Synthetic organization', logoUrl: null };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.DECLINE_UI_URL || 'http://127.0.0.1:5188/app/pharmacy', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Dispense', exact: true }).click().catch(async e => {
      console.log('PAGE', page.url(), await page.locator('body').innerText(), 'ERRORS', errors); throw e;
    });
    await page.getByRole('alert', { name: 'Potential duplicate dispensing' }).waitFor();
    assert.match(await page.locator('dialog').innerText(), /Other clinic/);
    assert.match(await page.locator('dialog').innerText(), /2026-10-09/);
    await page.getByLabel('Quantity to dispense').fill('2');
    await page.getByLabel(/Supply end date/).fill('2026-10-09');
    assert.equal(await page.getByRole('button', { name: 'Confirm dispensing', exact: true }).isDisabled(), true);
    await page.getByRole('checkbox', { name: /I reviewed the prior supply/ }).check();
    await page.getByRole('button', { name: 'Confirm dispensing', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(dispensePayload, { productId: 'product', batchId: 'batch', locationId: 'location', quantity: 2,
      supplyUntil: '2026-10-09', acknowledgeDuplicateSupply: true, acknowledgedSupplyIds: ['prior-supply'] });
    await page.getByRole('button', { name: 'Dispense', exact: true }).click();
    await page.getByLabel(/Reason code/).selectOption('OTHER');
    assert.equal(await page.getByRole('button', { name: 'Confirm decline', exact: true }).isDisabled(), true);
    await page.getByLabel(/Explanation/).fill('Synthetic patient already has medicine at home.');
    await page.screenshot({ path: 'target/decline-dispensing-dialog.png' });
    await page.getByRole('button', { name: 'Confirm decline', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(declinePayload, { reasonCode: 'OTHER', note: 'Synthetic patient already has medicine at home.' });
    assert.equal(item.dispensedQuantity, 9); assert.equal(position.available, 48);
    await page.getByText('No prescriptions waiting at this clinic.', { exact: true }).waitFor();
    await page.locator('.pharmacy-tools summary').click();
    await page.getByLabel('Prescription serial number').fill('RX-TEST');
    await page.getByRole('button', { name: 'Find prescription', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Prescription found' }).waitFor();
    await page.getByLabel(/Prescription item/).selectOption('item');
    assert.equal(await page.getByRole('button', { name: 'Record clinical review', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Mark out of stock', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Open prescription', exact: true }).click();
    await page.getByText(/Dispensing declined: Other/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirm dispensing', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Confirm decline', exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    const result = 'PASS: prior date/clinic warning, explicit acknowledgement, coverage date payload, mandatory decline reason/note, partial supply preservation, declined-item history, disabled mutation controls, mobile width, no React errors.';
    fs.writeFileSync('target/decline-browser-results.txt', result); console.log(result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
