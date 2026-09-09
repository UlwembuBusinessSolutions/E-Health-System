# IAM-US-011: Scope a user to specific clinics

## Checklist

- UserRoleAssignment maps the existing clinic-scoped user_roles table. Staff creation assigns the selected role at each assigned facility.
- Clinic context switcher API validates X-Clinic-ID against current tenant assignments and active facilities on every request.
- Patient, visit, queue, prescription, manual-verification and prior-triage queries enforce clinic scope. Registration records the active clinic.
- Audit events retain their subject facility and separately record clinicContextId. Clinic selection and assignment changes are audited.
- Tests cover access denial, context switching, role isolation, patient queries, assignment validation and context cleanup.

## API

All requests use the existing tenant header and bearer token.

`PUT /api/v1/admin/staff/{userId}/clinics` replaces a staff member's assigned clinics:

```json
{"clinicIds":["<clinic-a-uuid>","<clinic-b-uuid>"],"primaryClinicId":"<clinic-a-uuid>"}
```

`GET /api/v1/admin/staff/{userId}/clinics` loads the current `primaryClinicId`, `clinicIds` (including unavailable assignments), and `tenantWide` flag for the staff editor. This read also requires a tenant-wide ORG_ADMIN.

Only a tenant-wide ORG_ADMIN can change assignments. Existing roles at retained clinics are preserved. New clinics inherit the user's previous primary clinic roles. This endpoint does not narrow users with tenant-wide roles; those assignments must first be removed through role administration. Clinics must exist and be active in the current tenant.

`GET /api/v1/auth/clinic-context` returns `activeClinicId` and available `clinicIds`. `GET /api/v1/facilities` returns the caller's available facilities with names.

Select a clinic with `PUT /api/v1/auth/clinic-context`, supplying `X-Clinic-ID: <clinic-uuid>`. Send the same header on subsequent requests. The selection is request-scoped, so concurrent tabs can work at different clinics. Without the header, the primary clinic is used if accessible, otherwise the sole accessible clinic. An ambiguous or missing assignment requires explicit selection before clinical data access. Invalid UUIDs return 400; unassigned/inactive clinic selection returns 403. Out-of-clinic record IDs return 404.

Roles are reloaded for the active clinic on each authenticated request. Scope changes therefore apply to existing tokens without waiting for another login. Tenant-wide roles retain access to all active facilities, but clinical queries still require an active clinic. Tenant administrators can use `/api/v1/admin/audit` for the full organization audit trail; `/api/v1/audit` is clinic-scoped.

## Migration

V23 expands legacy primary-clinic roles into existing additional facility assignments. Patient clinic ownership is backfilled only from a single-clinic visit history, or the registering user's primary facility when there are no visits. Ambiguous/unattributed legacy patients retain a null clinic and are excluded from scoped queries; review and attribute those rows before operational rollout. Historical audit context remains null because it cannot be reconstructed reliably.

The companion frontend now includes an Active clinic selector, clinic access editing from each staff row, and an Audit trail view with clinic context. Its shared API client sends X-Clinic-ID for the selected clinic. Switching replaces the clinical query cache and mounted forms so the previous clinic's records do not remain visible. Selection is restored from tab-local session storage and checked against current backend assignments.

## Verification

Run `mvn test` for the unit suite. Run `mvn test -Dclinic.postgres.tests=true` to also validate all tenant migrations and real repository queries against the configured PostgreSQL server. The database test creates a unique `clinic_test_*` schema and removes it in cleanup; it does not use existing tenant records.

Run `mvn test -Dclinic.live.tests=true -Dtest=ClinicScopeLiveApiTest` for live HTTP verification. It starts the complete application on a temporary port, signs in test users, and checks assignment, switching, patient isolation, immediate revocation, audit context, tenant isolation and CORS. It requires database-creation privileges on the configured PostgreSQL server, creates a disposable `live_clinic_test_*` database, and stops the server and removes that database afterward.
