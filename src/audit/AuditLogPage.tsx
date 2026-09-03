// import { useEffect, useState } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { ChevronDown, ClipboardList, ShieldAlert } from "lucide-react";
// import { listAuditLog, type AuditModule } from "@/shared/api/audit";
// import { listStaff } from "@/shared/api/staff";
// import { ApiError } from "@/shared/api/client";
// import { Card } from "@/shared/components/Card";
// import { Input } from "@/shared/components/Input";
// import { PageHeader } from "@/shared/components/PageHeader";

// // Fixed, not derived from results — same reasoning as the platform
// // console's own AUDIT_ACTIONS: a quiet stretch with zero PATIENT_UPDATED
// // rows shouldn't make that filter option disappear. Matches every
// // auditLogService.append() call site across identity/patient/visit/pharmacy.
// const AUDIT_ACTIONS = [
//   "LOGIN",
//   "PASSWORD_RESET",
//   "STAFF_CREATED",
//   "STAFF_OFFBOARDED",
//   "STAFF_PASSWORD_RESET",
//   "STAFF_ENABLED",
//   "STAFF_DISABLED",
//   "STAFF_COMPLIANCE_RECORDED",
//   "PATIENT_REGISTERED",
//   "PATIENT_UPDATED",
//   "PATIENT_MARKED_DECEASED",
//   "VISIT_CREATED",
//   "QUEUE_TOKEN_ISSUED",
//   "QUEUE_TOKEN_ISSUED_MANUAL",
//   "QUEUE_TOKEN_CALLED",
//   "PRESCRIPTION_CREATED",
//   "PRESCRIPTION_DISPENSED",
// ] as const;

// // Only the five modules AuditLogService.MODULE_ENTITY_TYPES actually maps
// // — see audit.ts's own why-note on why the rest of ModuleCode isn't offered
// // here.
// const MODULE_OPTIONS: { value: AuditModule; label: string }[] = [
//   { value: "SADM", label: "Platform Administration" },
//   { value: "IAM", label: "Identity & Staff" },
//   { value: "PREG", label: "Registration & EPR" },
//   { value: "RECQ", label: "Reception & Queue" },
//   { value: "PHRM", label: "Pharmacy" },
// ];

// function actionLabel(action: string): string {
//   const words = action.toLowerCase().split("_");
//   return words.map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
// }

// function formatDateTime(iso: string): string {
//   return new Date(iso).toLocaleString("en-ZA", {
//     day: "numeric",
//     month: "short",
//     year: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// // AUDT-US-0xx (Compliance Officer filters audit events) — the tenant-side
// // view of TenantAuditController's GET /api/v1/audit. Read-only by
// // construction: this page has no write affordance anywhere on it, matching
// // AC3 ("view but never edit any event") the same way the backend controller
// // enforces it — by simply never offering one.
// export function AuditLogPage() {
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [action, setAction] = useState("");
//   const [module, setModule] = useState<AuditModule | "">("");
//   const [entityIdInput, setEntityIdInput] = useState("");
//   const [entityId, setEntityId] = useState("");
//   const [userId, setUserId] = useState("");
//   const [userIdInput, setUserIdInput] = useState("");

//   // Debounced, same 350ms pattern as PatientSearchPage/OrganizationsPage —
//   // an entity id or user id is free text here, not a select, so this
//   // avoids firing a request on every keystroke.
//   useEffect(() => {
//     const timeout = setTimeout(() => setEntityId(entityIdInput.trim()), 350);
//     return () => clearTimeout(timeout);
//   }, [entityIdInput]);

//   useEffect(() => {
//     const timeout = setTimeout(() => setUserId(userIdInput.trim()), 350);
//     return () => clearTimeout(timeout);
//   }, [userIdInput]);

//   // ORG_ADMIN-only server-side (StaffController.list()'s own
//   // /api/v1/admin/** gate) — a Compliance Officer, this story's actual
//   // persona, does NOT hold ORG_ADMIN and will get a 403 here. retry:false
//   // so that 403 resolves quickly rather than retrying; isError below is
//   // what drives the fallback to a plain UUID field.
//   const staffQuery = useQuery({
//     queryKey: ["staff", "list"],
//     queryFn: listStaff,
//     retry: false,
//   });
//   const staffDirectoryAvailable = !staffQuery.isError;

//   const auditQuery = useQuery({
//     queryKey: ["audit", { from, to, userId, action, module, entityId }],
//     queryFn: () =>
//       listAuditLog({
//         from: from || undefined,
//         to: to || undefined,
//         userId: userId || undefined,
//         action: action || undefined,
//         module: module || undefined,
//         entityId: entityId || undefined,
//       }),
//     retry: false,
//   });

