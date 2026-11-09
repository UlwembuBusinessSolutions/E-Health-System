# RECQ-US-005: Complete, stop or cancel a token

- [x] Resume logic: stopped tokens return to ISSUED with the same priority, issue time, number and identity.
- [x] Reason codes: PATIENT_LEFT, PATIENT_DECLINED, DUPLICATE_TOKEN, ISSUED_IN_ERROR. Cancellation requires a supported code.
- [x] State machine: ISSUED → CALLED → IN_SERVICE → COMPLETED; CALLED may also complete directly. ISSUED, CALLED and IN_SERVICE may stop. STOPPED may resume. Any nonterminal state may cancel. Completed and cancelled tokens are terminal.
- [x] Audit hook: each successful transition records actor, clinic, token, previous/new status and cancellation reason in the same transaction. Audit timestamps use the existing audit service. Optimistic locking rejects competing updates.
- [x] Tests: lifecycle transitions, timestamps, priority preservation, reason validation, audit payloads, clinic isolation, permissions and conflicting updates.

The queue screen shows waiting, called, in-service and stopped tokens. Complete and cancel remove tokens from this view. Call-next continues selecting only ISSUED tokens in priority/issue-time order. The open-token view is loaded from the server, so refreshing the screen retains access to stopped and called tokens.

API additions:

- GET `/api/v1/queue/open?facilityId=...`: nonterminal tokens, with patient details.
- GET `/api/v1/queue/cancellation-reasons`: supported cancellation codes.
- POST `/api/v1/queue/tokens/{id}/transition`: `{ "action": "CANCEL", "reasonCode": "PATIENT_LEFT" }`. Actions are START_SERVICE, COMPLETE, STOP, RESUME and CANCEL. Missing/invalid request values return 400; invalid lifecycle transitions and concurrent edits return 409.

Token responses now include completedAt, stoppedAt, cancelledAt and reasonCode. Transition writes require RECQ:MANAGE and are scoped to the selected clinic. Professional Nurse already has this permission through V13.

Deployment requires tenant migration V24 before using the updated API. Reason codes are an initial implementation set because the story does not prescribe a catalogue. No visit record is deleted by a token transition.

## Live API verification

Run from the backend directory in PowerShell:

```powershell
& ./.tools/apache-maven-3.9.9/bin/mvn.cmd -o test '-Dqueue.live.tests=true' '-Dtest=QueueLifecycleLiveApiTest'
```

The opt-in test starts an actual HTTP server on a random port and creates a temporary PostgreSQL database. It applies the tenant migrations, including V24, logs in with a Professional Nurse account, and checks completion timestamps, queue removal, cancellation reasons, stop/resume priority and issue-time preservation, audit entries, and role/clinic restrictions. Persistence checks query PostgreSQL directly in addition to reloading queue and audit data through HTTP. The temporary database and HTTP server are removed in a finally block.

The default PostgreSQL connection matches docker-compose local development settings. Override it using `queue.db.url`, `queue.db.username`, and `queue.db.password` JVM properties if necessary. The database user must be able to create temporary databases. Test configuration is in `src/test/resources/queue-live-test.properties`, so this test does not depend on application.yml. No existing clinic records are modified.

Unauthenticated requests receive 403 under the application's current Spring Security configuration; invalid lifecycle transitions receive 409 and invalid cancellation request bodies receive 400.

Browser verification also passed against the real frontend and backend. See [browser results and screenshots](RECQ-US-005-browser-test-results.md) for coverage and repeat instructions.
