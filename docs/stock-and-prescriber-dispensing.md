# Stock control and prescriber dispensing

The existing `PharmacyStockAccount`, `PharmacyStockTransaction` and `PharmacyStockEntry` entities remain the stock balances and append-only movement history. No parallel stock tables were introduced.

## Staff workflow

- Pharmacy > Stock: select a clinic. The view includes configured products with zero stock, shows active reorder alerts at or below the configured level, and refreshes every five seconds. Local receipts, counts and dispensing invalidate cached balances immediately.
- Use a product's Count or Reorder actions to record a physical count per batch/account or configure its clinic reorder level. Enter the counted base units and reason, review the variance and confirm before posting. Refresh and recount if the server reports that stock changed. Movement history remains available in Pharmacy > Ledger.
- Pharmacy > Dispensing: explicitly choose the stock product for each prescription item. The prescribed quantity is dispensed in that product's base units. The server allocates unexpired stock by earliest expiry across the prescription's clinic.
- Eligible licensed prescribers can confirm that no pharmacy dispenser is on duty and dispense without an SAPC dispensing registration. The confirmation resets after a successful operation or clinic change. Both individual and bulk dispensing support this path.

## Prescriber eligibility and duty status

The server requires PHRM:MANAGE, a current prescribing licence using the application's existing HPCSA/SANC licence checks, and a current Doctor, Medical Officer, Professional Nurse or Occupational Health Practitioner role. Licence and role checks run on every dispense request. The normal dispensing path still requires a current SAPC registration.

Pharmacy > Duty register records named dispenser shifts (1–12 hours) and explicit no-dispenser confirmations (one hour). Only a currently licensed dispenser can start their own shift. A licensed dispenser or eligible licensed prescriber can confirm absence, with a required reason, only when no shift is active. Entries expire automatically; the recording staff member can end their own entry early. A new shift permanently cancels previous absence confirmations. This is an attendance register maintained by staff, not an external scheduling-system integration.

Prescriber dispensing requires both the per-prescription confirmation and a current absence entry for that prescription's clinic. Unknown, expired or on-duty status blocks the request, including direct API requests. Duty changes and dispensing acquire the same clinic lock, so they cannot race past the availability check. Each new prescriber dispensing record retains its duty-entry ID. Historical records without this link remain reportable as legacy staff confirmations.

Pharmacy > Prescriber report filters by clinic and an inclusive UTC date range of at most 366 days. It lists one row per dispensed prescription item, including patient name/MPI, prescription, medicine/quantity, dispensing officer, timestamp and duty evidence. Results use 25-row pages. CSV exports contain all matching rows up to 10,000; larger requests require narrower filters. Export is audited and neutralizes spreadsheet formulas in text fields. Both report endpoints require pharmacy VIEW access.

Each dispensing record stores `prescriber_dispensed`, `no_dispenser_on_duty`, the dispensing staff ID and timestamp. The prescription and patient medication APIs expose both booleans per item; medication history and prescription printouts display the prescriber-dispensed label. The audit event is `PRESCRIPTION_ITEM_PRESCRIBER_DISPENSED` and records both flags. These fields can be used for reporting without inferring the mode from a staff member's current role.

## Transaction guarantees

Receiving, counting and dispensing serialize postings with the same clinic lock before reading balances; the ledger also locks individual accounts. A prescription lock prevents duplicate or racing item resolution. All stock entries, dispensing records, prescription states and audit writes share the caller's transaction. Any insufficient-stock or persistence error rolls back the entire operation, including bulk dispensing.

Counts post signed adjustments, including a zero-delta audited movement for a matching count. An expected balance prevents a stale count from overwriting newer stock. Count replay keys return the original transaction; different bodies using the same key are rejected. Active reorder alerts are computed from committed balances and clear automatically after replenishment; they are not email notifications or historical alert events.

## API additions and changes

- `GET /api/v1/pharmacy/stock/accounts?facilityId=...&productId=...`
- `GET /api/v1/pharmacy/stock/alerts?facilityId=...`
- `POST /api/v1/pharmacy/stock/counts`, with a UUID `Idempotency-Key` header and `{facilityId, productId, accountId, expectedQuantity, countedQuantity, reason}`.
- `PATCH /api/v1/pharmacy/stock/reorder-level` with `{facilityId, productId, reorderThreshold}`; null disables the alert threshold.
- `GET /api/v1/prescriptions/dispensing-capabilities` returns current `canDispense` and `canPrescribe` eligibility for this workflow.
- `GET /api/v1/pharmacy/duty?facilityId=...` returns current status, active shifts and the latest 50 entries.
- `POST /api/v1/pharmacy/duty` accepts `{facilityId, dutyType: "ON_DUTY" | "NO_DISPENSER", hours: 1..12, reason}`. Absence always lasts one hour.
- `POST /api/v1/pharmacy/duty/{entryId}/end?facilityId=...` ends the caller's own entry.
- `GET /api/v1/pharmacy/prescriber-dispensed?facilityId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&page=0`
- `GET /api/v1/pharmacy/prescriber-dispensed.csv?facilityId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Item dispensing requires `{productId, prescriberDispensed, noDispenserOnDuty}`. Both booleans default to false when omitted.
- Bulk dispensing requires `{products: {"prescription-item-uuid": "stock-product-uuid"}, prescriberDispensed, noDispenserOnDuty}`. Every pending item needs an explicit product mapping.

Deploy the matching frontend and backend together: previous clients that send empty dispense bodies receive a validation error. Tenant migrations V41–V43 add the Stock Control Manager role, reporting flags and Medical Officer pharmacy permissions; V44 adds the duty register and the dispensing-to-duty link. Restart the backend so its tenant migration lifecycle applies them. Existing clinics start with unknown duty availability; staff must record attendance before using the prescriber fallback.

## Verification

- `mvn test` runs the ordinary suites, including stock API validation and permission checks.
- Set `STOCK_TEST_JDBC_URL` to a PostgreSQL test database URL and supply credentials separately through `STOCK_TEST_DB_USER` and `STOCK_TEST_DB_PASSWORD`. Then run `mvn -Dtest=StockControlPersistenceTest test`. The test creates, migrates and removes randomly named `stock_test_*` schemas only.
- From the frontend directory, run `node tests/stock-control.smoke.mjs` with Playwright available (or set `PLAYWRIGHT_MODULE` to its module path). The script starts a local Vite server unless `STOCK_TEST_BASE_URL` is set. API responses are mocked; PostgreSQL tests independently exercise the actual services, migrations and concurrent database transactions.
- With the frontend running, `node tests/pharmacy-duty.smoke.mjs` checks duty tracking, dispensing guards, report paging/export/errors and mobile layout using synthetic data. Set `PHARMACY_UI_URL` to override the default localhost:5173.
