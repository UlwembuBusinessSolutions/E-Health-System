# PHRM-US-006 integration verification — 29 September 2026

The backend and the frontend at `E-Health-System-dev-frontend-ulwembu (3)/E-Health-System-dev-frontend-ulwembu` implement the partial-dispensing story and supplied pharmacy dashboard/dialog design. See [implementation details](PHRM-US-006-integration.md).

## Completed checks

- Backend suite: 68 tests discovered, 66 passed, 2 conditional database tests skipped, no failures or errors. The separate live checks below exercise PostgreSQL concurrency.
- Frontend production build and targeted TypeScript lint passed. The build retains an existing bundle-size warning.
- Desktop and mobile browser checks passed using synthetic screenshot fixtures: four metrics, prescription rows, 950px dialog, clinical-review restriction, exact dispensing payload, refreshed quantities, invalid-quantity prevention, responsive width and no React errors.
- Real HTTP API: 41 assertions passed against the updated application on port 8084 and local PostgreSQL 17. V38 was successfully applied. Tests cover recorded clinical clearance, clinic stock positions, exact partial quantities, validation, concurrent different prescriptions, concurrent supplies of the same item, stock overspending, bulk rollback and successful commit, ledger totals, audit counts and licence enforcement. The harness confirmed removal of all its temporary records after the run.

- Real browser integration passed: review-only dialog, recorded clearance, a two-unit partial supply, eight units remaining on the prescription, two units left in stock, persisted review attribution and no React errors. The combined harness completed 42 assertions (41 API assertions plus the browser flow), then confirmed cleanup.

## Evidence and reproduction

- Unit reports: `target/surefire-reports/TEST-*.xml`.
- Frontend build: `target/pharmacy-frontend-build.log`.
- Live HTTP results: `target/pharmacy-final-live-results.txt`.
- Browser scripts: `docs/testing/pharmacy-visual.cjs` and `docs/testing/pharmacy-live.cjs`.
- Screenshots: `target/pharmacy-dashboard-desktop.png`, `target/pharmacy-dispense-desktop.png`, `target/pharmacy-review-desktop.png`, and corresponding mobile captures.

The screenshot fixtures reproduce the supplied example content; production screens load actual clinic data. Existing prescription items require a recorded review and linked inventory product before further dispensing. Restart the normal backend and frontend development servers to load the updated code. Verification used temporary ports 8084 and 5176; those test servers were stopped after completion. Existing development-server processes were not replaced.

