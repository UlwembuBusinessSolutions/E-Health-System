import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

// Dashboard
import Dashboard from "../pages/dashboard/Dashboard";

// Patient Management
import Patients from "../pages/patients/Patients";
import PatientRegistration from "../pages/patients/PatientRegistration";
import Appointments from "../pages/patients/Appointments";
import PatientProfile from "../pages/patients/PatientProfile";

// Reception
import ReceptionDashboard from "../pages/reception/ReceptionDashboard";
import QueueBoard from "../pages/reception/QueueBoard";

// Clinical
import ClinicalDashboard from "../pages/clinical/ClinicalDashboard";

// Pharmacy
import PharmacyDashboard from "../pages/pharmacy/PharmacyDashboard";
import Dispensing from "../pages/pharmacy/Dispensing";
import Inventory from "../pages/pharmacy/Inventory";
import StockManagement from "../pages/pharmacy/StockManagement";

// Billing
import BillingDashboard from "../pages/billing/BillingDashboard";
import CreateInvoice from "../pages/billing/CreateInvoice";
import Payments from "../pages/billing/Payments";
import Receipts from "../pages/billing/Receipts";
import MedicalAidClaims from "../pages/billing/MedicalAidClaims";
import Revenue from "../pages/billing/Revenue";
import OutstandingAccounts from "../pages/billing/OutstandingAccounts";

// Management
import Reports from "../pages/management/Reports";
import Administration from "../pages/management/Administration";
import AuditCompliance from "../pages/management/AuditCompliance";
import Training from "../pages/management/Training";

// Tenant / Organisation
import StaffUsers from "../pages/tenant/StaffUsers";
import Branding from "../pages/organisations/Branding";
import Organisations from "../pages/organisations/Organisations";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>

          {/* =========================
              DASHBOARD
          ========================== */}
          <Route path="/" element={<Dashboard />} />

          {/* =========================
              PATIENT MANAGEMENT
          ========================== */}
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/register" element={<PatientRegistration />} />
          <Route path="/patients/:mpi" element={<PatientProfile />} />
          <Route path="/appointments" element={<Appointments />} />



          {/* =========================
              RECEPTION & QUEUE
          ========================== */}
          <Route
            path="/reception"
            element={<ReceptionDashboard />}
          />

          <Route
            path="/reception/board"
            element={<QueueBoard />}
          />

          {/* =========================
              CLINICAL SERVICES
          ========================== */}
          <Route
            path="/clinical"
            element={<ClinicalDashboard />}
          />

          {/* =========================
              PHARMACY
          ========================== */}
          <Route
            path="/pharmacy"
            element={<PharmacyDashboard />}
          />

          <Route
            path="/pharmacy/dispensing"
            element={<Dispensing />}
          />

          <Route
            path="/pharmacy/inventory"
            element={<Inventory />}
          />

          <Route
            path="/pharmacy/stock"
            element={<StockManagement />}
          />

          {/* =========================
              BILLING
          ========================== */}
          <Route
            path="/billing"
            element={<BillingDashboard />}
          />

          <Route
            path="/billing/invoices"
            element={<CreateInvoice />}
          />

          <Route
            path="/billing/payments"
            element={<Payments />}
          />

          <Route
            path="/billing/receipts"
            element={<Receipts />}
          />

          <Route
            path="/billing/claims"
            element={<MedicalAidClaims />}
          />

          <Route
            path="/billing/revenue"
            element={<Revenue />}
          />

          <Route
            path="/billing/outstanding"
            element={<OutstandingAccounts />}
          />

          {/* =========================
              MANAGEMENT
          ========================== */}
          <Route
            path="/reports"
            element={<Reports />}
          />

          <Route
            path="/administration"
            element={<Administration />}
          />

          <Route
            path="/audit"
            element={<AuditCompliance />}
          />

          <Route
            path="/training"
            element={<Training />}
          />

          {/* =========================
              TENANT ADMINISTRATION
          ========================== */}
          <Route
            path="/tenant/staff"
            element={<StaffUsers />}
          />

          <Route
            path="/branding"
            element={<Branding />}
          />

          {/* =========================
              ORGANISATIONS
          ========================== */}
          <Route
            path="/organisations"
            element={<Organisations />}
          />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}