//   const hasActiveFilters =
//     from !== "" || to !== "" || userId !== "" || action !== "" || module !== "" || entityId !== "";

//   const clearFilters = () => {
//     setFrom("");
//     setTo("");
//     setAction("");
//     setModule("");
//     setEntityIdInput("");
//     setUserId("");
//     setUserIdInput("");
//   };

//   const isForbidden = auditQuery.error instanceof ApiError && auditQuery.error.status === 403;
//   const entries = auditQuery.data ?? [];

//   return (
//     <div>
//       <PageHeader
//         title="Audit trail"
//         description="Filter your organization's activity by date, user, action, module or record."
//       />

//       {!isForbidden && (
//         <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
//           <div className="flex flex-col gap-1.5">
//             <label htmlFor="audit-from" className="text-[13px] font-medium text-text-primary">
//               From
//             </label>
//             <input
//               id="audit-from"
//               type="date"
//               value={from}
//               max={to || undefined}
//               onChange={(e) => setFrom(e.target.value)}
//               className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
//             />
//           </div>

//           <div className="flex flex-col gap-1.5">
//             <label htmlFor="audit-to" className="text-[13px] font-medium text-text-primary">
//               To
//             </label>
//             <input
//               id="audit-to"
//               type="date"
//               value={to}
//               min={from || undefined}
//               onChange={(e) => setTo(e.target.value)}
//               className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
//             />
//           </div>

//           <FilterSelect
//             id="audit-action"
//             label="Action"
//             value={action}
//             onChange={setAction}
//             options={[{ value: "", label: "All actions" }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))]}
//           />

//           <FilterSelect
//             id="audit-module"
//             label="Module"
//             value={module}
//             onChange={(v) => setModule(v as AuditModule | "")}
//             options={[{ value: "", label: "All modules" }, ...MODULE_OPTIONS]}
//           />

//           {staffDirectoryAvailable ? (
//             <FilterSelect
//               id="audit-user"
//               label="User"
//               value={userId}
//               onChange={setUserId}
//               options={[
//                 { value: "", label: "All users" },
//                 ...(staffQuery.data ?? []).map((s) => ({
//                   value: s.id,
//                   label: `${s.firstName} ${s.lastName}`,
//                 })),
//               ]}
//             />
//           ) : (
//             <div className="flex flex-col gap-1.5">
//               <label htmlFor="audit-user-id" className="text-[13px] font-medium text-text-primary">
//                 User ID
//               </label>
//               <input
//                 id="audit-user-id"
//                 type="text"
//                 placeholder="Paste a user's ID…"
//                 value={userIdInput}
//                 onChange={(e) => setUserIdInput(e.target.value)}
//                 className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 font-mono text-[13px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-48"
//               />
//             </div>
//           )}

//           {/* <div className="flex-1 sm:min-w-[200px]">
//             <Input
//               label="Affected record (entity ID)"
//               placeholder="Paste a record's ID…"
//               value={entityIdInput}
//               onChange={(e) => setEntityIdInput(e.target.value)}
//             />
//           </div> */}

//           {hasActiveFilters && (
//             <button
//               type="button"
//               onClick={clearFilters}
//               className="h-11 shrink-0 rounded-lg px-3 text-[13.5px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
//             >
//               Clear filters
//             </button>
//           )}
//         </div>
//       )}

