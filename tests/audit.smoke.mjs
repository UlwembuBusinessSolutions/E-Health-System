// UI checks use synthetic responses; they do not certify backend authorization.
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
const orgs = [
  {
    id: "org-a",
    displayName: "Ubuntu Health Centre",
    status: "ACTIVE",
    sector: "PUBLIC",
    slug: "ubuntu",
  },
  {
    id: "org-b",
    displayName: "Rosebank Family Clinic",
    status: "ACTIVE",
    sector: "PRIVATE",
    slug: "rosebank",
  },
];
const actions = [
  "PLATFORM_OPERATOR_LOGIN",
  "ORGANIZATION_DETAILS_UPDATED",
  "PLATFORM_OPERATOR_LOGIN_FAILED",
  "MODULE_TOGGLED",
  "CLINIC_CREATED",
  "ORGANIZATION_ADMIN_ADDED",
  "ORGANIZATION_MAIL_SETTINGS_UPDATED",
  "PLATFORM_AUDIT_EXPORTED",
];
const records = Array.from({ length: 63 }, (_, i) => ({
  id: `event-${i}`,
  action: actions[i % actions.length],
  detail:
    i === 0
      ? "Sample detail <script>window.unwanted = true</script>"
      : "Recorded configuration updated for the selected organization.",
  createdAt: new Date(
    Date.UTC(2026, 8, 16, 10, 42) - i * 3600000,
  ).toISOString(),
  operatorName: i % 3 ? "Thandi Mokoena" : "Alex Morgan",
  operatorEmail: i % 3 ? "thandi@example.invalid" : "alex@example.invalid",
  organizationId: i % 3 ? "org-a" : null,
  organizationName: i % 3 ? "Ubuntu Health Centre" : null,
  ipAddress: "192.0.2.10",
  deviceSignature: "Synthetic browser user agent for audit UI testing",
}));
let fail = false;
let lastExport;
let overrideTotal;
let auditRequests = 0;
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path === "/platform/auth/login")
    return route.fulfill({
      json: {
        accessToken: "synthetic-token",
        operator: {
          id: "op",
          firstName: "Alex",
          lastName: "Morgan",
          email: "alex@example.invalid",
        },
      },
    });
  if (
    path === "/platform/organizations" &&
    route.request().resourceType() === "fetch"
  )
    return route.fulfill({ json: { items: orgs } });
  if (
    path === "/platform/audit/export" &&
    route.request().resourceType() === "fetch"
  ) {
    lastExport = url;
    return route.fulfill({
      contentType: "text/csv",
      headers: {
        "Content-Disposition": 'attachment; filename="audit-test.csv"',
      },
      body: "Action,Operator\nLOGIN,Alex\n",
    });
  }
  if (
    path === "/platform/audit" &&
    route.request().resourceType() === "fetch"
  ) {
    auditRequests++;
    if (fail)
      return route.fulfill({
        status: 500,
        json: { message: "Synthetic failure" },
      });
    const query = url.searchParams;
    const page = Number(query.get("page"));
    const size = Number(query.get("size"));
    const filtered = records.filter(
      (r) =>
        (!query.get("action") || r.action === query.get("action")) &&
        (!query.get("organizationId") ||
          r.organizationId === query.get("organizationId")) &&
        (!query.get("from") || r.createdAt.slice(0, 10) >= query.get("from")) &&
        (!query.get("to") || r.createdAt.slice(0, 10) <= query.get("to")),
    );
    return route.fulfill({
      json: {
        items: filtered.slice(page * size, (page + 1) * size),
        totalItems: overrideTotal ?? filtered.length,
        page,
        size,
        hasMore: (page + 1) * size < filtered.length,
      },
    });
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.AUDIT_UI_URL || "http://localhost:5173";
try {
  await page.goto(`${base}/platform/login`);
  await page
    .getByRole("textbox", { name: /^Email/ })
    .fill("alex@example.invalid");
  await page.getByLabel(/^Password/).fill("Synthetic-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Audit trail", exact: true }).click();
  await page.getByText("1–50 of 63 events", { exact: true }).waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/audit-desktop.png" });
  const first = page
    .getByRole("button", {
      name: "View Operator signed in details",
      exact: true,
    })
    .first();
  await first.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByText(/16 Sept? 2026, 10:42:00 UTC/).waitFor();
  assert.equal(await page.evaluate(() => window.unwanted), undefined);
  await page.screenshot({ path: "test-results/audit-event-drawer.png" });
  await page.keyboard.press("Escape");
  assert.equal(await dialog.count(), 0);
  assert.equal(
    await first.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByLabel("Find on this page", { exact: true }).fill("not-found");
  await page
    .getByRole("heading", { name: "No matches on this page" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Export CSV" }).isDisabled(),
    true,
  );
  await page.getByLabel("Find on this page", { exact: true }).fill("");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByText("51–63 of 63 events", { exact: true }).waitFor();
  await page
    .getByLabel("Action", { exact: true })
    .selectOption("CLINIC_CREATED");
  await page.getByText("1–8 of 8 events", { exact: true }).waitFor();
  assert(!new URL(page.url()).searchParams.has("page"));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  await download;
  assert.equal(lastExport.searchParams.get("action"), "CLINIC_CREATED");
  await page.goBack();
  await page.getByText("51–63 of 63 events", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await page.getByText("1–50 of 63 events", { exact: true }).waitFor();
  fail = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByText("Refresh failed. These results may be out of date.", {
      exact: false,
    })
    .waitFor();
  assert.equal(await page.locator(".audit-table tbody tr").count(), 50);
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("button", { name: "Export CSV" })
    .waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".audit-stale"));
  fail = true;
  await page
    .getByLabel("Action", { exact: true })
    .selectOption("ORGANIZATION_SUSPENDED");
  await page
    .getByRole("heading", { name: "Couldn't load the audit trail" })
    .waitFor();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .getByRole("heading", { name: "No activity matches your filters" })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await page.getByText("1–50 of 63 events", { exact: true }).waitFor();
  overrideTotal = 10001;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByText(
      "Narrow your filters to 10,000 events or fewer to export a complete CSV.",
    )
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Export CSV" }).isDisabled(),
    true,
  );
  overrideTotal = undefined;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("1–50 of 63 events", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/audit-mobile.png",
    fullPage: false,
  });
  await page.locator(".audit-mobile-event").first().click();
  assert(await page.getByRole("dialog").isVisible());
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Close event details" }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await page.screenshot({ path: "test-results/audit-dark.png" });
  assert.deepEqual(errors, []);
  console.log(
    `PASS: audit UI, paging, filters, UTC dates, safe details, focus return, export filters/cap, errors, mobile and dark mode (${auditRequests} API requests).`,
  );
} finally {
  await browser.close();
}
