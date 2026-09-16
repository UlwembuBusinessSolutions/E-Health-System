# PHRM-US-005 Browser Test Results

Date: 2026-09-14T12:01:02.082Z
Status: PASS

## Live environment

- Backend: http://localhost:58639
- Frontend: http://localhost:5180
- Tenant: decline-live
- Clinic: d79d3c4e-34a6-4f2d-8c69-6c607f121bea

## Checks

- Prescriber signed in through the live frontend
- Pharmacist sees prior dispensing date, facility, and active supply before deciding
- Decline saves the reason and removes dispensing actions
- Prescriber receives a navigable decline notification
- No JavaScript errors or unexpected API failures

## Screenshots

- [Cross-clinic unexpired dispensing warning](PHRM-US-005-browser-screenshots/01-duplicate-warning.png)
- [Decline form with mandatory reason code](PHRM-US-005-browser-screenshots/02-decline-reason.png)
- [Saved decline decision](PHRM-US-005-browser-screenshots/03-declined.png)
- [Prescriber notification in the browser](PHRM-US-005-browser-screenshots/04-prescriber-notification.png)
