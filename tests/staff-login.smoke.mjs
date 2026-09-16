// Synthetic organization and authentication responses; never uses real credentials.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
let succeed = false,
  failBrand = false,
  submitted,
  attempts = 0;
const org = {
  displayName: "Demo Clinic",
  slug: "demo-clinic",
  logoUrl: null,
  sector: "PUBLIC",
  status: "ACTIVE",
};
const user = {
  id: "synthetic-user",
  firstName: "Sample",
  lastName: "Staff",
  email: "sample@example.invalid",
};
const token = `test.${Buffer.from(JSON.stringify({ roles: ["ORG_ADMIN"] })).toString("base64url")}.test`;
await context.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith("/api/")) return route.continue();
  if (path === "/api/v1/public/organization")
    return route.fulfill(
      failBrand
        ? { status: 503, json: { message: "Unavailable" } }
        : { json: org },
    );
  if (path === "/api/v1/auth/login") {
    attempts++;
    submitted = route.request().postDataJSON();
    assert.equal(route.request().headers()["x-tenant-id"], "demo-clinic");
    await new Promise((resolve) => setTimeout(resolve, 250));
    return route.fulfill(
      succeed
        ? {
            json: {
              accessToken: token,
              user,
              expiresAt: "2099-01-01T00:00:00Z",
            },
          }
        : { status: 401, json: { message: "Email or password is incorrect." } },
    );
  }
  if (path === "/api/v1/organization") return route.fulfill({ json: org });
  if (path === "/api/v1/auth/me") return route.fulfill({ json: user });
  return route.fulfill({ json: { items: [] } });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.STAFF_LOGIN_UI_URL || "http://localhost:5173";
try {
  await page.goto(`${base}/org/demo-clinic/login`);
  await page
    .getByRole("heading", { name: "Welcome back.", exact: true })
    .waitFor();
  await page.getByText("Demo Clinic", { exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".sl-form-container")).opacity ===
      "1",
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/staff-login-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Pause healthcare animation" })
    .click();
  assert.equal(
    await page.locator(".staff-login").getAttribute("data-motion"),
    "paused",
  );
  assert.equal(
    await page
      .locator(".sl-orbit-outer")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
    "paused",
  );
  await page.getByRole("button", { name: "Play healthcare animation" }).click();
  assert.equal(
    await page.locator(".staff-login").getAttribute("data-motion"),
    "running",
  );
  await page
    .getByRole("button", { name: "Sign in to workspace", exact: true })
    .click();
  await page.getByText("Email is required", { exact: true }).waitFor();
  await page.getByText("Password is required", { exact: true }).waitFor();
  assert.equal(attempts, 0);
  await page
    .getByRole("textbox", { name: /^Email address/ })
    .fill("sample@example.invalid");
  await page.getByLabel(/^Password/).fill("Synthetic-password!123");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByLabel(/^Password/).getAttribute("type"), "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Email or password is incorrect." })
    .waitFor();
  assert.equal(submitted.email, "sample@example.invalid");
  assert.equal(
    await page.getByLabel(/^Password/).inputValue(),
    "Synthetic-password!123",
  );
  assert.equal(attempts, 1);
  assert.equal(
    await page
      .getByRole("link", { name: "Forgot password?" })
      .getAttribute("href"),
    "/org/demo-clinic/forgot-password",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Go to patient sign in" })
      .getAttribute("href"),
    "/org/demo-clinic/patient/login",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Change organization" })
      .getAttribute("href"),
    "/login",
  );
  await page.reload();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".sl-ecg")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.equal(
    await page
      .locator(".sl-orbit-outer")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  assert.equal(
    await page
      .locator(".staff-login")
      .evaluate((el) => getComputedStyle(el).colorScheme),
    "light",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/staff-login-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/staff-login-tablet.png",
    fullPage: true,
  });
  failBrand = true;
  await page.reload();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page
    .locator(".sl-clinic strong")
    .getByText("demo-clinic", { exact: true })
    .waitFor();
  succeed = true;
  await page
    .getByRole("textbox", { name: /^Email address/ })
    .fill("sample@example.invalid");
  await page.getByLabel(/^Password/).fill("Synthetic-password!123");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.waitForURL("**/app");
  await page.getByRole("heading", { name: "Welcome back, Sample" }).waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("ulwembu.tenantSlug")),
    "demo-clinic",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login validation, keyboard password toggle, failure/success, tenant routing, navigation links, branding fallback, animation pause/reduced motion, mobile/tablet and dark-theme contrast.",
  );
} finally {
  await browser.close();
}
