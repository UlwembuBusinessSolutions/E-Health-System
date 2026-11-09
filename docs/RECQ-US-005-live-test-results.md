# RECQ-US-005 live API test results

Date: 2026-09-10

**PASS**: 53 real HTTP response assertions, with additional PostgreSQL and response-content assertions.

Environment: temporary Spring Boot/Tomcat server and isolated local PostgreSQL database. Professional Nurse performs the queue operations; synthetic admin and viewer accounts verify audit and access restrictions. V24 migration applied successfully.

| Check | Result |
| --- | --- |
| Called ? Completed; completion timestamp persisted; token removed from both queue views | PASS |
| Called ? InService ? Completed | PASS |
| Stop ? Resume; original priority, issue time, token number and identity preserved | PASS |
| Resumed token ranks ahead of newer tokens at the same priority | PASS |
| Missing, blank and unknown cancellation codes rejected with 400; no cancellation audit or state change | PASS |
| All supported cancellation codes accepted; cancellation timestamp and reason persisted | PASS |
| Cancellation and resume audit entries readable through API, including nurse identity and clinic | PASS |
| Invalid/terminal transitions rejected with 409 | PASS |
| Viewer, unauthenticated and unassigned-clinic access rejected with 403 | PASS |
| Another clinic cannot mutate the token | PASS |
| Temporary server stopped and test database removed | PASS |

The initial run stopped because the test expected 401 for an unauthenticated request. Existing security configuration returns 403. Correcting this test expectation produced a successful complete run; no application code changes were needed.

Latest rerun: PASS. Corrected the resume assertion to compare persisted timestamps before and after resume: Java may emit nanoseconds in the initial response, while PostgreSQL stores microseconds. No application code change was required.

## HTTP results

- Login admin => 200
- Login nurse => 200
- Login viewer => 200
- Create synthetic patient => 201
- Nurse creates visit and token => 201
- Call issued token => 200
- COMPLETE => 200
- Reload waiting queue => 200
- Reload open queue => 200
- COMPLETE => 409
- RESUME => 409
- CANCEL => 409
- Issue NORMAL test token => 201
- Issue PRIORITY test token => 201
- Reload waiting queue => 200
- COMPLETE => 409
- STOP => 403
- STOP => 403
- STOP => 409
- STOP => 403
- RESUME => 409
- Priority is called first => 200
- START_SERVICE => 200
- STOP => 200
- Reload waiting queue => 200
- Reload open queue => 200
- Issue PRIORITY test token => 201
- RESUME => 200
- Reload waiting queue => 200
- Resumed token called at original position => 200
- START_SERVICE => 200
- COMPLETE => 200
- Reject missing/invalid cancellation reason => 400
- Reject missing/invalid cancellation reason => 400
- Reject missing/invalid cancellation reason => 400
- STOP => 200
- CANCEL => 200
- RESUME => 409
- CANCEL => 409
- CANCEL => 200
- Cancellation reason catalogue => 200
- Issue NORMAL test token => 201
- CANCEL => 200
- Issue NORMAL test token => 201
- CANCEL => 200
- Issue NORMAL test token => 201
- CANCEL => 200
- Issue NORMAL test token => 201
- CANCEL => 200
- Reload open queue => 200
- Reload waiting queue => 200
- Empty queue cannot call next => 409
- Read persisted audit via API => 200
