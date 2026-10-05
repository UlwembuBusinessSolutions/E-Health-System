import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ClipboardList, Download } from "lucide-react";
import { exportTenantAudit, listTenantAudit } from "@/shared/api/audit";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

const PAGE_SIZE = 50;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// SCREAMING_SNAKE_CASE (AuditLog.action's own convention) -> "Sentence
// case" — platform/AuditPage.tsx and platform/OrganizationDetailPage.tsx
// each keep their own copy of this same three-line pure function rather
// than a shared util; this is the tenant app's own copy of the same
// convention, not worth breaking for a fourth caller.
function actionLabel(action: string): string {
  const words = action.toLowerCase().split("_");
  return words.map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
}

// This organization's own activity, viewed by its own ORG_ADMIN from
// inside the tenant app — the /app counterpart to the Platform Console's
// OrganizationDetailPage.tsx audit card, which is a platform operator
// looking in at an arbitrary org from outside. Defaults from/to to today
// on first load — an established org's trail can run to thousands of
// rows, and loading every one of them on every page open is exactly the
// slow-load problem this default (and the date filter widening past it)
// exists to avoid; TenantAuditController's own why-note on the same
// default from the backend side.
export function AuditTrailPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());

  const auditQuery = useQuery({
    queryKey: ["tenant", "audit", { from, to, page }],
    queryFn: () => listTenantAudit({ page, size: PAGE_SIZE, from: from || undefined, to: to || undefined }),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportTenantAudit({ from: from || undefined, to: to || undefined }),
    onSuccess: () => showToast("Audit trail exported.", "success"),
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't export the audit trail. Try again.", "error");
    },
  });

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  const hasActiveFilters = from !== "" || to !== "";
  const entries = auditQuery.data?.items ?? [];
  const totalItems = auditQuery.data?.totalItems ?? 0;
  const hasMore = auditQuery.data?.hasMore ?? false;

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Every action recorded across your organization — staff sign-ins, record changes, and more."
        action={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </Button>
        }
      />

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
            onChange={(e) => updateFilter(setFrom, e.target.value)}
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
            onChange={(e) => updateFilter(setTo, e.target.value)}
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              setPage(0);
            }}
            className="h-11 rounded-lg px-3 text-[13.5px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-50"
          >
            Show all history
          </button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {auditQuery.isLoading ? (
          <div className="flex flex-col gap-3 px-5 py-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-surface-sunken" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : auditQuery.isError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="alert"
            className="flex flex-col items-center gap-3 px-5 py-10 text-center"
          >
            <p className="text-[13.5px] text-text-secondary">The audit trail couldn't be loaded. Please try again.</p>
            <Button variant="secondary" loading={auditQuery.isFetching} onClick={() => void auditQuery.refetch()}>
              Retry
            </Button>
          </motion.div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 px-5 py-10 text-center"
          >
            <ClipboardList className="size-5 text-text-secondary" aria-hidden />
            <p className="text-[13.5px] text-text-secondary">
              {hasActiveFilters ? "No activity in this date range." : "No activity recorded yet."}
            </p>
          </motion.div>
        ) : (
          <div className="divide-y divide-border-subtle">
            <AnimatePresence initial={false}>
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }}
                  className="flex flex-col gap-1 px-5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                        {actionLabel(entry.action)}
                      </span>
                      <span className="truncate text-[13px] text-text-secondary">
                        {entry.actorName} · {entry.entityType}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[12.5px] text-text-secondary tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  {(entry.beforeValue || entry.afterValue) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-0.5 font-mono text-[11px] text-text-secondary">
                      {entry.beforeValue && <span>before: {entry.beforeValue}</span>}
                      {entry.afterValue && <span>after: {entry.afterValue}</span>}
                    </div>
                  )}
                  {(entry.ipAddress || entry.deviceSignature) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-0.5 font-mono text-[11px] text-text-secondary">
                      {entry.ipAddress && <span>ip: {entry.ipAddress}</span>}
                      {entry.deviceSignature && (
                        <span className="max-w-[420px] truncate" title={entry.deviceSignature}>
                          device: {entry.deviceSignature}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {!auditQuery.isLoading && !auditQuery.isError && entries.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-[12px] text-text-secondary">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + entries.length} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronLeft className="size-3.5" aria-hidden />}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronRight className="size-3.5" aria-hidden />}
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
