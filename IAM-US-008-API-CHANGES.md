# IAM-US-008 — Tenant-scoped role assignment API changes

All tenant APIs below require `X-Tenant-ID`. When a bearer token's `tenant`
claim differs from the resolved tenant, the API returns `403` with
`Access to another tenant is forbidden.` and records
`CROSS_TENANT_ACCESS_DENIED` in the target tenant audit log.

| Method | API | Tenant-isolation behavior |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Issues a token containing the active tenant schema. |
| POST | `/api/v1/auth/logout` | Rejects a token from another tenant. |
| POST | `/api/v1/auth/unlock` | Rejects a token from another tenant. |
| GET | `/api/v1/navigation` | Rejects a token from another tenant. |
| GET | `/api/v1/organization` | Rejects a token from another tenant. |
| GET, POST | `/api/v1/facilities` | Rejects a token from another tenant. |
| GET | `/api/v1/roles` | Reads roles from the active tenant schema only. |
| POST | `/api/v1/admin/staff` | Rejects a token from another tenant and validates role/facility IDs in the active tenant before assignment. |
| POST | `/api/v1/admin/staff/{id}/offboard` | Rejects a token from another tenant. |
| POST | `/api/v1/admin/staff/{id}/compliance` | Rejects a token from another tenant. |
| POST | `/api/v1/admin/staff/{id}/photo` | Rejects a token from another tenant. |
| POST | `/api/v1/admin/organization/logo` | Rejects a token from another tenant. |

The password-reset endpoints remain deliberately public, but their user
lookups are still scoped to the tenant resolved by `TenantFilter`.
