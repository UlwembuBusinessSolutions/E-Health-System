// Organization audit presentation with synthetic data; no real clinical records.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  timezoneId: "America/New_York",
});
const organization = {
  id: "org-preview",
  slug: "ubuntu",
  displayName: "Ubuntu Health Centre",
  sector: "PUBLIC",
  status: "ACTIVE",
  logoUrl: null,
  createdAt: "2026-01-01T10:00:00Z",
  enabledModuleCount: 0,
  totalModuleCount: 20,
};
const actions = [
  "LOGIN",
  "PATIENT_UPDATED",
  "STAFF_CREATED",
  "TRIAGE_ASSESSMENT_CAPTURED",
  "CONSULTATION_SIGNED",
  "PRESCRIPTION_CREATED",
];
const records = Array.from({ length: 32 }, (_, i) => ({
  id: `event-${i}`,
  action: actions[i % 6],
  entityType: i % 6 === 0 ? "User" : i % 6 === 1 ? "Patient" : "Record",
  entityId: `record-${i}`,
  actorName: i % 2 ? "Thandi Mokoena" : "Alex Morgan",
  createdAt: new Date(
    Date.UTC(2026, 8, 16, 10, 42) - i * 3600000,
  ).toISOString(),
  beforeValue: i === 0 ? '{"lastLoginAt":"2026-09-15T10:00:00Z"}' : null,
  afterValue:
    i === 0
      ? '{"lastLoginAt":"2026-09-16T10:42:00Z","note":"<script>window.injected=true</script>"}'
      : null,
  ipAddress: "192.0.2.10",
  deviceSignature: "Synthetic browser for organization audit testing",
}));
let fail = false,
  exported = false;
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (route.request().resourceType() !== "fetch") return route.continue();
  if (path === "/platform/auth/login")
    return route.fulfill({
      json: {
        accessToken: "test",
        operator: {
          id: "op",
          firstName: "Alex",
          lastName: "Morgan",
          email: "alex@example.invalid",
        },
      },
    });
  if (path === "/platform/organizations")
    return route.fulfill({ json: { items: [organization] } });
  if (path === "/platform/organizations/org-preview")
    return route.fulfill({ json: organization });
  if (path.endsWith("/audit/export")) {
    exported = true;
    return route.fulfill({
      contentType: "text/csv",
      headers: {
        "Content-Disposition": 'attachment; filename="org-audit.csv"',
      },
      body: "Action,Actor\nLOGIN,Alex\n",
    });
  }
  if (path.endsWith("/audit")) {
    if (fail)
      return route.fulfill({
        status: 500,
        json: { message: "Synthetic failure" },
      });
    const page = Number(url.searchParams.get("page")),
      size = Number(url.searchParams.get("size"));
    return route.fulfill({
      json: {
        items: records.slice(page * size, (page + 1) * size),
        totalItems: records.length,
        page,
        size,
        hasMore: (page + 1) * size < records.length,
      },
    });
  }
  if (path.endsWith("/mail-settings"))
    return route.fulfill({
      json: {
        host: null,
        port: 587,
        username: null,
        passwordSet: false,
        fromAddress: null,
      },
    });
  if (path.startsWith("/platform/"))
    return route.fulfill({ json: { items: [] } });
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(
    `${process.env.AUDIT_UI_URL || "http://localhost:5173"}/platform/login`,
  );
  await page
    .getByRole("textbox", { name: /^Email/ })
    .fill("alex@example.invalid");
  await page.getByLabel(/^Password/).fill("Synthetic-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Audit trail", exact: true }).waitFor();
  await page.evaluate(() => {
    history.pushState({}, "", "/platform/organizations/org-preview");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const audit = page.getByRole("region", { name: /^Audit trail/ });
  await audit.getByText("1–25 of 32 events", { exact: true }).waitFor();
  await audit.scrollIntoViewIfNeeded();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/organization-audit-desktop.png",
  });
  const first = audit.locator("summary").first();
  await first.focus();
  await page.keyboard.press("Enter");
  assert.equal(await audit.locator("details").first().getAttribute("open"), "");
  await audit
    .getByText("16 Sept 2026, 10:42:00 UTC", { exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await page.screenshot({
    path: "test-results/organization-audit-expanded.png",
  });
  await page
    .getByLabel("Find in organization audit page")
    .fill("no-such-record");
  await audit
    .getByRole("heading", { name: "No matches on this page" })
    .waitFor();
  assert(await audit.getByRole("button", { name: "Export CSV" }).isDisabled());
  await page.getByLabel("Find in organization audit page").fill("");
  await audit.getByRole("button", { name: "Next audit page" }).click();
  await audit.getByText("26–32 of 32 events", { exact: true }).waitFor();
  await page
    .getByLabel("Organization audit events per page")
    .selectOption("50");
  await audit.getByText("1–32 of 32 events", { exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await audit.getByRole("button", { name: "Export CSV" }).click();
  await download;
  assert(exported);
  fail = true;
  await page
    .getByRole("button", { name: "Refresh organization audit" })
    .click();
  await audit
    .getByText("Refresh failed. Showing previously loaded events.", {
      exact: false,
    })
    .waitFor();
  assert.equal(await audit.locator("details").count(), 32);
  fail = false;
  await audit.getByRole("button", { name: "Try again" }).click();
  await page.waitForFunction(
    () => !document.querySelector(".org-audit-notice"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await audit.evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -105);
  });
  assert(await audit.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.screenshot({ path: "test-results/organization-audit-mobile.png" });
  await audit.locator("summary").first().click();
  assert(await audit.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await audit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/organization-audit-dark.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: organization audit timeline, keyboard expansion, safe snapshots, UTC, search, paging, export, refresh recovery, mobile and dark mode.",
  );
} finally {
  await browser.close();
}
