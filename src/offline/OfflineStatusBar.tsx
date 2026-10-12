import { Link, useNavigate } from "react-router-dom";
import { CloudOff, Loader2, Lock, RefreshCw, TriangleAlert, UserPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { Button } from "@/shared/components/Button";
import { useOffline } from "./OfflineContext";

// One slim strip above every /app page. Stays out of the way (renders nothing)
// when online with nothing pending.
export function OfflineStatusBar() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const o = useOffline();
  const total = o.entries.length;

  if (o.isOnline && total === 0 && !o.needsSignIn) return null;

  let tone = "border-amber-500/30 bg-amber-50 text-amber-600";
  let icon = <CloudOff className="size-4 shrink-0" aria-hidden />;
  let text = "";
  let action: React.ReactNode = null;

  if (o.needsSignIn && total > 0) {
    icon = <TriangleAlert className="size-4 shrink-0" aria-hidden />;
    text = `Sign in again to sync ${total} record${total === 1 ? "" : "s"} saved on this device.`;
    action = (
      <Button size="md" variant="secondary" onClick={() => { const slug = getTenantSlug(); navigate(slug ? `/org/${slug}/login` : "/login", { replace: true }); logout(); }}>
        Sign in
      </Button>
    );
  } else if (!o.isOnline) {
    text = total > 0
      ? `You're offline — ${total} record${total === 1 ? "" : "s"} saved on this device will sync automatically when you're back online.`
      : "You're offline — patient registrations will be saved on this device and synced automatically.";
    action = <Link to="/app/patients/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white hover:bg-brand-600"><UserPlus className="size-4" aria-hidden />Register a patient</Link>;
  } else if (o.isSyncing) {
    tone = "border-brand-500/30 bg-brand-50 text-brand-700";
    icon = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />;
    text = "Syncing records…";
  } else if (!o.unlocked && total > 0) {
    icon = <Lock className="size-4 shrink-0" aria-hidden />;
    text = `${total} record${total === 1 ? "" : "s"} waiting to sync. Unlock offline storage to send them.`;
    action = <Button size="md" variant="secondary" onClick={() => void o.syncNow({ manual: true })}>Unlock & sync</Button>;
  } else if (o.problemCount > 0) {
    icon = <TriangleAlert className="size-4 shrink-0" aria-hidden />;
    tone = "border-danger-500/30 bg-danger-50 text-danger-600";
    text = `${o.problemCount} record${o.problemCount === 1 ? "" : "s"} need attention.`;
    action = <Link to="/app/sync" className="text-[13px] font-semibold underline">Review</Link>;
  } else {
    icon = <RefreshCw className="size-4 shrink-0" aria-hidden />;
    text = `${o.pendingCount} record${o.pendingCount === 1 ? "" : "s"} pending sync.`;
    action = <Button size="md" variant="secondary" onClick={() => void o.syncNow({ manual: true })}>Sync now</Button>;
  }

  return (
    <div role="status" className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-[13.5px] ${tone}`}>
      <span className="flex items-center gap-2.5">{icon}{text}</span>
      <span className="flex items-center gap-3">
        {o.isOnline && total > 0 && <Link to="/app/sync" className="text-[13px] font-semibold underline">Details</Link>}
        {action}
      </span>
    </div>
  );
}