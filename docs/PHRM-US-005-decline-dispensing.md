# PHRM-US-005: Decline to dispense

The pharmacy client should call `GET /api/v1/prescriptions/{id}/duplicate-warnings` before dispensing. Each match identifies the previously dispensed prescription, drug, dispensing date, facility name and ID, and date through which the patient's supply is recorded as active. Matches are patient-wide across clinics in the same tenant, while the requested prescription remains limited to the active clinic.

`POST /api/v1/prescriptions/{id}/dispense` accepts an optional `coverageUntil` ISO date. A prior dispense can only be classified as unexpired when this date was recorded; historical rows and new rows without a date are excluded from the warning rather than being treated as active supply without evidence.

To decline a pending prescription, call `POST /api/v1/prescriptions/{id}/decline` with `{"reasonCode":"DUPLICATE_SUPPLY","reasonDetail":"Patient has medication at home"}`. Codes are `DUPLICATE_SUPPLY`, `CLINICALLY_INAPPROPRIATE`, `PATIENT_HAS_SUFFICIENT_SUPPLY`, and `OTHER`. `OTHER` requires detail. The action requires pharmacy manage permission and a current dispensing license. It removes the prescription from the pending queue, persists the reason, creates a prescriber inbox entry, and appends an audit event. Declined prescriptions cannot be dispensed or queried.

Read the recorded decision at `GET /api/v1/prescriptions/{id}/decline`. Prescribers read their own notifications at `GET /api/v1/prescription-decline-notifications`; each entry contains the prescription ID and decline ID for navigation and correlation.

The frontend queue opens the prescription review screen. That screen loads the duplicate warning before enabling dispense, offers the reason-coded decline action, and shows the persisted reason after submission. The prescriber's pharmacy query page includes the decline notification with a link back to the prescription.

The [live browser test results](PHRM-US-005-browser-test-results.md) include screenshots of the warning, decline form, recorded decision, and prescriber notification. The live HTTP test provisions two clinics in a temporary tenant database and verifies the cross-clinic warning, mandatory reason, notification, and absence of a stock movement.
