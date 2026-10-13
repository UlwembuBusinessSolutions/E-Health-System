import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, CalendarPlus, LogOut } from "lucide-react";
import { usePatientAuth } from "./PatientAuthContext";
import { getOwnPatientRecords, patientLogout } from "@/shared/api/patientAuth";
import { getMyPatientAppointments } from "@/shared/api/patientBooking";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

export function PatientPortalPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { account, logout } = usePatientAuth();
  const records = useQuery({
    queryKey: ["patient-portal", account?.id, "own-records"],
    queryFn: getOwnPatientRecords,
    enabled: Boolean(account?.id),
  });
  const appointments = useQuery({
    queryKey: ["patient-portal", account?.id, "appointments"],
    queryFn: getMyPatientAppointments,
    enabled: Boolean(account?.id),
  });

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

        {records.isPending ? (
          <Card className="p-6 text-sm text-text-secondary" role="status">Loading your patient record…</Card>
        ) : records.isError ? (
          <Card className="p-6 text-sm text-danger-600" role="alert">We couldn’t load your patient record. Please sign out and sign in again, or contact your clinic.</Card>
        ) : (
          <>
            <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Book your next appointment</h2>
                <p className="mt-1 text-sm text-text-secondary">Choose a care service, clinic, provider, date, and available time.</p>
              </div>
              <Link to={`/org/${tenantSlug}/patient/book`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800">
                <CalendarPlus className="size-4" aria-hidden /> Book appointment
              </Link>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="size-5 text-brand-600" aria-hidden />
                <h2 className="text-lg font-semibold text-text-primary">Your appointments</h2>
              </div>
              {appointments.isPending ? <p className="text-sm text-text-secondary">Loading appointments…</p>
                : appointments.isError ? <p role="alert" className="text-sm text-danger-600">We couldn't load your appointments. Refresh to try again.</p>
                  : appointments.data.length === 0 ? <p className="text-sm text-text-secondary">You don't have any appointments yet.</p>
                    : <ol className="divide-y divide-border-subtle">{appointments.data.map((appointment) => <li key={appointment.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><span className="font-medium text-text-primary">{appointment.serviceCode.replaceAll("_", " ")}</span><span className="text-sm text-text-secondary">{appointment.date} · {appointment.time.slice(0, 5)} · {appointment.assignedStaffName ?? "Provider to be assigned"}</span></li>)}</ol>}
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Your patient record</h2>
                <p className="mt-1 text-sm text-text-secondary">MPI: {records.data.mpiNumber}</p>
              </div>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-text-secondary">Name</dt><dd className="font-medium text-text-primary">{records.data.firstName} {records.data.lastName}</dd></div>
                <div><dt className="text-text-secondary">Date of birth</dt><dd className="font-medium text-text-primary">{records.data.dateOfBirth}</dd></div>
                <div><dt className="text-text-secondary">Gender</dt><dd className="font-medium text-text-primary">{records.data.gender.replaceAll("_", " ")}</dd></div>
                <div><dt className="text-text-secondary">Contact number</dt><dd className="font-medium text-text-primary">{records.data.contactNumber}</dd></div>
                <div className="sm:col-span-2"><dt className="text-text-secondary">Address</dt><dd className="font-medium text-text-primary">{records.data.address}</dd></div>
              </dl>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="size-5 text-brand-600" aria-hidden />
                <h2 className="text-lg font-semibold text-text-primary">Visit history</h2>
              </div>
              {records.data.visits.length === 0 ? (
                <p className="text-sm text-text-secondary">No visits are linked to your record yet.</p>
              ) : (
                <ol className="divide-y divide-border-subtle">
                  {records.data.visits.map((visit) => (
                    <li key={visit.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-text-primary">{visit.visitType.replaceAll("_", " ")} · {visit.serviceStream.replaceAll("_", " ")}</span>
                      <span className="text-sm text-text-secondary">{visit.facilityName ?? "Clinic"} · {new Date(visit.visitDateTime).toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
