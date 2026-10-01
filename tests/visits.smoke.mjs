// Run against local Vite with synthetic records; all API traffic is mocked.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const token = `test.${Buffer.from(JSON.stringify({ roles: ["ORG_ADMIN"] })).toString("base64url")}.test`;
await context.addInitScript(token => {
  sessionStorage.setItem("ulwembu.tenantToken", token);
  sessionStorage.setItem("ulwembu.tenantSlug", "visits-test");
}, token);
const patient = { id: "patient-1", firstName: "Sample", lastName: "Patient", mpiNumber: "DEMO-001", dateOfBirth: "1990-01-01", gender: "FEMALE", citizenshipStatus: "SA_CITIZEN", idNumber: "TEST", address: "Sample address", contactNumber: "0000000000", createdAt: "2026-09-08T10:00:00Z", archived: false };
let visits = Array.from({ length: 12 }, (_, index) => ({ id: `visit-${index}`, facilityId: index % 2 ? "clinic-2" : "clinic-1", facilityName: index % 2 ? "Rosebank Community Clinic" : "Ubuntu Health Centre", visitType: index % 2 ? "FOLLOW_UP" : "NEW", serviceStream: index % 2 ? "CHRONIC_CARE" : "GENERAL", visitDateTime: `2026-09-${String(index + 1).padStart(2, "0")}T10:30:00Z`, transferredFromVisitId: index === 11 ? "previous-visit" : null }));
let fail = false;
await context.route("**/api/**", async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith("/api/")) return route.continue();
  let result = { items: [] };
  if (path.endsWith("/auth/me")) result = { id: "admin-1", firstName: "Test", lastName: "Admin", email: "test@example.invalid" };
  else if (path.endsWith("/organization")) result = { displayName: "Preview Clinic", slug: "visits-test" };
  else if (path === "/api/v1/patients/patient-1") result = patient;
  else if (path.endsWith("/patients/patient-1/visits")) {
    if (fail) return route.fulfill({ status: 400, json: { message: "Unavailable" } });
    result = { items: visits };
  }
  await route.fulfill({ json: result });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
async function openVisits() {
  await page.goto(`${process.env.VISITS_UI_URL || "http://localhost:5173"}/app/patients/patient-1`);
  await page.getByRole("tab", { name: "Visits", exact: true }).click();
}
try {
  await openVisits();
  const history = page.getByRole("list", { name: "Patient visit history" });
  await history.waitFor();
  assert.equal(await history.getByRole("article").count(), 10);
  assert.match(await history.getByRole("article").first().innerText(), /12 Sept? 2026/);
  await page.getByText("Transferred from another facility").waitFor();
  await page.getByRole("button", { name: "Next visits" }).click();
  assert.equal(await history.getByRole("article").count(), 2);
  await page.getByLabel("Search visits").fill("Rosebank");
  assert.equal(await history.getByRole("article").count(), 6);
  await page.getByLabel("Visit type", { exact: true }).selectOption("NEW");
  await page.getByText("No matching visits", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Sort by").selectOption("oldest");
  assert.match(await history.getByRole("article").first().innerText(), /1 Sept? 2026/);
  await page.getByLabel("Sort by").selectOption("newest");
  await mkdir("test-results", { recursive: true });
  await page.getByRole("heading", { name: "Visit history" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/visits-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Visit history" }).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "test-results/visits-mobile.png" });
  visits = [];
  await openVisits();
  await page.getByText("No visits recorded yet", { exact: true }).waitFor();
  fail = true;
  await openVisits();
  await page.getByRole("alert").filter({ hasText: "Visit history could not be loaded" }).waitFor({ timeout: 20000 });
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("No visits recorded yet", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: visit ordering, pagination, search, combined filters, empty state, error/retry and mobile layout.");
} finally { await browser.close(); }
