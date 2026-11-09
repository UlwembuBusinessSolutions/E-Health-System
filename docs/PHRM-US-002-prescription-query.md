# PHRM-US-002 — Prescription query with prescriber

A pharmacist can preview the clinical/guideline warnings for a prescription, then raise a documented query. Raising it changes the prescription status to `HELD`, removes it from the dispensing queue, creates a durable prescriber notification, and sends an SSE event when the prescriber is connected.

## API

- `GET /api/v1/prescriptions/{prescriptionId}/query-preview` returns clinical alerts before a query is raised.
- `POST /api/v1/prescriptions/{prescriptionId}/queries` with `{ "reason": "..." }` creates the query and holds the prescription.
- `POST /api/v1/prescription-queries/{queryId}/response` with `{ "response": "..." }` is restricted to the original prescriber. It returns the prescription to `PENDING`.
- `GET /api/v1/prescription-queries` lists the active-clinic collaboration history.
- `GET /api/v1/prescription-query-notifications` provides the authenticated user's reliable notification inbox; `GET /api/v1/prescription-query-notifications/stream` is its real-time SSE channel.

The existing prescription queue/detail response now includes `latestQuery` after a response, so the returned prescription carries the reason, warning, response and response time.

## Frontend

- Prescription detail: pharmacists can check guideline warnings, raise a query, and place the prescription in `HELD`.
- Prescription detail: held prescriptions show a hold banner and do not expose the dispense action.
- Prescription queries: prescribers can view open collaboration items and submit a response.
- Pharmacy dashboard/list: open query count and held status are visible in the pharmacy workspace.

## Verification

- `npm run build` in the frontend workspace.
- `mvn '-Dtest=PrescriptionQueryServiceTest,PrescriptionQueryLiveApiTest' test`
- `mvn '-Dtest=PrescriptionQueryLiveApiTest' '-Dprescription.query.live.tests=true' '-Dprescription.query.browser.hold=true' test`
- `node scripts/verify-prescription-query-browser.cjs "C:\Users\nhlah\Downloads\E-Health-System-dev-frontend-ulwembu (1)\E-Health-System-dev-frontend-ulwembu"`

Browser evidence: [PHRM-US-002 Browser Test Results](PHRM-US-002-browser-test-results.md).