//       <Card className="overflow-hidden p-0">
//         {isForbidden ? (
//           <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
//             <ShieldAlert className="size-6 text-text-secondary" aria-hidden />
//             <p className="text-[14px] text-text-secondary">
//               Your role doesn't have access to the audit trail. Contact your organization admin if you believe this
//               is wrong.
//             </p>
//           </div>
//         ) : auditQuery.isLoading ? (
//           <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading audit trail…</p>
//         ) : auditQuery.isError ? (
//           <p className="px-5 py-10 text-center text-[14px] text-danger-600">
//             Couldn't load the audit trail. Try again.
//           </p>
//         ) : entries.length === 0 ? (
//           <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
//             <ClipboardList className="size-6 text-text-secondary" aria-hidden />
//             <p className="text-[14px] text-text-secondary">
//               {hasActiveFilters ? "No activity matches your filters." : "No activity recorded yet."}
//             </p>
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full border-collapse text-left">
//               <thead>
//                 <tr className="border-b border-border-subtle">
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     Timestamp
//                   </th>
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     Action
//                   </th>
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     User
//                   </th>
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     Record
//                   </th>
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     Detail
//                   </th>
//                   <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
//                     IP / device
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-border-subtle">
//                 {entries.map((entry) => (
//                   <tr key={entry.id} className="transition-colors duration-150 hover:bg-surface-sunken">
//                     <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
//                       {formatDateTime(entry.createdAt)}
//                     </td>
//                     <td className="px-5 py-3.5">
//                       <span className="inline-flex rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
//                         {actionLabel(entry.action)}
//                       </span>
//                     </td>
//                     <td className="px-5 py-3.5 text-[13.5px] text-text-primary">{entry.userName}</td>
//                     <td className="px-5 py-3.5">
//                       <p className="text-[13px] text-text-primary">{entry.entityType}</p>
//                       <p className="font-mono text-[12px] text-text-secondary">{entry.entityId}</p>
//                     </td>
//                     <td className="max-w-xs px-5 py-3.5 text-[12px] text-text-secondary">
//                       {entry.beforeValue || entry.afterValue ? (
//                         <div className="flex flex-col gap-0.5 font-mono">
//                           {entry.beforeValue && <span className="truncate">before: {entry.beforeValue}</span>}
//                           {entry.afterValue && <span className="truncate">after: {entry.afterValue}</span>}
//                         </div>
//                       ) : (
//                         "—"
//                       )}
//                     </td>
//                     <td className="max-w-[220px] px-5 py-3.5 text-[12px] text-text-secondary">
//                       {entry.ipAddress && <p className="font-mono">{entry.ipAddress}</p>}
//                       {entry.deviceSignature && (
//                         <p className="truncate" title={entry.deviceSignature}>
//                           {entry.deviceSignature}
//                         </p>
//                       )}
//                       {!entry.ipAddress && !entry.deviceSignature && "—"}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>
//     </div>
//   );
// }

// interface FilterSelectProps {
//   id: string;
//   label: string;
//   value: string;
//   onChange: (value: string) => void;
//   options: { value: string; label: string }[];
// }

// function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps) {
//   return (
//     <div className="flex flex-col gap-1.5">
//       <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
//         {label}
//       </label>
//       <div className="relative">
//         <select
//           id={id}
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
//           className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-48"
//         >
//           {options.map((opt) => (
//             <option key={opt.value} value={opt.value}>
//               {opt.label}
//             </option>
//           ))}
//         </select>
//         <ChevronDown
//           className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
//           aria-hidden
//         />
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ClipboardList, ShieldAlert, ShieldCheck } from "lucide-react";
import { listAuditLog, type AuditModule } from "@/shared/api/audit";
import { listStaff } from "@/shared/api/staff";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

const AUDIT_ACTIONS = [
  "LOGIN",
  "PASSWORD_RESET",
  "STAFF_CREATED",
  "STAFF_OFFBOARDED",
  "STAFF_PASSWORD_RESET",
  "STAFF_ENABLED",
  "STAFF_DISABLED",
  "STAFF_COMPLIANCE_RECORDED",
  "PATIENT_REGISTERED",
  "PATIENT_UPDATED",
  "PATIENT_MARKED_DECEASED",
  "VISIT_CREATED",
  "QUEUE_TOKEN_ISSUED",
  "QUEUE_TOKEN_ISSUED_MANUAL",
  "QUEUE_TOKEN_CALLED",
  "PRESCRIPTION_CREATED",
  "PRESCRIPTION_DISPENSED",
] as const;

const MODULE_OPTIONS: { value: AuditModule; label: string }[] = [
  { value: "SADM", label: "Platform Administration" },
  { value: "IAM", label: "Identity & Staff" },
  { value: "PREG", label: "Registration & EPR" },
  { value: "RECQ", label: "Reception & Queue" },
  { value: "PHRM", label: "Pharmacy" },
];

// BR-AUDT-030 — a fixed 3-state toggle, not a checkbox: "unset" has to be a
// real, distinct option (show everything) alongside "privileged only" and
// "non-privileged only," which a plain boolean checkbox can't express.
const PRIVILEGED_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All events" },
  { value: "true", label: "Privileged only" },
  { value: "false", label: "Non-privileged only" },
];

