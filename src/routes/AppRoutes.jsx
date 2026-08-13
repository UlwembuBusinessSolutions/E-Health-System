import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

// Dashboard
import Dashboard from "../pages/dashboard/Dashboard";

// Patients
import Patients from "../pages/patients/Patients";
import Appointments from "../pages/patients/Appointments";

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

// Management
import Reports from "../pages/management/Reports";
import Administration from "../pages/management/Administration";
import AuditCompliance from "../pages/management/AuditCompliance";
import Training from "../pages/management/Training";

// Tenant / Organisation
import StaffUsers from "../pages/tenant/StaffUsers";
import Branding from "../pages/organisations/Branding";

// Billing
import BillingDashboard from "../pages/billing/BillingDashboard";
import CreateInvoice from "../pages/billing/CreateInvoice";
import Payments from "../pages/billing/Payments";
import Receipts from "../pages/billing/Receipts";
import MedicalAidClaims from "../pages/billing/MedicalAidClaims";
import Revenue from "../pages/billing/Revenue";
import OutstandingAccounts from "../pages/billing/OutstandingAccounts";


export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Patient Management */}
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />

          {/* Reception & Queue */}
          <Route path="/reception" element={<ReceptionDashboard />} />
          <Route path="/reception/board" element={<QueueBoard />} />

          {/* Clinical */}
          <Route path="/clinical" element={<ClinicalDashboard />} />

          {/* Pharmacy */}
          <Route path="/pharmacy" element={<PharmacyDashboard />} />
          <Route path="/pharmacy/dispensing" element={<Dispensing />} />
          <Route path="/pharmacy/inventory" element={<Inventory />} />
          <Route path="/pharmacy/stock" element={<StockManagement />} />

          {/* Billing */}
          <Route path="/billing" element={<BillingDashboard />} />
          <Route path="/billing/invoices" element={<CreateInvoice />} />
          <Route path="/billing/payments" element={<Payments />} />
          <Route path="/billing/receipts" element={<Receipts />} />
          <Route path="/billing/claims" element={<MedicalAidClaims />} />
          <Route path="/billing/revenue" element={<Revenue />} />
          <Route path="/billing/outstanding" element={<OutstandingAccounts />} />

          {/* Management */}
          <Route path="/reports" element={<Reports />} />
          <Route path="/administration" element={<Administration />} />
          <Route path="/audit" element={<AuditCompliance />} />
          <Route path="/training" element={<Training />} />

          {/* Tenant Administration */}
          <Route path="/tenant/staff" element={<StaffUsers />} />
          <Route path="/branding" element={<Branding />} />

         
        </Route>
      </Routes>
    </BrowserRouter>
  );
}