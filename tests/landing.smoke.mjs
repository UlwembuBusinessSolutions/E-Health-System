import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://localhost:5173/org/demo-clinic');
 await page.getByRole('heading',{name:'Your health. Your journey. Our priority.'}).waitFor();
 assert.equal(await page.locator('a[href="/org/demo-clinic/patient/register"]').count(),3);
 assert.equal(await page.locator('a[href="/org/demo-clinic/login"]').count(),2);
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/landing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Patient portal',exact:true}).click();
 assert.equal(await page.getByRole('navigation',{name:'Mobile navigation'}).count(),0);
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:'test-results/landing-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Patient sign in'}).click();
 await page.waitForURL('**/org/demo-clinic/patient/login');
 assert.deepEqual(errors,[]);
 console.log('PASS: live landing data, patient/staff routes, mobile menu, portal navigation and responsive width.');
} finally {await browser.close();}