function actionLabel(action: string): string {
  const words = action.toLowerCase().split("_");
  return words.map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [module, setModule] = useState<AuditModule | "">("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [entityId, setEntityId] = useState("");
  const [userId, setUserId] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [privileged, setPrivileged] = useState<"" | "true" | "false">("");

  useEffect(() => {
    const timeout = setTimeout(() => setEntityId(entityIdInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [entityIdInput]);

  useEffect(() => {
    const timeout = setTimeout(() => setUserId(userIdInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [userIdInput]);

  const staffQuery = useQuery({
    queryKey: ["staff", "list"],
    queryFn: listStaff,
    retry: false,
  });
  const staffDirectoryAvailable = !staffQuery.isError;

  const auditQuery = useQuery({
    queryKey: ["audit", { from, to, userId, action, module, entityId, privileged }],
    queryFn: () =>
      listAuditLog({
        from: from || undefined,
        to: to || undefined,
        userId: userId || undefined,
        action: action || undefined,
        module: module || undefined,
        entityId: entityId || undefined,
        privileged: privileged === "" ? undefined : privileged === "true",
      }),
    retry: false,
  });

  const hasActiveFilters =
    from !== "" || to !== "" || userId !== "" || action !== "" || module !== "" || entityId !== "" || privileged !== "";

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setAction("");
    setModule("");
    setEntityIdInput("");
    setUserId("");
    setUserIdInput("");
    setPrivileged("");
  };

  const isForbidden = auditQuery.error instanceof ApiError && auditQuery.error.status === 403;
  const entries = auditQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Filter your organization's activity by date, user, action, module or record."
      />

      {!isForbidden && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-from" className="text-[13px] font-medium text-text-primary">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="audit-to" className="text-[13px] font-medium text-text-primary">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
            />
          </div>

          <FilterSelect
            id="audit-action"
            label="Action"
            value={action}
            onChange={setAction}
            options={[{ value: "", label: "All actions" }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))]}
          />

          <FilterSelect
            id="audit-module"
            label="Module"
            value={module}
            onChange={(v) => setModule(v as AuditModule | "")}
            options={[{ value: "", label: "All modules" }, ...MODULE_OPTIONS]}
          />

          <FilterSelect
            id="audit-privileged"
            label="Privileged"
            value={privileged}
            onChange={(v) => setPrivileged(v as "" | "true" | "false")}
            options={PRIVILEGED_OPTIONS}
          />

          {staffDirectoryAvailable ? (
            <FilterSelect
              id="audit-user"
              label="User"
              value={userId}
              onChange={setUserId}
              options={[
                { value: "", label: "All users" },
                ...(staffQuery.data ?? []).map((s) => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName}`,
                })),
              ]}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="audit-user-id" className="text-[13px] font-medium text-text-primary">
                User ID
              </label>
              <input
                id="audit-user-id"
                type="text"
                placeholder="Paste a user's ID…"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 font-mono text-[13px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-48"
              />
            </div>
          )}

          <div className="flex-1 sm:min-w-[200px]">
            {/* <Input
              label="Affected record (entity ID)"
              placeholder="Paste a record's ID…"
              value={entityIdInput}
              onChange={(e) => setEntityIdInput(e.target.value)}
            /> */}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 shrink-0 rounded-lg px-3 text-[13.5px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {isForbidden ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <ShieldAlert className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              Your role doesn't have access to the audit trail. Contact your organization admin if you believe this
              is wrong.
            </p>
          </div>
        ) : auditQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading audit trail…</p>
        ) : auditQuery.isError ? (
          <p className="px-5 py-10 text-center text-[14px] text-danger-600">
            Couldn't load the audit trail. Try again.
          </p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <ClipboardList className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              {hasActiveFilters ? "No activity matches your filters." : "No activity recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Timestamp
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Action
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    User
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Record
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Detail
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    IP / device
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                          {actionLabel(entry.action)}
                        </span>
                        {/* BR-AUDT-030 AC1 — the flag itself, shown inline next
                            to the action rather than as its own column: this is
                            what a Compliance Officer is scanning the table FOR,
                            so it needs to be visible without scrolling right. */}
                        {entry.privileged && (
                          <span title="This action was performed by a platform operator">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-600">
                              <ShieldCheck className="size-3" aria-hidden />
                              Privileged
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">{entry.userName}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-text-primary">{entry.entityType}</p>
                      <p className="font-mono text-[12px] text-text-secondary">{entry.entityId}</p>
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-[12px] text-text-secondary">
                      {entry.beforeValue || entry.afterValue ? (
                        <div className="flex flex-col gap-0.5 font-mono">
                          {entry.beforeValue && <span className="truncate">before: {entry.beforeValue}</span>}
                          {entry.afterValue && <span className="truncate">after: {entry.afterValue}</span>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[220px] px-5 py-3.5 text-[12px] text-text-secondary">
                      {entry.ipAddress && <p className="font-mono">{entry.ipAddress}</p>}
                      {entry.deviceSignature && (
                        <p className="truncate" title={entry.deviceSignature}>
                          {entry.deviceSignature}
                        </p>
                      )}
                      {!entry.ipAddress && !entry.deviceSignature && "—"}
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

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-48"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
      </div>
    </div>
  );
}