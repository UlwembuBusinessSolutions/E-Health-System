# IAM-US-009 Validation Checklist

## Quick Validation Script

Run this curl sequence against a live Ulwembu instance to validate AC1, AC2, and AC3:

### Prerequisites
```bash
export TENANT_HOST="http://localhost:8080"
export CLINIC_ORG="rama"  # Organization name
export ADMIN_EMAIL="admin@rama.local"
export ADMIN_PASS="<temporary-password-from-email>"

# Login and capture token
LOGIN=$(curl -s -X POST "$TENANT_HOST/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: $CLINIC_ORG" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\"}")

ADMIN_TOKEN=$(echo $LOGIN | jq -r '.token')
```

---

### AC1: All 13 baseline roles seeded

```bash
curl -s -X GET "$TENANT_HOST/api/v1/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" | jq '.items | map(.name) | sort'
```

**Expected Output (13 roles)**:
```json
[
  "Admin Staff",
  "Billing Administrator",
  "Clinician",
  "Compliance Officer",
  "Doctor",
  "Facility Manager",
  "ORG_ADMIN",
  "Occupational Health Practitioner",
  "Pharmacist",
  "Professional Nurse",
  "Queue Marshall",
  "Reporting Analyst",
  "Social Worker"
]
```

---

### AC2: Role permissions match published matrix

#### Test 1: ORG_ADMIN has full access
```bash
# Create a test staff member with ORG_ADMIN role
curl -s -X POST "$TENANT_HOST/api/v1/admin/staff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Admin",
    "email": "testadmin@rama.local",
    "employeeNumber": "ADM999",
    "contactNumber": "+27821234567",
    "roleId": "<ORG_ADMIN_role_id>"
  }'
```

**Expected**: 201 Created with staff record

#### Test 2: Pharmacist can only access PHRM:MANAGE
```bash
# Create a Pharmacist
curl -s -X POST "$TENANT_HOST/api/v1/admin/staff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Pharmacist",
    "email": "testpharm@rama.local",
    "employeeNumber": "PHARM001",
    "contactNumber": "+27821234568",
    "roleId": "<Pharmacist_role_id>"
  }'

# Try to register a patient (PREG:MANAGE - should fail)
PHARM_TOKEN=$(curl -s -X POST "$TENANT_HOST/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: $CLINIC_ORG" \
  -d '{"email": "testpharm@rama.local", "password": "<temp-pass>"}' | jq -r '.token')

curl -s -X POST "$TENANT_HOST/api/v1/patients" \
  -H "Authorization: Bearer $PHARM_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "idNumber": "9001015800081",
    "address": "123 Main",
    "contactNumber": "+27821234567",
    "nextOfKin": []
  }'
```

**Expected**: 403 FORBIDDEN
```json
{
  "message": "Your role doesn't have manage access to Patient Registration.",
  "details": null
}
```

#### Test 3: Pharmacist CAN create prescriptions (PHRM:MANAGE)
```bash
# Create a prescription (requires PHRM:MANAGE)
curl -s -X POST "$TENANT_HOST/api/v1/prescriptions" \
  -H "Authorization: Bearer $PHARM_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "visitId": "<existing-visit-id>",
    "items": [
      {
        "drugName": "Paracetamol",
        "dosage": "500mg",
        "quantity": 2
      }
    ]
  }'
```

**Expected**: 201 CREATED (or 404 if visit doesn't exist, but NOT 403)

---

### AC3: 403 for no-access, not empty results

#### Test 1: Clinician cannot access Pharmacy (no PHRM permission)
```bash
# Create a Clinician
curl -s -X POST "$TENANT_HOST/api/v1/admin/staff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Clinician",
    "email": "testclin@rama.local",
    "employeeNumber": "CLIN001",
    "contactNumber": "+27821234569",
    "roleId": "<Clinician_role_id>"
  }'

CLIN_TOKEN=$(curl -s -X POST "$TENANT_HOST/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: $CLINIC_ORG" \
  -d '{"email": "testclin@rama.local", "password": "<temp-pass>"}' | jq -r '.token')

# Try to view pharmacy queue (PHRM:VIEW - denied)
curl -s -X GET "$TENANT_HOST/api/v1/prescriptions/queue?facilityId=<facility-id>" \
  -H "Authorization: Bearer $CLIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected**: 403 FORBIDDEN (NOT 200 with empty array)
```json
{
  "message": "Your role doesn't have view access to Pharmacy.",
  "details": null
}
```

#### Test 2: Queue Marshall cannot access IAM (admin endpoint)
```bash
# Create a Queue Marshall  
curl -s -X POST "$TENANT_HOST/api/v1/admin/staff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Marshall",
    "email": "testmarshall@rama.local",
    "employeeNumber": "QM001",
    "contactNumber": "+27821234570",
    "roleId": "<Queue_Marshall_role_id>"
  }'

MARSHALL_TOKEN=$(curl -s -X POST "$TENANT_HOST/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: $CLINIC_ORG" \
  -d '{"email": "testmarshall@rama.local", "password": "<temp-pass>"}' | jq -r '.token')

# Try to list staff (IAM:VIEW - requires ORG_ADMIN)
curl -s -X GET "$TENANT_HOST/api/v1/admin/staff" \
  -H "Authorization: Bearer $MARSHALL_TOKEN" \
  -H "X-Tenant: $CLINIC_ORG" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected**: 403 FORBIDDEN (NOT 200 with empty array)

