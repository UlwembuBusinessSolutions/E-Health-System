import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { MobileTopBar } from "./components/MobileTopBar";
import { useOrganizationBranding } from "./useOrganizationBranding";

// The authenticated frame every real tenant screen renders inside —
// Dashboard, Staff, and staff creation. Mirrors PlatformShell.tsx exactly
// (same layout, different sidebar palette) so the two products share one
// shell shape. Wraps only the RequireAuth subtree in router.tsx — a
// signed-out visitor has no session or nav destinations to show yet.
export function AppShell() {
  useOrganizationBranding();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <MobileTopBar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
