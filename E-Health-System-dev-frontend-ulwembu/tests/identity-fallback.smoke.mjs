// Run against local Vite; all API traffic is mocked and no camera or biometric device is exposed.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const token = `test.${Buffer.from(JSON.stringify({ roles: ["ORG_ADMIN"] })).toString("base64url")}.test`;
await context.addInitScript(token => {
  sessionStorage.setItem("ulwembu.tenantToken", token);
  sessionStorage.setItem("ulwembu.tenantSlug", "identity-fallback-test");
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
}, token);
const patient = { id: "patient-1", mpiNumber: "TEST-001", firstName: "No Device", lastName: "Patient", dateOfBirth: "1990-01-01", gender: "FEMALE", citizenshipStatus: "SA_CITIZEN", idNumber: "9005155001084", address: "Test clinic", contactNumber: "+27821234567", email: null, medicalAidProvider: null, medicalAidNumber: null, passportNumber: null, passportExpiry: null, createdAt: "2026-09-28T10:00:00Z", archived: false, archivedReason: null, archivedAt: null, deceasedDate: null, migrated: false };
let registrationPayload, visitPayload;
await context.route("**/api/v1/**", async route => {
  const path = new URL(route.request().url()).pathname;
  const method = route.request().method();
  let result = { items: [] };
  if (path.endsWith("/auth/me")) result = { id: "admin-1", firstName: "Test", lastName: "Admin", email: "test@example.invalid" };
  else if (path.endsWith("/organization")) result = { displayName: "Fallback Test Clinic", slug: "identity-fallback-test" };
  else if (path === "/api/v1/patients" && method === "POST") { registrationPayload = route.request().postDataJSON(); result = patient; }
  else if (path === "/api/v1/patients/patient-1") result = patient;
  else if (path === "/api/v1/facilities") result = { items: [{ id: "clinic-1", name: "Test Clinic" }] };
  else if (path === "/api/v1/visits" && method === "POST") {
    visitPayload = route.request().postDataJSON();
    result = { visit: { id: "visit-1", patientId: "patient-1", facilityId: "clinic-1", visitType: visitPayload.visitType, serviceStream: visitPayload.serviceStream, visitDateTime: "2026-09-28T10:00:00Z" }, token: { id: "token-1", visitId: "visit-1", facilityId: "clinic-1", tokenNumber: 42, priority: "NORMAL", status: "ISSUED", manual: false, issuedAt: "2026-09-28T10:00:00Z", calledAt: null, issuedByUserId: "admin-1" } };
  }
  await route.fulfill({ json: result });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(`${process.env.IDENTITY_UI_URL || "http://localhost:5173"}/app/patients/new`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/^First name/).fill("No Device");
  await page.getByLabel(/^Last name/).fill("Patient");
  await page.getByLabel(/^SA ID number/).fill("9005155001084");
  await page.getByLabel(/^Address/).fill("Test clinic");
  await page.getByLabel(/^Contact number/).fill("+27821234567");
  await page.getByRole("button", { name: "Register patient", exact: true }).click();
  await page.getByRole("heading", { name: "Patient registered", exact: true }).waitFor();
  assert.equal(registrationPayload.manualVerificationReason, "DEVICE_UNAVAILABLE");
  await page.goto(`${process.env.IDENTITY_UI_URL || "http://localhost:5173"}/app/patients/patient-1`);
  await page.getByRole("button", { name: "Start visit", exact: true }).click();
  await page.getByLabel(/^Facility/).selectOption("clinic-1");
  await page.getByLabel(/^Visit type/).selectOption("NEW");
  await page.getByLabel(/^Service stream/).selectOption("GENERAL");
  await page.getByRole("button", { name: "Issue queue token", exact: true }).click();
  await page.getByText("Token #42", { exact: true }).waitFor();
  assert.equal(visitPayload.manualVerificationReason, "DEVICE_UNAVAILABLE");
  assert.deepEqual(errors, []);
  console.log("PASS: no-device patient registration and check-in retain their normal success paths and submit manual reasons.");
} finally { await browser.close(); }
