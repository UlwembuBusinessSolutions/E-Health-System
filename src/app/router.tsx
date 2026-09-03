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
import { EditPatientScreen } from "@/patient/EditPatientScreen";
import { QueuePage } from "@/queue/QueuePage";
import { PharmacyQueuePage } from "@/pharmacy/PharmacyQueuePage";
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
import { AuditLogPage } from "@/audit/AuditLogPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<FindOrganizationScreen />} />
      <Route path="/org/:tenantSlug/login" element={<LoginScreen />} />
      <Route path="/org/:tenantSlug/forgot-password" element={<ForgotPasswordScreen />} />
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

        <Route path="patients" element={<PatientSearchPage />} />
        <Route path="patients/new" element={<RegisterPatientScreen />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="patients/:id/edit" element={<EditPatientScreen />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="pharmacy" element={<PharmacyQueuePage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>

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
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}