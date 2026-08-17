import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ======================================================
// AUTHENTICATION
// ======================================================
import Login from "../pages/auth/Login";

// ======================================================
// SUPER ADMIN
// ======================================================
import SuperAdminLayout from "../components/layout/SuperAdminLayout";
import SuperAdminDashboard from "../pages/superadmin/Dashboard";
import Organisations from "../pages/superadmin/Organisations";
import TenantAdministration from "../pages/superadmin/TenantAdministration";

// ======================================================
// TENANT
// ======================================================
import TenantLayout from "../components/layout/TenantLayout";
import TenantDashboard from "../pages/tenant/Dashboard";
import StaffUsers from "../pages/tenant/StaffUsers";
import Branding from "../pages/tenant/Branding";
import Clinics from "../pages/tenant/Clinics";

// ======================================================
// TENANT - PATIENTS
// ======================================================
import Patients from "../pages/tenant/patients/Patients";
import PatientRegistration from "../pages/tenant/patients/PatientRegistration";
import PatientProfile from "../pages/tenant/patients/PatientProfile";
import Appointments from "../pages/tenant/patients/Appointments";
import Reception from "../pages/tenant/patients/Reception";


// ======================================================
// TENANT - RECEPTION
// ======================================================
import ReceptionDashboard from "../pages/tenant/reception/ReceptionDashboard";
import CheckIn from "../pages/tenant/reception/CheckIn";
import QueueBoard from "../pages/tenant/reception/QueueBoard";
import QueueHistory from "../pages/tenant/reception/QueueHistory";
import WalkInVisit from "../pages/tenant/reception/WalkInVisit";

// ======================================================
// TENANT - CLINICAL
// ======================================================
import ClinicalDashboard from "../pages/tenant/clinical/ClinicalDashboard";
import ClinicalServices from "../pages/tenant/clinical/ClinicalServices";
import Consultations from "../pages/tenant/clinical/Consultations";
import Diagnosis from "../pages/tenant/clinical/Diagnosis";
import LabRequests from "../pages/tenant/clinical/LabRequests";
import PatientSearch from "../pages/tenant/clinical/PatientSearch";
import PrescriptionBuilder from "../pages/tenant/clinical/PrescriptionBuilder";
import Referrals from "../pages/tenant/clinical/Referrals";
import VitalsCapture from "../pages/tenant/clinical/VitalsCapture";

// ======================================================
// TENANT - PHARMACY
// ======================================================
import PharmacyDashboard from "../pages/tenant/pharmacy/PharmacyDashboard";
import Dispensing from "../pages/tenant/pharmacy/Dispensing";
import Inventory from "../pages/tenant/pharmacy/Inventory";
import StockManagement from "../pages/tenant/pharmacy/StockManagement";

// ======================================================
// TENANT - BILLING
// ======================================================
import BillingDashboard from "../pages/tenant/billing/BillingDashboard";
import CreateInvoice from "../pages/tenant/billing/CreateInvoice";
import MedicalAidClaims from "../pages/tenant/billing/MedicalAidClaims";
import OutstandingAccounts from "../pages/tenant/billing/OutstandingAccounts";
import Payments from "../pages/tenant/billing/Payments";
import Receipts from "../pages/tenant/billing/Receipts";
import Revenue from "../pages/tenant/billing/Revenue";

// ======================================================
// TENANT - MANAGEMENT
// ======================================================
import Administration from "../pages/tenant/management/Administration";
import AuditCompliance from "../pages/tenant/management/AuditCompliance";
import Reports from "../pages/tenant/management/Reports";
import Training from "../pages/tenant/management/Training";


