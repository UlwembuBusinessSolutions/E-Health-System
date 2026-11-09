# PHRM-US-002 Browser Test Results

Date: 2026-09-14T10:42:49.276Z
Status: PASS

## Live Environment

- Backend: http://localhost:51547
- Frontend: http://localhost:5180
- Tenant: query-live
- Clinic: 54d04dcc-fa56-4a28-94ea-b3546ebe9f0c

## Checks

- Prescriber signs in through the real frontend against the live backend
- Guideline deviation flagging appears before the pharmacist opens the query
- Raising a query places the prescription in HELD state
- Prescriber receives the collaboration item and responds in the browser
- Pharmacist sees the returned prescription with the prescriber response visible
- Backend confirms the browser query returned the prescription to PENDING
- No JavaScript page errors or unexpected failed API responses occurred during the browser flow

## Screenshots

- [Guideline deviation shown before raising query](PHRM-US-002-browser-screenshots/01-guideline-warning-before-query.png)
- [Prescription held after pharmacist query](PHRM-US-002-browser-screenshots/02-prescription-held.png)
- [Prescriber responds from query inbox](PHRM-US-002-browser-screenshots/03-prescriber-response.png)
- [Prescription returns to queue with response visible](PHRM-US-002-browser-screenshots/04-returned-to-queue-response-visible.png)
