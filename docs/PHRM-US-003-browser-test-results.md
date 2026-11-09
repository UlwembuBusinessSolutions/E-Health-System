# PHRM-US-003 Browser Test Results

Date: 2026-09-14T08:46:02.161Z
Status: PASS

## Live Environment

- Backend: http://localhost:50979
- Frontend: http://localhost:5180
- Tenant: clinical-live
- Clinic: 4d3717bc-4cff-43e9-bb9b-c83faf6e1d43

## Checks

- Nurse signs in through the real frontend against the live backend
- Prescribing displays ranked clinical alerts before submitting a high-risk combination
- Prescribing succeeds after an explicit clinical override reason
- Dispensing displays the same clinical alerts before release
- Dispensing succeeds after a pharmacist override reason
- Backend confirms the browser-created prescription is DISPENSED
- No JavaScript page errors or failed API responses occurred during the browser flow

## Screenshots

- [Prescribing blocks until override reason is recorded](PHRM-US-003-browser-screenshots/01-prescribe-alerts.png)
- [Prescription created after clinical override](PHRM-US-003-browser-screenshots/02-prescription-pending.png)
- [Dispensing blocks until pharmacist override reason is recorded](PHRM-US-003-browser-screenshots/03-dispense-alerts.png)
- [Prescription dispensed after pharmacist override](PHRM-US-003-browser-screenshots/04-dispensed.png)
