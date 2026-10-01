import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  exportPlatformAudit,
  listOrganizations,
  listPlatformAudit,
  type PlatformAuditEntry,
} from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { AuditEventDrawer } from "./AuditEventDrawer";
import {
  AUDIT_GROUPS,
  actionAppearance,
  actionLabel,
  auditDate,
  auditTime,
} from "./auditPresentation";
import "./AuditPage.css";

function validDate(value: string | null): string {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    return "";
  return new Date(value).toISOString().slice(0, 10) === value ? value : "";
}
function periodDates(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function AuditPage() {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [find, setFind] = useState("");
  const [selected, setSelected] = useState<PlatformAuditEntry | null>(null);
  const action = params.get("action") ?? "";
  const organizationId = params.get("organizationId") ?? "";
  const from = validDate(params.get("from"));
  const to = validDate(params.get("to"));
  const rawPage = Number(params.get("page") ?? 0);
  const page =
    Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage < 1000000
      ? rawPage
      : 0;
  const size = [25, 50, 100].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 50;
  const invalidRange = !!from && !!to && from > to;
  const filters = {
    action: action || undefined,
    organizationId: organizationId || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", "all"],
    queryFn: () => listOrganizations({ sort: "newest" }),
  });
  const auditQuery = useQuery({
    queryKey: ["platform", "audit", { ...filters, page, size }],
    queryFn: () => listPlatformAudit({ ...filters, page, size }),
    enabled: !invalidRange,
  });
  const exportMutation = useMutation({
    mutationFn: () => exportPlatformAudit(filters),
    onSuccess: () => showToast("Audit trail exported.", "success"),
    onError: (error) =>
      showToast(
        error instanceof ApiError
          ? error.message
          : "Couldn't export the audit trail. Try again.",
        "error",
      ),
  });
  function update(changes: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("page");
    setParams(next);
    setFind("");
  }
  function clearFilters() {
    update({ action: "", organizationId: "", from: "", to: "" });
  }
  const hasFilters = !!(action || organizationId || from || to);
  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.totalItems ?? 0;
  const term = find.trim().toLowerCase();
  // This is deliberately a page-local finder: the existing API does not
  // accept free-text search. Keep scope explicit and exports unambiguous.
  const visible = entries.filter(
    (entry) =>
      !term ||
      [
        entry.id,
        entry.operatorName,
        entry.operatorEmail,
        entry.organizationName,
        entry.action,
        actionLabel(entry.action),
        entry.detail,
        entry.ipAddress,
      ].some((value) => value?.toLowerCase().includes(term)),
  );
  const organizationName = organizationsQuery.data?.find(
    (org) => org.id === organizationId,
  )?.displayName;
  const stale = auditQuery.isError && !!auditQuery.data;
  const canExport =
    !invalidRange &&
    !!auditQuery.data &&
    total > 0 &&
    total <= 10000 &&
    !term &&
    !auditQuery.isError &&
    !auditQuery.isFetching;
  const activePeriod =
    !from && !to
      ? 0
      : [1, 7, 30].find((days) => {
          const period = periodDates(days);
          return period.from === from && period.to === to;
        });

  return (
    <div className="audit-workspace">
      <header className="audit-page-header">
        <div>
          <p className="audit-eyebrow">
            <ShieldCheck size={14} aria-hidden /> PLATFORM OVERSIGHT
          </p>
          <h1>
            Audit trail
            <span className="audit-readonly">
              <LockKeyhole size={11} aria-hidden /> Read only
            </span>
          </h1>
          <p className="audit-page-description">
            A clear record of who did what, and when.
          </p>
        </div>
        <div className="audit-header-actions">
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} aria-hidden />}
            loading={auditQuery.isFetching}
            disabled={invalidRange}
            onClick={() => void auditQuery.refetch()}
          >
            Refresh
          </Button>
          <Button
            icon={<Download size={15} aria-hidden />}
            loading={exportMutation.isPending}
            disabled={!canExport}
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </Button>
        </div>
      </header>

      <section className="audit-overview" aria-label="Audit scope">
        <div className="audit-overview-intro">
          <span className="audit-overview-icon">
            <History size={23} aria-hidden />
          </span>
          <div>
            <strong>Platform activity</strong>
            <p>Organization changes, access and administration</p>
          </div>
        </div>
        <div className="audit-overview-stat">
          <span>Matching events</span>
          <strong>
            {auditQuery.data && !invalidRange ? total.toLocaleString() : "—"}
          </strong>
        </div>
        <div className="audit-overview-stat">
          <span>Time standard</span>
          <strong className="audit-time-standard">
            <Clock3 size={14} aria-hidden /> UTC
          </strong>
        </div>
      </section>

      <section className="audit-filter-panel" aria-label="Filter audit trail">
        <div className="audit-filter-top">
          <span className="audit-filter-caption">
            <Filter size={14} aria-hidden /> Filter activity
          </span>
          <div className="audit-periods" aria-label="Quick date ranges">
            {[
              { days: 0, label: "All time" },
              { days: 1, label: "Today" },
              { days: 7, label: "7 days" },
              { days: 30, label: "30 days" },
            ].map(({ days, label }) => (
              <button
                type="button"
                key={days}
                aria-pressed={activePeriod === days}
                onClick={() =>
                  update(days ? periodDates(days) : { from: "", to: "" })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="audit-filter-grid">
          <label>
            Action
            <select
              aria-label="Action"
              value={action}
              onChange={(event) => update({ action: event.target.value })}
            >
              <option value="">All actions</option>
              {action &&
                !AUDIT_GROUPS.some((group) =>
                  group.actions.includes(action),
                ) && <option value={action}>{actionLabel(action)}</option>}
              {AUDIT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((code) => (
                    <option value={code} key={code}>
                      {actionLabel(code)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Organization
            <select
              aria-label="Organization"
              value={organizationId}
              disabled={organizationsQuery.isLoading}
              onChange={(event) =>
                update({ organizationId: event.target.value })
              }
            >
              <option value="">All organizations</option>
              {organizationId && !organizationName && (
                <option value={organizationId}>Selected organization</option>
              )}
              {(organizationsQuery.data ?? []).map((org) => (
                <option value={org.id} key={org.id}>
                  {org.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            From (UTC)
            <input
              type="date"
              value={from}
              max={to || "9999-12-31"}
              onChange={(event) => update({ from: event.target.value })}
            />
          </label>
          <label>
            To (UTC)
            <input
              type="date"
              value={to}
              min={from || undefined}
              max="9999-12-31"
              onChange={(event) => update({ to: event.target.value })}
            />
          </label>
        </div>
        {organizationsQuery.isError && (
          <p className="audit-filter-warning" role="alert">
            Organization options couldn't be loaded.{" "}
            <button
              type="button"
              onClick={() => void organizationsQuery.refetch()}
            >
              Retry organization list
            </button>
          </p>
        )}
        {invalidRange && (
          <p className="audit-filter-warning" role="alert">
            Choose an end date on or after the start date.
          </p>
        )}
        {hasFilters && (
          <div className="audit-filter-chips" aria-label="Active filters">
            {action && (
              <button
                onClick={() => update({ action: "" })}
                aria-label="Remove action filter"
              >
                {actionLabel(action)}
                <X size={12} aria-hidden />
              </button>
            )}
            {organizationId && (
              <button
                onClick={() => update({ organizationId: "" })}
                aria-label="Remove organization filter"
              >
                {organizationName ?? "Selected organization"}
                <X size={12} aria-hidden />
              </button>
            )}
            {(from || to) && (
              <button
                onClick={() => update({ from: "", to: "" })}
                aria-label="Remove date filter"
              >
                <CalendarDays size={12} aria-hidden />
                {from || "Any start"} – {to || "Any end"}
                <X size={12} aria-hidden />
              </button>
            )}
            <button className="audit-clear" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section
        className="audit-results"
        aria-labelledby="audit-activity-title"
        aria-busy={auditQuery.isFetching}
      >
        <div className="audit-results-header">
          <div>
            <h2 id="audit-activity-title">
              Activity log{" "}
              <span>
                {auditQuery.data && !invalidRange
                  ? total.toLocaleString()
                  : "—"}
              </span>
            </h2>
            <p role="status">
              {invalidRange
                ? "Update the date range to view events"
                : auditQuery.isFetching
                  ? "Updating activity…"
                  : stale
                    ? "Showing previously loaded activity"
                    : auditQuery.dataUpdatedAt
                      ? `Updated ${auditTime(new Date(auditQuery.dataUpdatedAt).toISOString())} UTC · Newest first`
                      : "Platform-level events across your organizations"}
            </p>
          </div>
          <label className="audit-search">
            <Search size={15} aria-hidden />
            <span className="sr-only">Find on this page</span>
            <input
              type="search"
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Find on this page…"
              disabled={!entries.length || invalidRange}
            />
          </label>
        </div>
        {stale && (
          <div className="audit-stale" role="alert">
            Refresh failed. These results may be out of date.{" "}
            <button onClick={() => void auditQuery.refetch()}>Try again</button>
          </div>
        )}
        {term && (
          <div className="audit-find-note" role="status">
            {visible.length} of {entries.length} events on this page match “
            {find}”.{" "}
            <button onClick={() => setFind("")}>Clear page search</button>
            <span>Clear this search to export the filtered audit trail.</span>
          </div>
        )}
        {invalidRange ? (
          <EmptyState
            title="Check your date range"
            description="The start date must come before or on the end date."
          />
        ) : auditQuery.isLoading ? (
          <div className="audit-skeleton" role="status">
            <span className="sr-only">Loading audit events</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : auditQuery.isError && !auditQuery.data ? (
          <EmptyState
            title={
              auditQuery.error instanceof ApiError &&
              auditQuery.error.status === 403
                ? "Audit access is restricted"
                : "Couldn't load the audit trail"
            }
            description="No activity has been confirmed. Try again or check your access."
            action={
              <Button
                variant="secondary"
                onClick={() => void auditQuery.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              term
                ? "No matches on this page"
                : hasFilters
                  ? "No activity matches your filters"
                  : page > 0
                    ? "No events on this page"
                    : "Your audit trail starts here"
            }
            description={
              term
                ? "Try an operator, organization, action or event reference."
                : hasFilters
                  ? "Try a wider date range or remove a filter."
                  : page > 0
                    ? "Return to the first page to see the latest activity."
                    : "Platform activity will appear here as actions are recorded."
            }
            action={
              term ? (
                <Button variant="secondary" onClick={() => setFind("")}>
                  Clear page search
                </Button>
              ) : hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : page > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => update({ page: "" }, false)}
                >
                  First page
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="audit-table-wrap" role="region" aria-label="Audit events" tabIndex={0}>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th scope="col">Event / activity</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Operator</th>
                    <th scope="col">When · UTC</th>
                    <th scope="col">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      onSelect={() => setSelected(entry)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="audit-mobile-events">
              {visible.map((entry) => {
                const { icon: Icon, attention } = actionAppearance(
                  entry.action,
                );
                return (
                  <button
                    type="button"
                    className="audit-mobile-event"
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    aria-label={`View ${actionLabel(entry.action)} details`}
                  >
                    <span
                      className={`audit-event-icon ${attention ? "audit-attention" : ""}`}
                    >
                      <Icon size={17} aria-hidden />
                    </span>
                    <span>
                      <strong>{actionLabel(entry.action)}</strong>
                      <span>
                        {entry.organizationName ??
                          (entry.organizationId
                            ? "Organization"
                            : "Platform-wide")}
                      </span>
                      <span>{entry.operatorName}</span>
                      <time dateTime={entry.createdAt}>
                        {auditDate(entry.createdAt)} ·{" "}
                        {auditTime(entry.createdAt)} UTC
                      </time>
                    </span>
                    <ChevronRight size={15} aria-hidden />
                  </button>
                );
              })}
            </div>
          </>
        )}
        {!invalidRange && auditQuery.data && (
          <div className="audit-pagination">
            <p>
              {total === 0
                ? "0 events"
                : entries.length
                  ? `${page * size + 1}–${page * size + entries.length} of ${total.toLocaleString()} events`
                  : `Page ${page + 1} · No events`}
              {term && " · before page search"}
            </p>
            <div>
              <label>
                Rows
                <select
                  aria-label="Events per page"
                  value={size}
                  onChange={(event) => update({ size: event.target.value })}
                >
                  {[25, 50, 100].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="audit-icon-button"
                aria-label="Previous page"
                disabled={page === 0 || auditQuery.isFetching}
                onClick={() => update({ page: String(page - 1) }, false)}
              >
                <ChevronLeft size={17} aria-hidden />
              </button>
              <span>Page {page + 1}</span>
              <button
                type="button"
                className="audit-icon-button"
                aria-label="Next page"
                disabled={!auditQuery.data.hasMore || auditQuery.isFetching}
                onClick={() => update({ page: String(page + 1) }, false)}
              >
                <ChevronRight size={17} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>
      <footer className="audit-page-footer">
        <span>
          <LockKeyhole size={12} aria-hidden /> Platform administration only.
          Clinical history remains in organization records.
        </span>
        <span>Dates and times in UTC</span>
      </footer>
      {total > 10000 && (
        <p className="audit-filter-warning">
          Narrow your filters to 10,000 events or fewer to export a complete
          CSV.
        </p>
      )}
      {selected && (
        <AuditEventDrawer
          key={selected.id}
          entry={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function AuditRow({
  entry,
  onSelect,
}: {
  entry: PlatformAuditEntry;
  onSelect: () => void;
}) {
  const { icon: Icon, category, attention } = actionAppearance(entry.action);
  const initials = entry.operatorName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  return (
    <tr>
      <td>
        <button
          type="button"
          className="audit-activity-button"
          onClick={onSelect}
          aria-label={`View ${actionLabel(entry.action)} details`}
        >
          <span
            className={`audit-event-icon ${attention ? "audit-attention" : ""}`}
          >
            <Icon size={17} aria-hidden />
          </span>
          <span>
            <strong>{actionLabel(entry.action)}</strong>
            <span className={attention ? "audit-attention-text" : ""}>
              {category}
            </span>
          </span>
        </button>
      </td>
      <td>
        {entry.organizationId ? (
          <Link
            className="audit-org-link"
            to={`/platform/organizations/${entry.organizationId}`}
          >
            {entry.organizationName ?? "Organization"}
          </Link>
        ) : (
          <span className="audit-platform-label">
            <Building2 size={12} aria-hidden /> Platform-wide
          </span>
        )}
      </td>
      <td>
        <div className="audit-actor">
          <span className="audit-avatar" aria-hidden>
            {initials}
          </span>
          <div>
            <strong>{entry.operatorName}</strong>
            <span>{entry.operatorEmail ?? "Email not recorded"}</span>
          </div>
        </div>
      </td>
      <td>
        <time dateTime={entry.createdAt}>
          <strong>{auditDate(entry.createdAt)}</strong>
          <span>{auditTime(entry.createdAt)}</span>
        </time>
      </td>
      <td>
        <button
          type="button"
          className="audit-icon-button audit-row-arrow"
          aria-label={`Open event ${entry.id}`}
          onClick={onSelect}
        >
          <ArrowRight size={16} aria-hidden />
        </button>
      </td>
    </tr>
  );
}
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="audit-empty">
      <span className="audit-empty-icon">
        <History size={26} aria-hidden />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
