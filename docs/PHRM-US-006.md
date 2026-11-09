# PHRM-US-006: Flexible and partial dispensing

Quantities are whole stock base units: dispensing 7 tablets from a pack of 30 deducts exactly 7, leaving 23. Pack size is not a dispensing multiple. Fractional base units are not supported by the existing integer stock model.

POST /api/v1/prescriptions/{id}/items/{itemId}/dispense now requires:

```json
{"productId":"UUID","batchId":"UUID","locationId":"UUID","quantity":7}
```

The prescription response includes dispensedQuantity per item. An incomplete supply has PARTIALLY_DISPENSED status; subsequent supplies may fill the remaining quantity. The existing dispensing record shows the latest dispenser/time; each supply has an immutable DISPENSE stock transaction with the prescription serial as its visible reference, item identity in the transaction key and audit, and exact delta and balance before/after.

The integrated dashboard and clinical-clearance requirements introduced with V38 are documented in [PHRM-US-006-integration.md](PHRM-US-006-integration.md).

Bulk POST /api/v1/prescriptions/{id}/dispense requires an items array of {itemId, stock}, where stock has the fields above. All selected lines commit together. Clients using the previous bodyless actions must send stock selections. No drug-name matching or implicit batch selection is performed.

Prescription row locks serialize cumulative quantities and status updates. Stock account write locks serialize clinic stock deductions. Stock, prescription quantities, latest dispensing summary and audit commit in the same transaction. Insufficient stock returns 409; invalid quantity, stock selection or expired batch returns 400. Existing pharmacy permission and dispensing licence checks apply.

Migration V37 backfills dispensed quantities on historical completed items without fabricating historical stock movements.

Tests: PartialDispensingTest, PrescriptionStockServiceTest, DispensingConcurrencyTest. For the PostgreSQL test set PHARMACY_TEST_JDBC_URL to an isolated PostgreSQL database accessible with schema creation privileges. The test creates and removes a unique schema; never point this variable at production. Run mvn test. Without that variable the database test is skipped.

Local validation on Java 25 used mvn -Dnet.bytebuddy.experimental=true test because the existing Byte Buddy version otherwise rejects Java 25. The project targets Java 21. The PostgreSQL concurrency test ran against a temporary local PostgreSQL 17 instance.
