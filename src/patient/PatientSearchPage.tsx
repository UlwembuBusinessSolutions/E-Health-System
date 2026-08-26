import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, UserRound } from "lucide-react";
import { searchPatients } from "@/shared/api/patients";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();

  let age = now.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() &&
      now.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

function parseDateSearch(value: string): string | null {
  const trimmed = value.trim();

  // Already in backend format: yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00`);

    if (!Number.isNaN(date.getTime())) {
      return trimmed;
    }
  }

  // Supports:
  // 1 Jan 2001
  // 01 Jan 2001
  // 1 January 2001
  // 01 January 2001
  const match = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const monthText = match[2].toLowerCase();
  const year = Number(match[3]);

  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  const month = months[monthText];

  if (month === undefined) {
    return null;
  }

  const date = new Date(year, month, day);

  // Prevent invalid dates such as:
  // 31 Feb 2001
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  const formattedMonth = String(month + 1).padStart(2, "0");
  const formattedDay = String(day).padStart(2, "0");

  return `${year}-${formattedMonth}-${formattedDay}`;
}

// PREG-US-008: matching results are returned within 3 seconds and
// the user is offered a registration path when there are no matches.
export function PatientSearchPage() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  // Debounce the search by 350ms so we don't make an API request
  // for every character typed.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [queryInput]);

  const patientsQuery = useQuery({
  queryKey: ["patients", "search", query],
  queryFn: () => {
    const dateOfBirth = parseDateSearch(query);

    if (dateOfBirth) {
      return searchPatients("", dateOfBirth);
    }

    return searchPatients(query);
  },
  enabled: query.length > 0,
});

  const patients = patientsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Search by name, MPI number, ID number, or date of birth."
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
          placeholder="Search by name, MPI, ID number, or DOB (yyyy-MM-dd)…"
          icon={<Search className="size-4" aria-hidden />}
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          autoFocus
        />
      </div>

      <Card className="overflow-hidden p-0">
        {query.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <UserRound
              className="size-6 text-text-secondary"
              aria-hidden
            />

            <p className="text-[14px] text-text-secondary">
              Start typing to search for a patient.
            </p>
          </div>
        ) : patientsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
            Searching…
          </p>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <UserRound
              className="size-6 text-text-secondary"
              aria-hidden
            />

            <p className="text-[14px] text-text-secondary">
              No patient matches “{query}”.
            </p>

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
                  <tr
                    key={p.id}
                    className="transition-colors duration-150 hover:bg-surface-sunken"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/app/patients/${p.id}`}
                        className="flex items-center gap-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[12px] font-semibold text-brand-600">
                          {initials(p.firstName, p.lastName)}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-text-primary">
                            {p.firstName} {p.lastName}
                          </p>

                          <p className="truncate text-[12.5px] text-text-secondary">
                            {p.idNumber ?? p.passportNumber ?? "No ID / Passport"}
                          </p>
                        </div>
                      </Link>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-primary tabular-nums">
                      {p.mpiNumber}
                    </td>

                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
                      {calculateAge(p.dateOfBirth)} ·{" "}
                      {p.gender.charAt(0) +
                        p.gender.slice(1).toLowerCase()}
                    </td>

                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
                      {p.contactNumber}
                    </td>

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
