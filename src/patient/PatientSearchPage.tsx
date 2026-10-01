import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  listPatients,
  searchPatients,
  type CitizenshipStatus,
  type PatientSortBy,
  type SortDirection,
} from "@/shared/api/patients";
import type { Gender } from "@/shared/api/types";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";

const PAGE_SIZE = 20;

type MedicalAidFilter = "" | "yes" | "no";

const GENDER_FILTER_OPTIONS: { value: Gender | ""; label: string }[] = [
  { value: "", label: "All genders" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
];

const MEDICAL_AID_FILTER_OPTIONS: { value: MedicalAidFilter; label: string }[] = [
  { value: "", label: "All patients" },
  { value: "yes", label: "Has medical aid" },
  { value: "no", label: "No medical aid" },
];

const CITIZENSHIP_FILTER_OPTIONS: { value: CitizenshipStatus | ""; label: string }[] = [
  { value: "", label: "All citizenship" },
  { value: "SA_CITIZEN", label: "SA citizen" },
  { value: "PERMANENT_RESIDENT", label: "Permanent resident" },
];

// One combined dropdown value per sortBy+sortDir pair, phrased for a
// reader rather than exposing the two raw axes separately — "Youngest
// first" reads better than "Age, ascending." The same state this drives
// also backs the sortable column headers below, so picking an option here
// and clicking a header are two paths to the one source of truth.
const SORT_OPTIONS: { value: string; label: string; sortBy: PatientSortBy; sortDir: SortDirection }[] = [
  { value: "name-asc", label: "Name (A–Z)", sortBy: "name", sortDir: "asc" },
  { value: "name-desc", label: "Name (Z–A)", sortBy: "name", sortDir: "desc" },
  { value: "registered-desc", label: "Newest first", sortBy: "registered", sortDir: "desc" },
  { value: "registered-asc", label: "Oldest first", sortBy: "registered", sortDir: "asc" },
];

// A native <select> dressed as a rounded filter chip rather than the
// shared <Select>'s label-above form-field layout — this sits inline in a
// toolbar next to the search box, not in a form.
function FilterPill<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 appearance-none rounded-full border border-border-strong bg-surface-raised py-0 pl-3 pr-7 text-[13px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
    </div>
  );
}

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
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<PatientSortBy>("registered");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [genderFilter, setGenderFilter] = useState<Gender | "">("");
  const [medicalAidFilter, setMedicalAidFilter] = useState<MedicalAidFilter>("");
  const [citizenshipFilter, setCitizenshipFilter] = useState<CitizenshipStatus | "">("");
  const [mpiInput, setMpiInput] = useState("");
  const [mpiFilter, setMpiFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(queryInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [queryInput]);

  // Same debounce as the main search box above, just scoped to the MPI
  // filter pill — a receptionist typing a fragment shouldn't fire a
  // request per keystroke either.
  useEffect(() => {
    const timeout = setTimeout(() => setMpiFilter(mpiInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [mpiInput]);

  // A fresh search always starts back at page 1 of the roster once cleared
  // — same reasoning for a sort/filter change: whichever page the reader
  // was on may not even exist under the new ordering, so land back at the
  // top rather than risk stranding them on an out-of-range page.
  useEffect(() => {
    setPage(0);
  }, [query, sortBy, sortDir, genderFilter, medicalAidFilter, citizenshipFilter, mpiFilter, createdFrom, createdTo]);

  const isBrowsing = query.length === 0;
  const hasActiveFilters =
    sortBy !== "name" ||
    sortDir !== "asc" ||
    genderFilter !== "" ||
    medicalAidFilter !== "" ||
    citizenshipFilter !== "" ||
    mpiFilter !== "" ||
    createdFrom !== "" ||
    createdTo !== "";

  function toggleSort(column: PatientSortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSortBy("name");
    setSortDir("asc");
    setGenderFilter("");
    setMedicalAidFilter("");
    setCitizenshipFilter("");
    setMpiInput("");
    setMpiFilter("");
    setCreatedFrom("");
    setCreatedTo("");
  }

  function sortIndicator(column: PatientSortBy) {
    if (sortBy !== column) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
    return sortDir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />;
  }

  const sortValue = `${sortBy}-${sortDir}`;

  function onSortSelect(value: string) {
    const option = SORT_OPTIONS.find((o) => o.value === value);
    if (!option) return;
    setSortBy(option.sortBy);
    setSortDir(option.sortDir);
  }

  // Each active filter (and a non-default sort) gets its own removable
  // chip — answers "can I drop just this one filter" without forcing a
  // full reset back through "Clear filters."
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (sortBy !== "name" || sortDir !== "asc") {
    activeChips.push({
      key: "sort",
      label: `Sort: ${SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? "custom"}`,
      onRemove: () => {
        setSortBy("name");
        setSortDir("asc");
      },
    });
  }
  if (genderFilter) {
    activeChips.push({
      key: "gender",
      label: GENDER_FILTER_OPTIONS.find((o) => o.value === genderFilter)?.label ?? genderFilter,
      onRemove: () => setGenderFilter(""),
    });
  }
  if (medicalAidFilter) {
    activeChips.push({
      key: "medicalAid",
      label: MEDICAL_AID_FILTER_OPTIONS.find((o) => o.value === medicalAidFilter)?.label ?? medicalAidFilter,
      onRemove: () => setMedicalAidFilter(""),
    });
  }
  if (citizenshipFilter) {
    activeChips.push({
      key: "citizenship",
      label: CITIZENSHIP_FILTER_OPTIONS.find((o) => o.value === citizenshipFilter)?.label ?? citizenshipFilter,
      onRemove: () => setCitizenshipFilter(""),
    });
  }
  if (mpiFilter) {
    activeChips.push({
      key: "mpi",
      label: `MPI: ${mpiFilter}`,
      onRemove: () => {
        setMpiInput("");
        setMpiFilter("");
      },
    });
  }
  if (createdFrom) {
    activeChips.push({ key: "createdFrom", label: `From ${createdFrom}`, onRemove: () => setCreatedFrom("") });
  }
  if (createdTo) {
    activeChips.push({ key: "createdTo", label: `To ${createdTo}`, onRemove: () => setCreatedTo("") });
  }

  const listQuery = useQuery({
    queryKey: [
      "patients",
      "list",
      page,
      sortBy,
      sortDir,
      genderFilter,
      medicalAidFilter,
      citizenshipFilter,
      mpiFilter,
      createdFrom,
      createdTo,
    ],
    queryFn: () =>
      listPatients({
        page,
        size: PAGE_SIZE,
        sortBy,
        sortDir,
        gender: genderFilter,
        hasMedicalAid: medicalAidFilter === "" ? null : medicalAidFilter === "yes",
        citizenshipStatus: citizenshipFilter,
        mpiNumber: mpiFilter,
        createdFrom,
        createdTo,
      }),
    enabled: isBrowsing,
  });

  const searchQuery = useQuery({
    queryKey: ["patients", "search", query],
    queryFn: () => searchPatients(query),
    enabled: !isBrowsing,
  });

  const patients = isBrowsing ? (listQuery.data?.items ?? []) : (searchQuery.data ?? []);
  const isLoading = isBrowsing ? listQuery.isLoading : searchQuery.isLoading;
  const totalPages = listQuery.data?.totalPages ?? 0;
  const totalItems = listQuery.data?.totalItems ?? 0;

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Browse the roster, or search by name, MPI number, or ID number."
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

      {isBrowsing && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <ArrowUpDown className="size-3.5" aria-hidden />
            Sort
          </span>
          <FilterPill
            label="Sort by"
            value={sortValue}
            onChange={onSortSelect}
            options={SORT_OPTIONS.filter((o) => o.sortBy === "registered").map((o) => ({ value: o.value, label: o.label }))}
          />

          <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden />

          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <Filter className="size-3.5" aria-hidden />
            Filter
          </span>
          <FilterPill label="Filter by gender" value={genderFilter} onChange={setGenderFilter} options={GENDER_FILTER_OPTIONS} />
          <FilterPill
            label="Filter by medical aid"
            value={medicalAidFilter}
            onChange={setMedicalAidFilter}
            options={MEDICAL_AID_FILTER_OPTIONS}
          />
          {false && (
            <>
          <FilterPill
            label="Filter by citizenship"
            value={citizenshipFilter}
            onChange={setCitizenshipFilter}
            options={CITIZENSHIP_FILTER_OPTIONS}
          />
          <input
            type="text"
            aria-label="Filter by MPI number"
            placeholder="MPI number…"
            value={mpiInput}
            onChange={(e) => setMpiInput(e.target.value)}
            className="h-8 w-36 rounded-full border border-border-strong bg-surface-raised px-3 text-[13px] text-text-primary outline-none transition-colors duration-150 placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-text-secondary">Registered</span>
            <input
              type="date"
              aria-label="Registered from"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="h-8 rounded-full border border-border-strong bg-surface-raised px-2.5 text-[13px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <span className="text-[13px] text-text-secondary">–</span>
            <input
              type="date"
              aria-label="Registered to"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="h-8 rounded-full border border-border-strong bg-surface-raised px-2.5 text-[13px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
            </>
          )}
        </div>
      )}

      {isBrowsing && activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1.5 text-[12.5px] font-medium text-brand-700 transition-colors duration-150 hover:bg-brand-100"
            >
              {chip.label}
              <X className="size-3" aria-hidden />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-2.5 py-1 text-[12.5px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
            {isBrowsing ? "Loading patients…" : "Searching…"}
          </p>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <UserRound className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              {isBrowsing
                ? hasActiveFilters
                  ? "No patients match these filters."
                  : "No patients registered yet."
                : `No patient matches “${query}”.`}
            </p>
            {isBrowsing && hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[13.5px] font-semibold text-brand-600 hover:text-brand-700"
              >
                Clear filters
              </button>
            )}
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
                    {isBrowsing ? (
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className={clsx(
                          "flex items-center gap-1 uppercase tracking-wide transition-colors duration-150 hover:text-text-primary",
                          sortBy === "name" && "text-brand-600",
                        )}
                      >
                        Patient
                        {sortIndicator("name")}
                      </button>
                    ) : (
                      "Patient"
                    )}
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    {isBrowsing ? (
                      <button
                        type="button"
                        onClick={() => toggleSort("mpi")}
                        className={clsx(
                          "flex items-center gap-1 uppercase tracking-wide transition-colors duration-150 hover:text-text-primary",
                          sortBy === "mpi" && "text-brand-600",
                        )}
                      >
                        MPI number
                        {sortIndicator("mpi")}
                      </button>
                    ) : (
                      "MPI number"
                    )}
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    {isBrowsing ? (
                      <button
                        type="button"
                        onClick={() => toggleSort("age")}
                        className={clsx(
                          "flex items-center gap-1 uppercase tracking-wide transition-colors duration-150 hover:text-text-primary",
                          sortBy === "age" && "text-brand-600",
                        )}
                      >
                        Age / Gender
                        {sortIndicator("age")}
                      </button>
                    ) : (
                      "Age / Gender"
                    )}
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    {isBrowsing ? (
                      <button
                        type="button"
                        onClick={() => toggleSort("registered")}
                        className={clsx(
                          "flex items-center gap-1 uppercase tracking-wide transition-colors duration-150 hover:text-text-primary",
                          sortBy === "registered" && "text-brand-600",
                        )}
                      >
                        Registered
                        {sortIndicator("registered")}
                      </button>
                    ) : (
                      "Registered"
                    )}
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
        {isBrowsing && !isLoading && totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
            <p className="text-[13px] text-text-secondary">
              Page {page + 1} of {totalPages} · {totalItems} patient{totalItems === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronLeft className="size-3.5" aria-hidden />}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
