import { Navigate, Route, Routes } from "react-router-dom";
import { FindOrganizationScreen } from "@/auth/FindOrganizationScreen";
import { LoginScreen } from "@/auth/LoginScreen";
import { ForgotPasswordScreen } from "@/auth/ForgotPasswordScreen";
import { SetPasswordScreen } from "@/auth/SetPasswordScreen";
import { RequireAuth } from "@/auth/RequireAuth";
import { RequireRole } from "@/auth/RequireRole";
import { AddStaffScreen } from "@/staff/AddStaffScreen";
import { StaffListPage } from "@/staff/StaffListPage";
import { PatientSearchPage } from "@/patient/PatientSearchPage";
import { RegisterPatientScreen } from "@/patient/RegisterPatientScreen";
import { PatientDetailPage } from "@/patient/PatientDetailPage";
import { QueuePage } from "@/queue/QueuePage";
import { PharmacyQueuePage } from "@/pharmacy/PharmacyQueuePage";
import { AppShell } from "./AppShell";
import { DashboardPage } from "./DashboardPage";
import { PlatformRoot } from "@/platform/PlatformRoot";
import { PlatformLoginScreen } from "@/platform/PlatformLoginScreen";
import { PlatformRegisterScreen } from "@/platform/PlatformRegisterScreen";
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

export function AppRouter() {
  return (
    <Routes>
      {/* No tenant slug here — this is the gate a bare/bookmarked /login
          lands on, which exists only to redirect into /org/:tenantSlug/login
          once someone types their organisation. Real sign-in never happens
          on this route. */}
      <Route path="/login" element={<FindOrganizationScreen />} />
      <Route path="/org/:tenantSlug/login" element={<LoginScreen />} />
      <Route path="/org/:tenantSlug/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/org/:tenantSlug/set-password" element={<SetPasswordScreen />} />
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
        <Route path="pharmacy" element={<PharmacyQueuePage />} />
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
        <Route path="register" element={<PlatformRegisterScreen />} />
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
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
