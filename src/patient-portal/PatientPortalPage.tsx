import { useNavigate, useParams } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";
import { usePatientAuth } from "./PatientAuthContext";
import { patientLogout } from "@/shared/api/patientAuth";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

// The minimal authenticated portal shell — deliberately just a welcome and
// a placeholder for now (this build is auth scaffolding only; appointment
// booking and everything else named in the wider tenant-website plan are a
// later phase). Not built as a separate shell + nested routes yet since
// there's only one screen — add that structure back once a second portal
// page actually exists.
export function PatientPortalPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { account, logout } = usePatientAuth();

  const handleSignOut = () => {
    // Best-effort — the client-side session clears either way (logout()
    // below), same "don't block sign-out on a network call" reasoning the
    // staff app's own Sidebar.handleSignOut() uses.
    void patientLogout().catch(() => {});
    logout();
    navigate(`/org/${tenantSlug}/patient/login`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border-subtle bg-surface-raised">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-8 w-auto object-contain" />
          <Button variant="secondary" icon={<LogOut className="size-4" aria-hidden />} onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary">Welcome, {account?.firstName}</h1>
          <p className="mt-1 text-[14px] text-text-secondary">You're signed in to your patient portal account.</p>
        </div>

        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <p className="text-[15px] font-semibold text-text-primary">More features are coming soon</p>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-text-secondary">
            Booking appointments, viewing your visit history, and more will appear here in a future update.
          </p>
        </Card>
      </main>
    </div>
  );
}
