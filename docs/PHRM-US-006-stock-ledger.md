# Pharmacy stock and ledger

Open `http://localhost:5176/app/pharmacy` and select **sosha**.

The Stock panel reads `/api/v1/pharmacy/stock/positions?facilityId=...`.
It shows batch, expiry, available quantity, reorder threshold and status.
Expired stock is unavailable for dispensing. Stock expiring within 30 days
is flagged by the backend using the clinic's timezone. Low stock is labelled
**Reorder** on the dashboard.

The Stock ledger reads `/api/v1/pharmacy/ledger?facilityId=...`.
It includes actual receipts and supplies, signed quantity changes, running
balances and references. It refreshes with Stock every five seconds and after
dispensing. Open **Full ledger** for older movements.

The local screenshot fixtures are synthetic, persisted example records.
`docs/testing/LoadPharmacyScreenshot.java` adds the Paracetamol example receipt
idempotently. The screenshot's 2026-09-15 expiry is already past: that batch
must display **Expired**, with zero available, rather than **Expiring soon**.
Existing medicine quantities and receipts are preserved; values are not
overwritten to match a picture.

## Development concurrency check

The **Run test** button is available in the local Vite development server.
It runs the backend `DispensingConcurrencyTest` against local PostgreSQL:

1. Create an isolated, randomly named test schema.
2. Use the real stock ledger service to start with 30 units.
3. Start two transactions together, dispensing 7 and 11 units.
4. Verify the balance is 12 and the ledger chain is consistent.
5. Verify insufficient stock is rejected and a failed transaction rolls back.
6. Drop the test schema, including on failure.

The panel reports Running, Passed or Failed. It never decrements clinic stock.
The test endpoint exists only in the development server; it requires a local,
same-origin POST and does not accept commands or database parameters.
Java, Maven and local PostgreSQL must be available. The local runner is
`docs/testing/RunPharmacyConcurrency.ps1`; results are in
`target/pharmacy-concurrency.log` and the JUnit Surefire report. A skipped test
cannot be reported as passed. Set `PHARMACY_BACKEND_DIR` before starting Vite
if the backend is moved out of the current sibling directory.

Normal dispensing still requires a current SAPC registration and a clinically
cleared prescription. Development tests do not bypass those application rules.

## Verification — 30 September 2026

- Frontend production build passed; focused lint passed for changed files.
- Live sample receipt and stock-position APIs passed; four products persisted.
- All clinic stock account balances matched their ledger-entry totals.
- Browser checks passed for stock rows, expired stock, ledger reference,
  matching card heights, prescription dialogs and absence of React errors.
- Development concurrency endpoint returned Passed after the PostgreSQL test
  verified 30 - 7 - 11 = 12, ledger consistency and rollback/insufficient stock.
- Local frontend and backend health URLs returned HTTP 200.
- Cross-origin requests to start the development check returned HTTP 403.

The local test connection disables SSL negotiation on loopback after its
initial SSL handshake timed out. Application dispensing permissions remain
unchanged. The setup identity was disabled and its tokens revoked after the
sample data and browser checks completed.
