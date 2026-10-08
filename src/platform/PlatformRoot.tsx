import { Outlet } from "react-router-dom";
import "./platform.css";

// One place to apply .platform-shell (platform.css's scoped IBM Plex
// override) across every /platform/* screen, login included — a JS-level
// import here rather than in each screen file, so the font override only
// ever needs declaring once. Renders nothing else: RequirePlatformAuth and
// PlatformShell (the sidebar chrome) are separate, inner concerns — a
// signed-out visitor hitting /platform/login still gets the right
// typography without any of the authenticated chrome.
export function PlatformRoot() {
  return (
    <div className="platform-shell min-h-screen bg-surface">
      <Outlet />
    </div>
  );
}
