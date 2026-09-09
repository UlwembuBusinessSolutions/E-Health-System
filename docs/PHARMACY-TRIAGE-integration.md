# Pharmacy and Triage Integration

## Connected Workflows

- `/app/triage`: live assessment counts and today's visits awaiting observations.
- `/app/triage/capture`: visit selection within the active clinic.
- `/app/triage/capture/:visitId`: blank observation form, range validation and explicit confirmation of out-of-range readings. Editing any reading resets confirmation.
- `/app/triage/list`: live patient search and reading filters.
- `/app/triage/assessments/:id`: persisted observations and prior readings; links to another capture or prescription for the same visit.
- Pharmacy creation validates every medication row, including positive integer quantities. Detail dispensing refreshes prescription, queue and dashboard queries, including after rejected requests.
- Pharmacy lists and both modules use the shared clinic context. API failures are not displayed as empty queues.

## API Contracts

- `GET /api/v1/triage-assessments`: `{items: [{assessment, patientName, patientMpi}]}` for the active clinic.
- `GET /api/v1/triage-assessments/{id}`: `{assessment, priorAssessment}`; missing or other-clinic records return 404.
- `POST /api/v1/visits/{visitId}/triage-assessments`: existing capture payload; invalid ranges or missing confirmation return 422 with field errors.
- `GET /api/v1/visits/{id}`: includes patient name and MPI, matching the visit list contract.
- Existing prescription create/list/detail/queue/stats/dispense endpoints remain unchanged.
- Requests carry bearer authentication, `X-Tenant-ID`, and `X-Clinic-ID`. Triage reads require RECQ VIEW; capture requires RECQ MANAGE. Existing Pharmacy permission and registration checks remain enforced.

No new database migration is required for this integration. Restart the backend to load the new controllers and error mapping.

## Verification

Run `npm run build` in the frontend repository.

Run `.tools/apache-maven-3.9.9/bin/mvn.cmd -o test -Dclinic.live.tests=true -Dtest=ClinicScopeLiveApiTest,TriageAssessmentServiceTest,PrescriptionServiceLicenseGuardTest,PrescriptionServicePatientIdentityTest` in the backend repository. The live test creates and removes an isolated PostgreSQL database and uses real HTTP requests.

For browser verification, add `-Dclinic.browser.hold=true`, then run `node target/verify-clinical-workflow.cjs` while the fixture is available. This temporary browser harness forwards frontend API requests to the isolated test server; it does not alter the frontend's configured backend URL.