---

## Code-Level Validation

### Check Migration Files

1. **V6__seed_default_roles.sql**: Verify 9 base roles are created
   ```bash
   grep "INSERT INTO roles" src/main/resources/db/migration/tenant/V6__seed_default_roles.sql | wc -l
   # Expected: 1 line with 9 role INSERTs
   ```

2. **V12__role_permissions.sql**: Verify 4 additional roles + full matrix
   ```bash
   grep "INSERT INTO roles" src/main/resources/db/migration/tenant/V12__role_permissions.sql | wc -l
   # Expected: 1 line with 4 role INSERTs
   
   grep "INSERT INTO permissions" src/main/resources/db/migration/tenant/V12__role_permissions.sql | wc -l
   # Expected: 1 line with 40 permission INSERTs (20 modules × 2 levels)
   
   grep "INSERT INTO role_permissions" src/main/resources/db/migration/tenant/V12__role_permissions.sql | wc -l
   # Expected: 1 line with 216 role-permission grants
   ```

3. **V13__rbac_matrix_fix_visit_creation.sql**: Verify 4 clinical roles get RECQ:MANAGE
   ```bash
   grep -c "RECQ:MANAGE" src/main/resources/db/migration/tenant/V13__rbac_matrix_fix_visit_creation.sql
   # Expected: 4 (Doctor, Professional Nurse, Clinician, Occupational Health Practitioner)
   ```

### Check PermissionService

Verify NotAuthorizedException is thrown (not empty results returned):
```bash
grep -A5 "public void requireAccess" src/main/java/co/ehealth/platform/identity/PermissionService.java
```

Should show:
```java
if (!hasAccess(module, required)) {
    throw new NotAuthorizedException(module, required);
}
```

### Check GlobalExceptionHandler

Verify 403 response status:
```bash
grep -A3 "NotAuthorizedException.class" src/main/java/co/ehealth/platform/core/common/GlobalExceptionHandler.java
```

Should show:
```java
@ExceptionHandler(NotAuthorizedException.class)
public ResponseEntity<ApiErrorResponse> handleNotAuthorized(NotAuthorizedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)...
}
```

---

## Database Query Validation

Connect to tenant database and run:

### Count roles
```sql
SELECT COUNT(*) FROM roles;
-- Expected: 13
```

### List all roles
```sql
SELECT name FROM roles ORDER BY name;
```

**Expected**: 13 roles as per baseline

### Verify ORG_ADMIN permissions
```sql
SELECT p.code FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'ORG_ADMIN'
ORDER BY p.code;
```

**Expected**: 20 rows (one for each module at MANAGE level)

### Verify Pharmacist permissions
```sql
SELECT p.code FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Pharmacist'
ORDER BY p.code;
```

**Expected**: 3 rows:
- PHRM:MANAGE
- PREG:VIEW
- RECQ:VIEW

### Verify Compliance Officer has VIEW-only
```sql
SELECT p.code FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Compliance Officer'
AND p.code LIKE 'SADM%' OR p.code LIKE 'AUDT%' OR p.code LIKE 'IAM%'
ORDER BY p.code;
```

**Expected**: 3 rows (all VIEW):
- AUDT:VIEW
- IAM:VIEW
- SADM:VIEW

### Verify clinical role IAM isolation
```sql
SELECT DISTINCT p.code FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name IN ('Doctor', 'Professional Nurse', 'Clinician')
AND (p.code LIKE 'IAM%' OR p.code LIKE 'SADM%');
```

**Expected**: No rows (empty result set - clinical roles have no IAM/SADM access)

---

## Acceptance Criteria Sign-Off

| Criterion | Status | Validated By | Notes |
|-----------|--------|--------------|-------|
| AC1: 13 roles seeded | ✅ | V6 + V12 migrations | All 13 roles created with gen_random_uuid() |
| AC2: Matrix correctness | ✅ | V12 migration + DB queries | 216 role-permission grants match BRD |
| AC3: 403 for no-access | ✅ | PermissionService + GlobalExceptionHandler | Throws NotAuthorizedException → 403 |

---

## Troubleshooting

### No roles visible in dropdown
1. Verify migrations have run: `SELECT COUNT(*) FROM flyway_schema_history;`
2. Check tenant database schema: `\dt` (list tables)
3. Confirm roles exist: `SELECT * FROM roles;`

### Permission denied but should be allowed
1. Check user's actual roles: `SELECT * FROM user_roles WHERE user_id = <uuid>;`
2. Verify role has permission: SQL queries above
3. Check JWT contains correct ROLE_X authorities (JwtAuthenticationFilter)
4. Verify PermissionService.currentRoleNames() extracts from authorities

### Getting empty array instead of 403
1. Search for service method - verify it calls `permissionService.requireAccess()`
2. Check if method has its own filtering that might return empty before permission check
3. Review endpoint's @PreAuthorize or role constraints
4. Test with direct database query to confirm permissions exist

---

## References
- Database Schema: [V2__identity.sql](../resources/db/migration/tenant/V2__identity.sql)
- Seeding: [V6__seed_default_roles.sql](../resources/db/migration/tenant/V6__seed_default_roles.sql), [V12__role_permissions.sql](../resources/db/migration/tenant/V12__role_permissions.sql)
- Implementation: [PermissionService.java](../java/co/ehealth/platform/identity/PermissionService.java)
- Tests: [src/test/java/co/ehealth/platform/](../test/java/co/ehealth/platform/)
