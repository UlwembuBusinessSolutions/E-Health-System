import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";

// The authenticated frame every real console screen renders inside —
// Overview, Organizations, Users, and their detail/create sub-routes.
// Login stays outside this (PlatformRoot wraps both, this wraps only the
// RequirePlatformAuth subtree in router.tsx) since a signed-out visitor has
// no operator identity or nav destinations to show yet.
export function PlatformShell() {
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
