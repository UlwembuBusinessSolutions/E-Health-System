// Synthetic patients/staff and mocked HTTP. Database enforcement is tested separately.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PHARMACY_UI_URL || "http://localhost:5173";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  const token = `test.${Buffer.from(JSON.stringify({ roles: ["Medical Officer"] })).toString("base64url")}.test`;
  await page.addInitScript(token => {
    sessionStorage.setItem("ulwembu.tenantToken", token); sessionStorage.setItem("ulwembu.tenantSlug", "demo");
  }, token);
  let status = "UNKNOWN", history = [], canDispense = false, canPrescribe = true, posted, dispensePosted, reportQuery, reportFail = false, dutyFail = false;
  const until = () => new Date(Date.now() + 3600000).toISOString();
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const json = body => route.fulfill({ json: body });
    if (path.endsWith("/auth/me")) return json({ id: "officer", firstName: "Medical", lastName: "Officer", email: "officer@example.invalid" });
    if (path.endsWith("/organization")) return json({ displayName: "Test Clinic", slug: "demo" });
    if (path.endsWith("/facilities")) return json({ items: [{ id: "clinic-a", name: "Clinic A" }, { id: "clinic-b", name: "Clinic B" }] });
    if (path.endsWith("/dispensing-capabilities")) return json({ canDispense, canPrescribe });
    if (path === "/api/v1/pharmacy/duty" && route.request().method() === "POST") {
      posted = route.request().postDataJSON(); status = posted.dutyType;
      history = [{ id: "entry", staffName: "Medical Officer", dutyType: status, startedAt: new Date().toISOString(), expiresAt: until(), endedAt: null, reason: posted.reason, mine: true }];
      return json({ id: "entry" });
    }
    if (path === "/api/v1/pharmacy/duty") {
      if (dutyFail) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      const value = url.searchParams.get("facilityId") === "clinic-b" ? "UNKNOWN" : status;
      return json({ status: value, absenceId: value === "NO_DISPENSER" ? "entry" : null, absenceExpiresAt: value === "NO_DISPENSER" ? until() : null,
        activeShifts: value === "ON_DUTY" ? history.filter(h => h.dutyType === "ON_DUTY") : [], history });
    }
    if (path.endsWith("/end")) { status = "UNKNOWN"; history = history.map(h => ({ ...h, endedAt: new Date().toISOString() })); return route.fulfill({ status: 204 }); }
    if (path.endsWith("/prescriber-dispensed.csv")) return route.fulfill({ contentType: "text/csv", body: "Prescription,MPI,Prescriber dispensed\r\nRX-TEST,MPI-TEST,Yes\r\n" });
    if (path.endsWith("/prescriber-dispensed")) {
      reportQuery = url.searchParams;
      if (reportFail) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      const rows = url.searchParams.get("facilityId") === "clinic-b" ? [] : [{ id: "record", serialNumber: "RX-TEST", mpi: "MPI-TEST", patientName: "Sample Patient", facilityName: "Clinic A",
        medicine: "Test medicine", quantity: 2, dispensedBy: "Medical Officer", dispensedAt: new Date().toISOString(), dutyEntryId: "entry", dutyReason: "Assistant absent today" }];
      return json({ items: rows, totalItems: rows.length ? 26 : 0, page: Number(url.searchParams.get("page")), size: 25 });
    }
    if (path.endsWith("/pharmacy/stock")) return json({ items: [{ productId: "product", displayName: "Test medicine", available: 10, baseUnit: "TABLET" }] });
    if (path.endsWith("/prescriptions/queue")) return json({ items: [{ id: "rx", serialNumber: "RX-TEST", patientName: "Sample Patient", patientMpi: "MPI-TEST", facilityId: "clinic-a", createdAt: new Date().toISOString(),
      items: [{ id: "item", drugName: "Test medicine", dosage: "Daily", quantity: 2, status: "PENDING" }] }] });
    if (path.endsWith("/dispense")) { dispensePosted = route.request().postDataJSON(); return route.fulfill({ status: 204 }); }
    return json({ items: [] });
  });
  await page.goto(base + "/app/pharmacy");
  const confirmation = page.getByRole("checkbox", { name: /No pharmacy dispenser/ });
  await confirmation.waitFor();
  assert.equal(await confirmation.isDisabled(), true);
  await page.getByRole("link", { name: "Open duty register" }).click();
  await page.getByRole("heading", { name: "Availability needs confirmation" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Start my dispenser shift" }).count(), 0);
  const confirmAbsence = page.getByRole("button", { name: "Confirm no dispenser available" });
  assert.equal(await confirmAbsence.isDisabled(), true);
  await page.getByLabel("Duty reason").fill("Assistant absent today");
  await confirmAbsence.click();
  await page.getByRole("heading", { name: "No dispenser available — confirmed" }).waitFor();
  assert.equal(posted.facilityId, "clinic-a"); assert.equal(posted.dutyType, "NO_DISPENSER");
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/pharmacy-duty.png" });
  await page.getByRole("link", { name: "Back to dispensing" }).click();
  await confirmation.check();
  await page.getByLabel("Stock product for Test medicine").selectOption("product");
  await page.getByRole("button", { name: "Dispense", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.checked);
  assert.equal(dispensePosted.prescriberDispensed, true); assert.equal(dispensePosted.noDispenserOnDuty, true);
  await page.screenshot({ path: "test-results/prescriber-dispensing-updated.png" });
  canDispense = true;
  await page.goto(base + "/app/pharmacy/duty");
  await page.getByLabel("Duty reason").fill("Afternoon dispenser shift");
  await page.getByRole("button", { name: "Start my dispenser shift" }).click();
  await page.getByRole("heading", { name: "Dispenser on duty", exact: true }).waitFor();
  assert.equal(await confirmAbsence.isDisabled(), true);
  // An on-duty dispenser also blocks the prescriber checkbox after navigation.
  await page.goto(base + "/app/pharmacy");
  await confirmation.waitFor(); assert.equal(await confirmation.isDisabled(), true);
  await page.goto(base + "/app/pharmacy/duty");
  await page.getByRole("button", { name: "End my shift" }).click();
  await page.getByRole("heading", { name: "Availability needs confirmation" }).waitFor();
  await page.getByLabel("Clinic", { exact: true }).selectOption("clinic-b");
  await page.getByRole("heading", { name: "Availability needs confirmation" }).waitFor();
  await page.goto(base + "/app/pharmacy/prescriber-report");
  await page.getByText("26 medicine rows", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(reportQuery.get("page"), "1");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  assert.match((await download).suggestedFilename(), /prescriber-dispensed.*\.csv$/);
  await page.screenshot({ path: "test-results/prescriber-report.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByLabel("Report clinic").selectOption("clinic-b");
  await page.getByText("No prescriber-dispensed medicines match these filters.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Export CSV" }).isDisabled(), true);
  await page.getByLabel("To date").fill("2020-01-01");
  await page.getByRole("alert").filter({ hasText: "Choose a valid date range" }).waitFor();
  reportFail = true;
  await page.goto(base + "/app/pharmacy/prescriber-report");
  await page.getByRole("alert").filter({ hasText: "Could not load the report" }).waitFor({ timeout: 20000 });
  reportFail = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("26 medicine rows", { exact: true }).waitFor();
  dutyFail = true;
  await page.goto(base + "/app/pharmacy");
  await confirmation.waitFor(); assert.equal(await confirmation.isDisabled(), true);
  dutyFail = false; canDispense = false; canPrescribe = false;
  await page.goto(base + "/app/pharmacy/duty");
  await page.getByRole("heading", { name: "Availability needs confirmation" }).waitFor();
  assert.equal(await confirmAbsence.count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: duty confirmation, named shifts/end, clinic scope, fail-closed dispensing, reporting pagination/CSV/errors/mobile, and read-only controls. APIs mocked.");
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) console.error((await page.locator("body").innerText()).slice(0,5000));
  throw error;
} finally { await browser.close(); }
