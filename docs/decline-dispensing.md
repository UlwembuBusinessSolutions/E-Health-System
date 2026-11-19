# PHRM-US-005: decline to dispense

The pharmacy prescription dialog displays prior supplies for the current patient and reviewed catalog product across every clinic in the current tenant. Each warning includes the dispensing date, clinic, quantity and inclusive supply end date. A supply ending today still warns; expired coverage does not. A further partial supply of the same prescription item is treated as a continuation. Older dispensing summaries without coverage dates appear as **unknown coverage** warnings; matching unmapped legacy medicines uses their trimmed, case-insensitive prescribed name. Staff must confirm what medication remains rather than treating missing dates as proof that supply expired. Other tenants' records are not searched.

Dispensing now requires an explicit `supplyUntil` date based on the prescribed regimen; the application does not infer duration from free-text dosage or use stock batch expiry as patient coverage. The date must be on or after the clinic's current date. Every partial supply writes an immutable `prescription_supplies` event in the same transaction as stock movement, prescription quantity and audit. A patient row lock serializes concurrent supplies across prescriptions and clinics before checking history.

If active or unknown prior supplies exist, dispensing returns HTTP **409** with `code: DUPLICATE_DISPENSING` and a `warnings` array. Staff can decline or explicitly acknowledge every warning. Acknowledgement includes the displayed supply IDs; a newly recorded supply causes another warning even if a stale screen submitted `acknowledgeDuplicateSupply: true`. The frontend refreshes the prescription on conflict. Acknowledgement is audit-recorded.

## API

- `GET /api/v1/prescriptions/decline-reasons`: supported reason codes.
- `GET /api/v1/prescriptions/{id}/items/{itemId}/duplicate-warnings`: warnings (`items` array).
- Prescription responses also include each item's `duplicateWarnings`, `declineReason`, `declineNote`, `declinedBy` and `declinedAt`.
- `POST /api/v1/prescriptions/{id}/items/{itemId}/decline`: body `{"reasonCode":"SUFFICIENT_MEDICATION","note":"Patient has adequate medication at home"}`; returns 204.
- Existing single-item and batch dispensing endpoints accept stock plus `supplyUntil`, `acknowledgeDuplicateSupply` (defaults false), and `acknowledgedSupplyIds` (defaults empty).

Example dispensing stock command:

```json
{
  "productId": "<catalog-product-uuid>",
  "batchId": "<batch-uuid>",
  "locationId": "<location-uuid>",
  "quantity": 7,
  "supplyUntil": "2026-10-09",
  "acknowledgeDuplicateSupply": true,
  "acknowledgedSupplyIds": ["<displayed-prior-supply-uuid>"]
}
```

Valid decline reasons are `SUFFICIENT_MEDICATION`, `DUPLICATE_THERAPY`, `CONTRAINDICATION`, `INTERACTION`, `DOSAGE_CONCERN` and `OTHER`. A reason is mandatory; `OTHER` also requires a nonblank explanation. Notes are limited to 500 characters. The authenticated actor needs PHRM:MANAGE and current SAPC dispensing registration. Fully dispensed items cannot be declined. Declining a partially supplied item preserves its supplied quantity and all stock history. Declined items cannot be reviewed again, marked out of stock or dispensed through any item mutation method. A new prescription is required if treatment is reconsidered.

The decline, durable prescriber message and `PRESCRIPTION_ITEM_DECLINED` audit entry commit together. Audit contains the previous status, reason, note and previously supplied quantity. Prescriber email is requested **after commit**, using the existing tenant mail settings and asynchronous delivery worker with its three attempts. SMTP delivery depends on configured mail infrastructure; the saved message remains available if delivery fails. Missing prescriber email or organization prevents the decision from being saved. Repeated decline requests are rejected without another message or audit event.

Pending items on a mixed prescription stay in the dispensing queue. Once resolved, a prescription containing declined items reports `DECLINED` unless remaining out-of-stock items keep it `OUT_OF_STOCK`. Declined lines are excluded from actionable queue rows. Serial lookup, patient medication history and prescription printouts retain the decision and partial supply details.

## Deployment and validation

Restart the backend to apply **V39__decline_dispensing.sql** through the normal tenant Flyway runner. V37 remains unchanged. Update frontend and API clients together because dispensing now requires a coverage date. Restart the connected frontend development server to load its updated controls.

`DeclineDispensingTest` covers reason validation, authorization, partial quantity preservation, terminal guards, rollup, cross-clinic warnings, stale acknowledgement, timezone boundaries, unknown historical coverage and commit/rollback email timing. `DeclineDispensingApiTest` checks request validation and structured 409 warnings. `DeclineDispensingDatabaseTest` applies V39 in a disposable PostgreSQL schema and verifies repository matching, expiry boundaries, historical coverage, constraints and rollback. Set the existing `PHARMACY_TEST_JDBC_URL`, `PHARMACY_TEST_DB_USER` and `PHARMACY_TEST_DB_PASSWORD` variables to run database tests.

`docs/testing/decline-dispensing-browser.cjs` exercises the real frontend with synthetic intercepted API responses. Set `DECLINE_UI_URL` to a running frontend's pharmacy URL. It checks warning display, acknowledgement and date payloads, mandatory decline explanation, preservation of already supplied quantity, history lookup, disabled mutation controls, mobile width and React errors. It does not send messages or modify clinic data.
