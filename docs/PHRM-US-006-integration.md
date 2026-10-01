# PHRM-US-006: integrated pharmacy dashboard

## Delivered workflow

The pharmacy landing page uses the supplied dashboard and dialog design: a full-width header, four live summary cards, a prescription table, batch stock and stock ledger panels, and a 950px prescription dialog. The mobile layout stacks cards and panels, with horizontal scrolling inside tables. Native modal dialogs provide keyboard focus containment and Escape/Close/Cancel controls.

The screenshot names and numbers are visual-test fixtures only. The application displays actual clinic data. A clinic selector appears when more than one facility is available. The existing stock, products and ledger pages remain accessible below the dashboard. Prescription lookup, printing, out-of-stock marking and prescriber contact remain under Prescription tools.

The reviewed product supplies the pack size and base unit. The quantity input accepts any positive whole base-unit quantity within both the prescription remainder and the selected batch balance. It does not require full-pack multiples. Multiple eligible stock positions expose a batch/location selector, ordered by expiry. Submission sends the actual product, batch and location IDs; repeated clicks are blocked while the request is in progress. The queue, stock and ledger refresh after a supply, and API rejections remain visible in the dialog.

An uncleared item opens the read-only clinical-review dialog from the screenshots. The separate Prescription tools panel records a licensed pharmacist's review, with product selection, outcome and required note. Review is not inferred from a drug name or fabricated by the client.

## Backend and migration

V38 adds product_id, clinical_check_status, clinical_check_note, reviewed_by and reviewed_at to prescription items. Existing items start at REVIEW_REQUIRED; historical dispensing does not establish clinical clearance. A pharmacist must review and link remaining items before dispensing. A known product cannot be changed after a supply. Clinical review and dispensing both serialize on the prescription row. Existing ledger account locks and the outer transaction preserve exact stock deductions, prescription quantities and audit entries.

New endpoints:

- POST /api/v1/prescriptions/{id}/items/{itemId}/review with productId, status (PASSED or REVIEW_REQUIRED) and note. Requires pharmacy manage access and a current SAPC licence; stores reviewer/time and an audit event.
- GET /api/v1/pharmacy/stock/positions?facilityId=... returns clinic-specific account, product, batch and location IDs; pack/base-unit metadata; physical and eligible available quantities; expiry and reorder information. Expired, held or inactive stock is not available to dispense. Zero-stock assortment entries remain visible.

Existing dispensing endpoints require stock selections and exact quantities as documented in PHRM-US-006.md. They now also enforce recorded clinical clearance and product matching. Expiry uses the clinic timezone. New ledger entries display the prescription serial as their source reference; item identity remains recorded in the transaction key and item audit.

## Verification

| Story checklist | Implementation |
| --- | --- |
| Partial quantity handling | Exact positive base-unit quantities, cumulative supplied quantity and remaining quantity, partial/completed status |
| Transactional stock decrement | Prescription, stock account, ledger and audit updates commit or roll back together |
| Concurrency test | Real simultaneous HTTP requests cover different prescriptions, the same item and insufficient shared stock |
| Tests | Backend unit suite, frontend build/lint, screenshot-fixture browser checks and live API harness |

Build logs, live-test logs and browser screenshots are in target/pharmacy-*.

- Backend: mvn -Dnet.bytebuddy.experimental=true test on the installed Java 25 (project target remains Java 21).
- Frontend: npm run build and oxlint on the changed TypeScript files.
- Live HTTP: docs/testing/LivePartialDispensingCheck.java covers exact quantities, concurrent supplies, over-dispensing protection, bulk rollback, ledger/audit consistency, clinical-review enforcement and clinic stock positions.
- Browser: docs/testing/pharmacy-visual.cjs exercises screenshot fixtures at desktop and mobile sizes; docs/testing/pharmacy-live.cjs drives a real review and partial supply through the frontend and backend.

The browser scripts expect Playwright installed at target/pharmacy-browser/node_modules/playwright, Chrome at its standard Windows path, frontend port 5176 and the isolated test API on port 8084. They run from the backend project directory. The visual script mocks only the backend API, never the frontend modules. For the live browser test run the Java harness with LIVE_API_BASE=http://localhost:8084 and LIVE_UI_HOLD=true; wait for UI_FIXTURE_READY, then run the browser script. It signals completion so the Java harness removes all temporary fixture records. Supply database credentials through environment variables. Do not run these fixture-creating scripts against production.

Set LIVE_UI_AUTORUN=true as well to launch the real browser test directly from the Java harness and retain the fixture until the browser finishes. This avoids coordinating two terminal sessions.
