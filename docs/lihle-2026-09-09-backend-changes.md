# Backend Change Record

Name: lihle
Date: 2026-09-09

This records the clinic-scope implementation and integration of existing remote changes; it does not reassign authorship of those remote changes.

## Changed Java Files

- `src/main/java/co/ehealth/platform/core/audit/AuditController.java`: Added clinic context to audit handling so actions can be traced to the clinic where they occurred.
- `src/main/java/co/ehealth/platform/core/audit/AuditLog.java`: Added clinic context to audit handling so actions can be traced to the clinic where they occurred.
- `src/main/java/co/ehealth/platform/core/audit/AuditLogRepository.java`: Added clinic context to audit handling so actions can be traced to the clinic where they occurred.
- `src/main/java/co/ehealth/platform/core/audit/AuditLogService.java`: Added clinic context to audit handling so actions can be traced to the clinic where they occurred.
- `src/main/java/co/ehealth/platform/core/clinic/ClinicAccessDeniedException.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/core/clinic/ClinicContext.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/core/clinic/ClinicContextFilter.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/core/clinic/InvalidClinicScopeException.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/core/common/GlobalExceptionHandler.java`: Mapped clinic and triage failures to explicit HTTP errors that the frontend can display.
- `src/main/java/co/ehealth/platform/core/security/SecurityConfig.java`: Registered clinic-context filtering and allowed clinic headers for authenticated browser requests.
- `src/main/java/co/ehealth/platform/facility/FacilityController.java`: Limited clinic discovery to accessible active facilities so dropdowns respect staff assignments.
- `src/main/java/co/ehealth/platform/facility/FacilityRepository.java`: Limited clinic discovery to accessible active facilities so dropdowns respect staff assignments.
- `src/main/java/co/ehealth/platform/identity/ClinicScopeController.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/identity/ClinicScopeService.java`: Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.
- `src/main/java/co/ehealth/platform/identity/PermissionService.java`: Aligned staff roles and clinic assignments so permissions follow the current clinic context.
- `src/main/java/co/ehealth/platform/identity/StaffService.java`: Aligned staff roles and clinic assignments so permissions follow the current clinic context.
- `src/main/java/co/ehealth/platform/identity/TenantAuditController.java`: Added clinic context to audit handling so actions can be traced to the clinic where they occurred.
- `src/main/java/co/ehealth/platform/identity/User.java`: Aligned staff roles and clinic assignments so permissions follow the current clinic context.
- `src/main/java/co/ehealth/platform/identity/UserRepository.java`: Aligned staff roles and clinic assignments so permissions follow the current clinic context.
- `src/main/java/co/ehealth/platform/identity/UserRoleAssignment.java`: Aligned staff roles and clinic assignments so permissions follow the current clinic context.
- `src/main/java/co/ehealth/platform/patient/Patient.java`: Bound patient access to the active clinic to prevent cross-clinic data exposure.
- `src/main/java/co/ehealth/platform/patient/PatientRepository.java`: Bound patient access to the active clinic to prevent cross-clinic data exposure.
- `src/main/java/co/ehealth/platform/patient/PatientService.java`: Bound patient access to the active clinic to prevent cross-clinic data exposure.
- `src/main/java/co/ehealth/platform/pharmacy/ManualVerificationCaseRepository.java`: Scoped prescription and verification queries to the active clinic to protect patient records.
- `src/main/java/co/ehealth/platform/pharmacy/PrescriptionRepository.java`: Scoped prescription and verification queries to the active clinic to protect patient records.
- `src/main/java/co/ehealth/platform/pharmacy/PrescriptionService.java`: Scoped prescription and verification queries to the active clinic to protect patient records.
- `src/main/java/co/ehealth/platform/pharmacy/StockMovement.java`: Retained remote compatibility changes during integration to preserve the published backend contract.
- `src/main/java/co/ehealth/platform/platform/CrossTenantAccessFilter.java`: Retained remote compatibility changes during integration to preserve the published backend contract.
- `src/main/java/co/ehealth/platform/platform/DevSeedDataRunner.java`: Set clinic context during development seeding because patient registration now requires it.
- `src/main/java/co/ehealth/platform/triage/TriageAssessmentController.java`: Connected persisted triage reads and validation to the UI while restricting records to the active clinic.
- `src/main/java/co/ehealth/platform/triage/TriageAssessmentNotFoundException.java`: Connected persisted triage reads and validation to the UI while restricting records to the active clinic.
- `src/main/java/co/ehealth/platform/triage/TriageAssessmentRepository.java`: Connected persisted triage reads and validation to the UI while restricting records to the active clinic.
- `src/main/java/co/ehealth/platform/triage/TriageAssessmentService.java`: Connected persisted triage reads and validation to the UI while restricting records to the active clinic.
- `src/main/java/co/ehealth/platform/visit/QueueService.java`: Aligned visit responses and scoped visit/queue access to the active clinic for connected clinical screens.
- `src/main/java/co/ehealth/platform/visit/VisitController.java`: Aligned visit responses and scoped visit/queue access to the active clinic for connected clinical screens.
- `src/main/java/co/ehealth/platform/visit/VisitRepository.java`: Aligned visit responses and scoped visit/queue access to the active clinic for connected clinical screens.
- `src/main/java/co/ehealth/platform/visit/VisitService.java`: Aligned visit responses and scoped visit/queue access to the active clinic for connected clinical screens.
- `src/test/java/co/ehealth/platform/core/clinic/ClinicContextFilterTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/core/clinic/ClinicScopeLiveApiTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/core/clinic/ClinicScopePostgresTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/identity/ClinicScopeServiceTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/patient/PatientClinicScopeTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/patient/PatientStoryTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/pharmacy/ManualVerificationServiceTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/pharmacy/PrescriptionServicePatientIdentityTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/triage/TriageAssessmentServiceTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.
- `src/test/java/co/ehealth/platform/visit/QueueTokenStoryTest.java`: Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.

## Build, Configuration, and Migrations

- `pom.xml`: Java 21 bytecode and test/compiler compatibility settings retain a working build on the local JDK.
- `application.yml`: retain the remote branch's database defaults in Git; preserve personal local settings outside the commit.
- Tenant migrations: retain the remote-published V15 passport, V16 deceased, V17 audit indexes, V18 privileged audit, V19 triage, V20 stock movements, and V21 named-patient dispensing versions. This removes version collisions introduced by merging independently renumbered files.
- Control V9 audit migration: retain the published version to avoid duplicate control migration numbers.
- Tenant V23 clinic scope: adds patient ownership, assignment backfill, query indexes, and audit clinic context to enforce the user story.
- Existing SQL content is unchanged by this annotation pass: comments in applied migrations can invalidate Flyway checksums.
- A database previously migrated using the alternative local numbering needs an explicit migration-history reconciliation before startup. No existing database history was changed during this push.
- `docs/IAM-US-011-clinic-scope.md` and `docs/PHARMACY-TRIAGE-integration.md`: document API contracts, behavior, and verification commands.
