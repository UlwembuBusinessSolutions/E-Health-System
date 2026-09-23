import { Navigate, Route, Routes } from "react-router-dom";
import { FindOrganizationScreen } from "@/auth/FindOrganizationScreen";
import { LoginScreen } from "@/auth/LoginScreen";
import { ForgotPasswordScreen } from "@/auth/ForgotPasswordScreen";
import { RequireAuth } from "@/auth/RequireAuth";
import { RequireRole } from "@/auth/RequireRole";
import { AddStaffScreen } from "@/staff/AddStaffScreen";
import { StaffListPage } from "@/staff/StaffListPage";
import { PatientSearchPage } from "@/patient/PatientSearchPage";
import { RegisterPatientScreen } from "@/patient/RegisterPatientScreen";
import { PatientDetailPage } from "@/patient/PatientDetailPage";
import { QueuePage } from "@/queue/QueuePage";
import { VitalsIntakePage } from "@/queue/VitalsIntakePage";
import { TicketPrintPage } from "@/queue/TicketPrintPage";
import { VitalsPrintPage } from "@/patient/VitalsPrintPage";
import { PharmacyQueuePage } from "@/pharmacy/PharmacyQueuePage";
import { PrescriptionPrintPage } from "@/pharmacy/PrescriptionPrintPage";
import { OrganizationSettingsPage } from "@/settings/OrganizationSettingsPage";
import { AuditTrailPage } from "@/audit/AuditTrailPage";
import { PatientLoginScreen } from "@/patient-portal/PatientLoginScreen";
import { PatientRegisterScreen } from "@/patient-portal/PatientRegisterScreen";
import { PatientPortalPage } from "@/patient-portal/PatientPortalPage";
import { RequirePatientPortalAuth } from "@/patient-portal/RequirePatientPortalAuth";
import { TenantHomePage } from "@/tenant-site/TenantHomePage";
import { AppShell } from "./AppShell";
import { DashboardPage } from "./DashboardPage";
import { PlatformRoot } from "@/platform/PlatformRoot";
import { PlatformLoginScreen } from "@/platform/PlatformLoginScreen";
import { RequirePlatformAuth } from "@/platform/RequirePlatformAuth";
import { PlatformShell } from "@/platform/components/PlatformShell";
import { OverviewPage } from "@/platform/OverviewPage";
import { OrganizationsPage } from "@/platform/OrganizationsPage";
import { OrganizationDetailPage } from "@/platform/OrganizationDetailPage";
import { ProvisionOrganizationScreen } from "@/platform/ProvisionOrganizationScreen";
import { AddOrganizationAdminScreen } from "@/platform/AddOrganizationAdminScreen";
import { AddClinicScreen } from "@/platform/AddClinicScreen";
import { UsersPage } from "@/platform/UsersPage";
import { CreateOperatorScreen } from "@/platform/CreateOperatorScreen";
import { AuditPage } from "@/platform/AuditPage";
import { ModuleEntitlementMatrixPage } from "@/platform/ModuleEntitlementMatrixPage";

