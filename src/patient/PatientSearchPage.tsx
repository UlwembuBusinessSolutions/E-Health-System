import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, UserRound } from "lucide-react";
import { searchPatients } from "@/shared/api/patients";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// PREG-US-008: "matching results are returned within 3 seconds ... offers
// registration path on no-match." Debounced the same way OrganizationsPage's
// own search is (350ms) rather than firing a request per keystroke; the
// empty-state below is that "registration path."
export function PatientSearchPage() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(queryInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [queryInput]);

  const patientsQuery = useQuery({
    queryKey: ["patients", "search", query],
    queryFn: () => searchPatients(query),
    enabled: query.length > 0,
  });

  const patients = patientsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Search by name, MPI number, or ID number."
        action={
          <Link
            to="/app/patients/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
          >
            <Plus className="size-4" aria-hidden />
            Register patient
          </Link>
        }
      />

      <div className="mb-4">
        <Input
          label="Search"
          placeholder="Search by name, MPI, or ID number…"
          icon={<Search className="size-4" aria-hidden />}
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          autoFocus
        />
      </div>

      <Card className="overflow-hidden p-0">
        {query.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <UserRound className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">Start typing to search for a patient.</p>
          </div>
        ) : patientsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Searching…</p>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <UserRound className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">No patient matches “{query}”.</p>
            <Link
              to="/app/patients/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[13.5px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
            >
              <Plus className="size-4" aria-hidden />
              Register a new patient
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Patient
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    MPI number
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Age / Gender
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {patients.map((p) => (
                  <tr key={p.id} className="transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="px-5 py-3.5">
                      <Link to={`/app/patients/${p.id}`} className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[12px] font-semibold text-brand-600">
                          {initials(p.firstName, p.lastName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-text-primary">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="truncate text-[12.5px] text-text-secondary">{p.idNumber}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-primary tabular-nums">
                      {p.mpiNumber}
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
                      {calculateAge(p.dateOfBirth)} · {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">{p.contactNumber}</td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