export default function AppRoutes() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ==================================================
            ROOT
        ================================================== */}

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />


        {/* ==================================================
            AUTHENTICATION
        ================================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/logout"
          element={<Navigate to="/login" replace />}
        />


        {/* ==================================================
            SUPER ADMIN PORTAL
        ================================================== */}

        <Route
          path="/platform"
          element={<SuperAdminLayout />}
        >

          {/* Super Admin Dashboard */}
          <Route
            path="dashboard"
            element={<SuperAdminDashboard />}
          />

          {/* Organisations */}
          <Route
            path="organisations"
            element={<Organisations />}
          />

          {/* Tenant Administration */}
          <Route
            path="tenant-administration"
            element={<TenantAdministration />}
          />

        </Route>


        {/* ==================================================
            TENANT PORTAL
        ================================================== */}

        <Route
          path="/tenant"
          element={<TenantLayout />}
        >

          {/* ==================================================
              ORGANISATION
          ================================================== */}

          {/* Organisation Dashboard */}
          <Route
            path="dashboard"
            element={<TenantDashboard />}
          />

          {/* Staff & Users */}
          <Route
            path="staff"
            element={<StaffUsers />}
          />

          {/* Clinics */}
          <Route
            path="clinics"
            element={<Clinics />}
          />  

          {/* Branding & Preferences */}
          <Route
            path="branding"
            element={<Branding />}
          />


          {/* ==================================================
              PATIENT MANAGEMENT
          ================================================== */}

          {/* Patient list */}
          <Route
            path="patients"
            element={<Patients />}
          />

          {/* Patient registration */}
          <Route
            path="patients/register"
            element={<PatientRegistration />}
          />

          {/* Patient profile */}
          <Route
            path="patients/:mpi"
            element={<PatientProfile />}
          />

          {/* Appointments */}
          <Route
            path="appointments"
            element={<Appointments />}
          />

          {/* Patient reception */}
          <Route
            path="patients/reception"
            element={<Reception />}
          />


          {/* ==================================================
              RECEPTION & QUEUE
          ================================================== */}

          <Route
            path="reception"
            element={<ReceptionDashboard />}
          />

          <Route
            path="reception/check-in"
            element={<CheckIn />}
          />

          <Route
            path="reception/board"
            element={<QueueBoard />}
          />

          <Route
            path="reception/history"
            element={<QueueHistory />}
          />

          <Route
            path="reception/walk-in"
            element={<WalkInVisit />}
          />


          {/* ==================================================
              CLINICAL SERVICES
          ================================================== */}

          <Route
            path="clinical"
            element={<ClinicalDashboard />}
          />

          <Route
            path="clinical/services"
            element={<ClinicalServices />}
          />

          <Route
            path="clinical/consultations"
            element={<Consultations />}
          />

          <Route
            path="clinical/diagnosis"
            element={<Diagnosis />}
          />

          <Route
            path="clinical/laboratory"
            element={<LabRequests />}
          />

          <Route
            path="clinical/patient-search"
            element={<PatientSearch />}
          />

          <Route
            path="clinical/prescriptions"
            element={<PrescriptionBuilder />}
          />

          <Route
            path="clinical/referrals"
            element={<Referrals />}
          />

          <Route
            path="clinical/vitals"
            element={<VitalsCapture />}
          />


          {/* ==================================================
              PHARMACY
          ================================================== */}

          <Route
            path="pharmacy"
            element={<PharmacyDashboard />}
          />

          <Route
            path="pharmacy/dispensing"
            element={<Dispensing />}
          />

          <Route
            path="pharmacy/inventory"
            element={<Inventory />}
          />

          <Route
            path="pharmacy/stock"
            element={<StockManagement />}
          />


          {/* ==================================================
              BILLING
          ================================================== */}

          <Route
            path="billing"
            element={<BillingDashboard />}
          />

          <Route
            path="billing/invoices"
            element={<CreateInvoice />}
          />

          <Route
            path="billing/payments"
            element={<Payments />}
          />

          <Route
            path="billing/receipts"
            element={<Receipts />}
          />

          <Route
            path="billing/claims"
            element={<MedicalAidClaims />}
          />

          <Route
            path="billing/revenue"
            element={<Revenue />}
          />

          <Route
            path="billing/outstanding"
            element={<OutstandingAccounts />}
          />


          {/* ==================================================
              MANAGEMENT
          ================================================== */}

          <Route
            path="reports"
            element={<Reports />}
          />

          <Route
            path="administration"
            element={<Administration />}
          />

          <Route
            path="audit"
            element={<AuditCompliance />}
          />

          <Route
            path="training"
            element={<Training />}
          />

        </Route>

      </Routes>

    </BrowserRouter>
  );
}