export function AppRouter() {
  return (
    <Routes>
      {/* No tenant slug here — this is the gate a bare/bookmarked /login
          lands on, which exists only to redirect into /org/:tenantSlug/login
          once someone types their organisation. Real sign-in never happens
          on this route. */}
      <Route path="/login" element={<FindOrganizationScreen />} />
      {/* The tenant's public front door — logo/description/contact info
          from PublicOrganizationController, no session required. Links out
          to both the patient portal (below) and, from its own "Sign in"
          if a staff member lands here by mistake, nothing special — staff
          still go straight to /login as always. */}
      <Route path="/org/:tenantSlug" element={<TenantHomePage />} />
      <Route path="/org/:tenantSlug/login" element={<LoginScreen />} />
      <Route path="/org/:tenantSlug/forgot-password" element={<ForgotPasswordScreen />} />
      {/* The patient portal's own identity space — a separate login/register
          pair from staff's /org/:tenantSlug/login above, backed by
          PatientAuthContext rather than AuthContext. Auth scaffolding +
          a minimal portal shell only for now (see PatientPortalPage's own
          why-note); no public marketing pages yet. */}
      <Route path="/org/:tenantSlug/patient/login" element={<PatientLoginScreen />} />
      <Route path="/org/:tenantSlug/patient/register" element={<PatientRegisterScreen />} />
      <Route
        path="/org/:tenantSlug/patient/portal"
        element={
          <RequirePatientPortalAuth>
            <PatientPortalPage />
          </RequirePatientPortalAuth>
        }
      />
      {/* Deliberately outside AppShell — this is a print target, opened in
          its own small popup window (QueuePage/PatientDetailPage's
          "Print"/"Print ticket" actions), and must render nothing but the
          ticket: no sidebar, no top bar, nothing else the print stylesheet
          would otherwise have to fight to hide. Still behind RequireAuth —
          a queue token carries a patient name and MPI. */}
      <Route
        path="/print/ticket/:tokenId"
        element={
          <RequireAuth>
            <TicketPrintPage />
          </RequireAuth>
        }
      />
      {/* Same reasoning as /print/ticket above — VitalsDetailModal's print
          button opens this in its own popup window. Still behind
          RequireAuth — a vitals reading carries clinical detail. */}
      <Route
        path="/print/vitals/:assessmentId"
        element={
          <RequireAuth>
            <VitalsPrintPage />
          </RequireAuth>
        }
      />
      {/* Same reasoning as /print/vitals above — PharmacyQueuePage's print
          button opens this in its own popup window. Still behind
          RequireAuth — a prescription carries clinical detail. */}
      <Route
        path="/print/prescription/:prescriptionId"
        element={
          <RequireAuth>
            <PrescriptionPrintPage />
          </RequireAuth>
        }
      />
      {/* The tenant app shell — Dashboard, Staff, and staff creation all
          render inside AppShell's sidebar/top-bar frame (AppShell.tsx's own
          why-note). RequireAuth wraps the shell itself, not each route
          individually, same nesting PlatformShell/RequirePlatformAuth use
          below; RequireRole on the two admin-only routes nests one level
          deeper, same pattern platform's users/new already establishes. */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="staff"
          element={
            <RequireRole role="ORG_ADMIN">
              <StaffListPage />
            </RequireRole>
          }
        />
        <Route
          path="staff/new"
          element={
            <RequireRole role="ORG_ADMIN">
              <AddStaffScreen />
            </RequireRole>
          }
        />
        {/* No RequireRole — registering and finding a patient is front-line
            reception/clinical work, not admin territory, same gating as the
            backend's own PatientController (falls through to
            .anyRequest().authenticated(), not /api/v1/admin/**). */}
        <Route path="patients" element={<PatientSearchPage />} />
        <Route path="patients/new" element={<RegisterPatientScreen />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="vitals" element={<VitalsIntakePage />} />
        <Route path="pharmacy" element={<PharmacyQueuePage />} />
        <Route
          path="settings"
          element={
            <RequireRole role="ORG_ADMIN">
              <OrganizationSettingsPage />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole role="ORG_ADMIN">
              <AuditTrailPage />
            </RequireRole>
          }
        />
      </Route>
      {/* Deliberately not RequireAuth/RequireRole — a platform operator
          isn't a staff/org-admin login (backend-auth-guide.html Section 1),
          it's a completely separate identity space with its own login
          screen. PlatformRoot applies the console's scoped typography to
          both login and the authenticated subtree; RequirePlatformAuth +
          PlatformShell (sidebar chrome) wrap only the latter, so a
          signed-out visitor at /platform/login never sees nav for pages
          they can't reach yet. */}
      <Route path="/platform" element={<PlatformRoot />}>
        <Route path="login" element={<PlatformLoginScreen />} />
        <Route
          element={
            <RequirePlatformAuth>
              <PlatformShell />
            </RequirePlatformAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/new" element={<ProvisionOrganizationScreen />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="organizations/:id/admins/new" element={<AddOrganizationAdminScreen />} />
          <Route path="organizations/:id/facilities/new" element={<AddClinicScreen />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/new" element={<CreateOperatorScreen />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="modules" element={<ModuleEntitlementMatrixPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
