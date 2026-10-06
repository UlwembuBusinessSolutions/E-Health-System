import assert from "node:assert/strict";
const { chromium } = await import("file:///C:/Users/GoodKid/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const browser = await chromium.launch({headless:true,channel:"chrome"});
try {
 const page=await browser.newPage();
 const token=`test.${Buffer.from(JSON.stringify({roles:["Stock Control Manager"]})).toString("base64url")}.test`;
 await page.addInitScript(token=>{sessionStorage.setItem("ulwembu.tenantToken",token);sessionStorage.setItem("ulwembu.tenantSlug","demo");},token);
 let posted;
 await page.route("**/api/v1/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith("/auth/me")) return route.fulfill({json:{id:"actor",firstName:"Stock",lastName:"Manager"}});
  if(path.endsWith("/organization")) return route.fulfill({json:{displayName:"Test clinic"}});
  if(path.endsWith("/facilities")) return route.fulfill({json:{items:[{id:"clinic",name:"Test clinic"}]}});
  if(path.endsWith("/assortment")) return route.fulfill({json:{items:[{id:"medicine",displayName:"Test medicine",code:"MED",baseUnit:"TABLET",batchTracked:true,expiryTracked:true}]}});
  if(route.request().method()==="POST"){posted=route.request().postDataJSON();return route.fulfill({json:{id:"receipt"}});}
  return route.fulfill({json:{items:[]}});
 });
 await page.goto("http://localhost:5173/app/pharmacy/stock/receive?facilityId=clinic");
 await page.getByLabel(/^Product/).selectOption("medicine");
 await page.getByLabel("Lot / batch number").fill("2244");
 await page.getByLabel("Expiry date").fill("2028-01-01");
 const quantity=page.getByLabel(/^Quantity \(base units\)/);
 await quantity.fill("90");
 await page.getByLabel("Packs received").fill("3");
 await page.getByLabel("Units per pack").fill("30");
 assert.equal(await quantity.inputValue(),"90");
 assert.equal(await quantity.getAttribute("readonly"),"");
 await page.getByLabel("Packs received").fill("4");
 assert.equal(await quantity.inputValue(),"120");
 await page.getByLabel("Packs received").fill("");
 await page.getByLabel("Units per pack").fill("");
 assert.equal(await quantity.getAttribute("readonly"),null);
 await quantity.fill("90");
 await page.getByLabel("Units per pack").fill("30");
 await page.getByLabel("Packs received").fill("3");
 await page.getByRole("button",{name:"Continue to review"}).click();
 await page.getByRole("heading",{name:"Review receipt"}).waitFor();
 await page.getByRole("button",{name:"Confirm & post"}).click();
 await page.waitForURL("**/stock?facilityId=clinic");
 assert.equal(posted.lines[0].baseQuantity,90);
 assert.equal(posted.lines[0].packs,3);
 assert.equal(posted.lines[0].packSizeUsed,30);
 console.log("PASS: automatic pack totals, recalculation, manual-unit mode, review and posted quantity. API mocked.");
} finally {await browser.close();}
