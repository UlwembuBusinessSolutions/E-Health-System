# PHRM-US-006 live API verification

Date: 2026-09-28
Target: http://localhost:8082 (updated workspace build, live-test profile)
Database: local PostgreSQL 17.8, ulwembut / demo_clinic
Result: **37 assertions passed** over real HTTP requests, with database verification.

## Verified behavior

- Health returned UP; Flyway applied V37 successfully.
- Temporary pharmacist login: 200. Receipt of 100 base units: 201.
- Unauthenticated dispensing: 403 (current security configuration).
- Zero, negative, excessive and missing quantities/body: 400.
- Another clinic's stock and expired batches: 400; stock unchanged.
- Dispensing 7 tablets from a 30-tablet pack: 204, exact stock reduction from 100 to 93.
- Prescription GET: 200, PARTIALLY_DISPENSED with dispensedQuantity=7.
- Remaining 23 tablets: 204; further supply beyond the prescription: 400.
- Two concurrent prescriptions dispensing 11 and 13 units: both 204, balance 70 to 46.
- Two concurrent 7-unit requests against one 10-unit item: one 204, one 400; only 7 deducted.
- Two concurrent 30-unit requests with 39 available: one 204, one 409; balance 9.
- Bulk request for 5+5 with 9 available: 409; stock and both prescription quantities rolled back.
- Bulk request for 2+3: 204; exact final balance 4.
- Duplicate item in bulk request: 400.
- Ledger GET: 200; exactly one receipt and eight successful supply entries.
- Ledger sum equals physical stock (4); exactly eight committed dispensing audits and seven latest-item summaries.
- Expired SAPC licence: 403; stock unchanged.

## Reproduction and cleanup

Harness: testing/LivePartialDispensingCheck.java. Run as a Java source launcher with the project's dependencies on the classpath. Configure LIVE_API_BASE, LIVE_DB_URL (JDBC), LIVE_DB_USER and LIVE_DB_PASSWORD through environment variables. It targets the local demo-clinic tenant and requires its migrated schema and ORG_ADMIN role. Use only a development/test database.

The harness creates UUID-tagged synthetic facilities, patient, visit, pharmacist, prescriptions and stock. A finally block removes its fixture rows, including receipts, ledger entries and audits. Existing patient, staff and stock records were not edited. V37 remains applied. The temporary API process on port 8082 was stopped after testing.

Raw output: target/live-pharmacy-results.txt (local build artifact). Initial harness-only expectation errors were corrected before the successful run; no production code changes were required.

Concurrency used overlapping HTTP requests on one machine, not separate physical terminals. Client retry/idempotency behavior and frontend integration were not covered.
