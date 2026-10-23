import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const token = `test.${Buffer.from(JSON.stringify({ roles: ['ORG_ADMIN'] })).toString('base64url')}.test`;
await context.addInitScript(token => { sessionStorage.setItem('ulwembu.tenantToken', token); sessionStorage.setItem('ulwembu.tenantSlug', 'test'); }, token);
let items = [{ id: 'f1', name: 'Sample Clinic', code: 'CL-1', type: 'CLINIC', address: '1 Sample Road', phone: '012345', operatingHours: 'Weekdays', active: true }];
let fail = false, writes = 0;
await context.route('**/api/**', async route => {
 const path = new URL(route.request().url()).pathname;
 if (!path.startsWith('/api/')) return route.continue();
 let result = { items: [] };
 if (path.endsWith('/auth/me')) result = { id:'admin', firstName:'Test', lastName:'Admin', email:'test@example.invalid' };
 else if (path.endsWith('/organization')) result = { displayName:'Sample Organization', slug:'test' };
 else if (path.endsWith('/mail-settings')) result = { host:null, port:null, username:null, passwordSet:false, fromAddress:null };
 else if (path.startsWith('/api/v1/admin/facilities')) {
  if (route.request().method() !== 'GET') {
   if (fail) return route.fulfill({ status:409, json:{ message:'A facility with this code already exists.' } });
   writes++;
   result = { ...route.request().postDataJSON(), id: route.request().method() === 'POST' ? 'f2' : 'f1', active:true };
   items = [...items.filter(item => item.id !== result.id), result];
  } else result = {items};
 }
 await route.fulfill({ json:result });
});
const page = await context.newPage(); page.setDefaultTimeout(10000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
 await page.goto('http://localhost:5173/app/settings?section=facilities');
 await page.getByRole('button', { name:'Add facility', exact:true }).click();
 await page.getByRole('button', { name:'Create facility', exact:true }).click();
 await page.getByText('Facility name is required').waitFor(); assert.equal(writes,0);
 await page.getByLabel('Facility name').fill('New Pharmacy');
 await page.getByLabel('Facility code').fill('PH-1');
 await page.getByLabel('Facility type').selectOption('PHARMACY');
 await page.getByRole('navigation', { name:'Settings sections' }).getByRole('button', {name:'Email',exact:true}).click();
 await page.getByRole('navigation', { name:'Settings sections' }).getByRole('button', {name:'Facilities',exact:true}).click();
 assert.equal(await page.getByLabel('Facility name').inputValue(),'New Pharmacy');
 await page.getByRole('button', {name:'Create facility',exact:true}).click();
 await page.getByText('New Pharmacy saved.').waitFor(); assert.equal(items.length,2);
 await page.getByRole('button', {name:'Edit Sample Clinic',exact:true}).click();
 assert.equal(await page.getByLabel('Physical address').inputValue(),'1 Sample Road');
 await page.getByLabel('Facility name').fill('Renamed Clinic');
 await page.getByLabel('Physical address').fill('');
 fail = true;
 await page.getByRole('button', {name:'Save facility',exact:true}).click();
 await page.getByRole('alert').waitFor(); assert.equal(await page.getByLabel('Facility name').inputValue(),'Renamed Clinic');
 fail = false;
 await page.getByRole('button', {name:'Save facility',exact:true}).click();
 await page.getByText('Renamed Clinic saved.').waitFor();
 assert.equal(items.find(item=>item.id==='f1').address,'');
 await page.getByLabel('Search facilities').fill('PHARMACY');
 assert.equal(await page.getByRole('button',{name:'Edit Renamed Clinic',exact:true}).count(),0);
 await page.getByLabel('Search facilities').fill('');
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/facilities-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Edit Renamed Clinic',exact:true}).click();
 await page.screenshot({path:'test-results/facilities-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: create, edit, validation, duplicate error recovery, clearing optional fields, section draft preservation, search and mobile layout.');
} finally { await browser.close(); }
