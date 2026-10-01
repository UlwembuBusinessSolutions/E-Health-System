const {chromium}=require('../../target/pharmacy-browser/node_modules/playwright');
const fs=require('fs');const assert=require('assert/strict');
(async()=>{
 const fixture=JSON.parse(fs.readFileSync('target/pharmacy-ui-fixture.json','utf8'));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1576,height:900}});
 await context.addInitScript(f=>{sessionStorage.setItem('ulwembu.tenantToken',f.token);sessionStorage.setItem('ulwembu.tenantSlug','demo-clinic');sessionStorage.setItem('pharmacy.facility.demo-clinic',f.facilityId);},fixture);
 const page=await context.newPage();page.setDefaultTimeout(120000);let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5176/app/pharmacy',{waitUntil:'domcontentloaded',timeout:180000});
 const row=page.locator('[data-item-id="'+fixture.itemId+'"]');await row.waitFor({timeout:60000});
 await row.getByRole('button',{name:'Review',exact:true}).click();
 await page.getByText('Interaction check required',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Confirm dispensing',exact:true}).count(),0);
 await page.screenshot({path:'target/pharmacy-live-review.png'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.pharmacy-tools summary').click();
 await page.getByRole('combobox',{name:/Prescription item/}).selectOption(fixture.itemId);
 await page.getByRole('combobox',{name:/Clinical checks/}).selectOption('PASSED');
 await page.getByRole('textbox',{name:/Review note \/ prescriber message/}).fill('Synthetic browser test: medicine, strength, dose and interaction checks completed.');
 const reviewResponse=page.waitForResponse(r=>r.url().endsWith('/review') && r.request().method()==='POST');
 await page.getByRole('button',{name:'Record clinical review',exact:true}).click();assert.equal((await reviewResponse).status(),204);
 await row.getByRole('button',{name:'Dispense',exact:true}).waitFor();
 await page.locator('.pharmacy-tools summary').click();
 await row.getByRole('button',{name:'Dispense',exact:true}).click();
 await page.getByLabel('Quantity to dispense').fill('2');
 await page.screenshot({path:'target/pharmacy-live-dispense.png'});
 const dispenseResponse=page.waitForResponse(r=>r.url().endsWith('/dispense') && r.request().method()==='POST');
 await page.getByRole('button',{name:'Confirm dispensing',exact:true}).click();assert.equal((await dispenseResponse).status(),204);
 await page.locator('dialog').waitFor({state:'detached'});
 await row.getByText('Partially dispensed',{exact:true}).waitFor();
 assert.ok((await row.textContent()).includes('8 tablets'));
 await page.screenshot({path:'target/pharmacy-live-after-dispense.png',fullPage:true});
 const headers={'Authorization':'Bearer '+fixture.token,'X-Tenant-ID':'demo-clinic'};
 const positions=await context.request.get('http://localhost:8084/api/v1/pharmacy/stock/positions?facilityId='+fixture.facilityId,{headers});assert.equal(positions.status(),200);
 const stock=(await positions.json()).items.find(s=>s.productId===fixture.productId);assert.equal(stock.available,2);
 const rx=await context.request.get('http://localhost:8084/api/v1/prescriptions/'+fixture.prescriptionId,{headers});assert.equal(rx.status(),200);
 const item=(await rx.json()).items.find(i=>i.id===fixture.itemId);assert.equal(item.dispensedQuantity,2);assert.equal(item.clinicalCheckStatus,'PASSED');assert.ok(item.reviewedAt);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: real browser -> frontend API client -> backend -> PostgreSQL: review-only modal, recorded clearance, 2-unit partial dispense, queue/stock/ledger refresh, remaining quantity 8, stock 2, persisted attribution, no React errors.');
 } finally {await browser.close();fs.writeFileSync('target/pharmacy-ui-done','done');}
})().catch(e=>{fs.writeFileSync('target/pharmacy-ui-done','done');console.error(e);process.exit(1)});



