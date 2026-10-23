// Synthetic API fixtures only; never submits real SMTP credentials.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const token = `test.${Buffer.from(JSON.stringify({ roles: ["ORG_ADMIN"] })).toString("base64url")}.test`;
await context.addInitScript(token => {
  sessionStorage.setItem("ulwembu.tenantToken", token);
  sessionStorage.setItem("ulwembu.tenantSlug", "settings-test");
}, token);
let settings = { host: "smtp.example.invalid", port: 587, username: "mail@example.invalid", passwordSet: true, fromAddress: "clinic@example.invalid" };
let submitted;
let failSave = false;
await context.route("**/api/**", async route => {
  const pathname = new URL(route.request().url()).pathname;
  if (!pathname.startsWith("/api/")) return route.continue();
  let result = { items: [] };
  if (pathname.endsWith("/auth/me")) result = { id: "admin-1", firstName: "Test", lastName: "Admin", email: "admin@example.invalid" };
  else if (pathname.endsWith("/organization")) result = { displayName: "Preview Clinic", slug: "settings-test" };
  else if (pathname.endsWith("/mail-settings")) {
    if (route.request().method() === "PATCH") {
      if (failSave) return route.fulfill({ status: 500, json: { message: "Save unavailable" } });
      submitted = route.request().postDataJSON();
      settings = { ...settings, ...submitted, passwordSet: true };
    }
    result = settings;
  }
  await route.fulfill({ json: result });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(`${process.env.SETTINGS_UI_URL || "http://localhost:5173"}/app/settings?section=email`);
  await page.getByLabel("SMTP host").waitFor();
  assert.equal(await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled(), true);
  await page.getByLabel("Search settings").fill("missing category");
  await page.getByText("No settings match your search.").waitFor();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Email" }).click();
  assert.equal(new URL(page.url()).searchParams.get("section"), "email");
  await page.getByLabel("SMTP host").fill("smtp.changed.invalid");
  await page.getByText("You have unsaved changes", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Discard changes" }).click();
  assert.equal(await page.getByLabel("SMTP host").inputValue(), settings.host);
  await page.getByLabel("Port", { exact: false }).fill("70000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Enter a valid port number").waitFor();
  assert.equal(submitted, undefined);
  await page.getByLabel("Port", { exact: false }).fill("587");
  await page.getByLabel("Sender email address").fill("updated@example.invalid");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Email settings saved.", { exact: true }).waitFor();
  assert.equal(submitted.fromAddress, "updated@example.invalid");
  assert.equal("password" in submitted, false);
  assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
  failSave = true;
  await page.getByLabel("SMTP host").fill("smtp.retry.invalid");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("SMTP host").inputValue(), "smtp.retry.invalid");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/settings-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "test-results/settings-mobile.png", fullPage: true });
  settings = { ...settings, passwordSet: false };
  await page.reload();
  await page.getByLabel("SMTP host").waitFor();
  await page.getByLabel("SMTP host").fill("smtp.new.invalid");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Enter a password to configure your mail server.").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: settings navigation, discard, validation, save, password preservation, failed-save draft, initial password and mobile overflow.");
} finally { await browser.close(); }
