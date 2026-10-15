import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileClock,
  History,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  exportOrganizationAudit,
  listOrganizationAudit,
  type TenantAuditEntry,
} from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { actionLabel, auditDate, auditTime } from "./auditPresentation";
import "./OrganizationAuditTrail.css";

function prettySnapshot(value: string | null): string {
  if (value === null) return "Not recorded";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
function eventIcon(action: string) {
  if (/LOGIN|PASSWORD|LOCKED|DENIED/.test(action)) return KeyRound;
  if (/STAFF|USER|ADMIN/.test(action)) return UserRound;
  return FileClock;
}

export function OrganizationAuditTrail({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [search, setSearch] = useState("");
  const { showToast } = useToast();
  const query = useQuery({
    queryKey: [
      "platform",
      "organizations",
      organizationId,
      "audit",
      page,
      size,
    ],
    queryFn: () => listOrganizationAudit(organizationId, page, size),
    enabled: !!organizationId,
  });
  const exportAudit = useMutation({
    mutationFn: () => exportOrganizationAudit(organizationId),
    onSuccess: () => showToast("Organization audit trail exported.", "success"),
    onError: (error) =>
      showToast(
        error instanceof ApiError
          ? error.message
          : "Couldn't export the audit trail. Try again.",
        "error",
      ),
  });
  const entries = query.data?.items ?? [];
  const total = query.data?.totalItems ?? 0;
  const term = search.trim().toLowerCase();
  const visible = entries.filter(
    (entry) =>
      !term ||
      [
        entry.actorName,
        entry.action,
        actionLabel(entry.action),
        entry.entityType,
        entry.entityId,
        entry.id,
      ].some((value) => value.toLowerCase().includes(term)),
  );
  const stale = query.isError && !!query.data;
  const groups = visible.reduce<
    Array<{ day: string; entries: TenantAuditEntry[] }>
  >((days, entry) => {
    const day = entry.createdAt.slice(0, 10);
    if (days.at(-1)?.day === day) days.at(-1)!.entries.push(entry);
    else days.push({ day, entries: [entry] });
    return days;
  }, []);
  function changePage(next: number) {
    setPage(next);
    setSearch("");
  }
  async function copyReference(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      showToast("Event ID copied.", "success");
    } catch {
      showToast(
        "Couldn't copy. Select the event ID to copy it manually.",
        "error",
      );
    }
  }

  return (
    <section className="org-audit" aria-labelledby="organization-audit-heading">
      <header className="org-audit-header">
        <div className="org-audit-heading">
          <span className="org-audit-emblem" aria-hidden>
            <ShieldCheck size={28} strokeWidth={1.5} />
            <span>
              <History size={12} strokeWidth={2} />
            </span>
          </span>
          <div>
            <p className="org-audit-eyebrow">ORGANIZATION ACTIVITY</p>
            <h2 id="organization-audit-heading">
              Audit trail{" "}
              <span>
                <LockKeyhole size={10} aria-hidden /> Read only
              </span>
            </h2>
            <p>Staff access and record changes, in one clear timeline.</p>
          </div>
        </div>
        <div className="org-audit-actions">
          <Button
            variant="secondary"
            aria-label="Refresh organization audit"
            icon={<RefreshCw size={14} aria-hidden />}
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            icon={<Download size={14} aria-hidden />}
            loading={exportAudit.isPending}
            disabled={
              !query.data ||
              query.isFetching ||
              query.isError ||
              total === 0 ||
              total > 10000 ||
              !!term
            }
            onClick={() => exportAudit.mutate()}
          >
            Export CSV
          </Button>
        </div>
      </header>
      <div className="org-audit-toolbar">
        <div className="org-audit-count">
          <strong>{query.data ? total.toLocaleString() : "—"}</strong>
          <span>recorded events</span>
          <span className="org-audit-dot" />
          <span>
            <Clock3 size={12} aria-hidden /> Newest first · UTC
          </span>
        </div>
        <label className="org-audit-search">
          <Search size={15} aria-hidden />
          <span className="sr-only">Find in organization audit page</span>
          <input
            type="search"
            placeholder="Find on this page…"
            value={search}
            disabled={!entries.length}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {stale && (
        <p className="org-audit-notice" role="alert">
          Refresh failed. Showing previously loaded events.{" "}
          <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      {term && (
        <p className="org-audit-search-note" role="status">
          {visible.length} of {entries.length} events on this page match your
          search. <button onClick={() => setSearch("")}>Clear search</button>
          <span>
            Clear the page search to export the organization’s audit trail.
          </span>
        </p>
      )}
      {total > 10000 && (
        <p className="org-audit-notice">
          This trail exceeds the current 10,000-event export limit. Export is
          unavailable to avoid an incomplete file.
        </p>
      )}
      {query.isLoading ? (
        <div className="org-audit-loading" role="status">
          <span className="sr-only">Loading organization audit</span>
          {[1, 2, 3, 4].map((row) => (
            <div key={row}>
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : query.isError && !query.data ? (
        <div className="org-audit-empty" role="alert">
          <History size={28} aria-hidden />
          <h3>Couldn't load this audit trail</h3>
          <p>
            Activity is unavailable. Try again to retrieve the organization’s
            records.
          </p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry audit trail
          </Button>
        </div>
      ) : !visible.length ? (
        <div className="org-audit-empty">
          <History size={28} aria-hidden />
          <h3>
            {term
              ? "No matches on this page"
              : page
                ? "No events on this page"
                : "No activity recorded yet"}
          </h3>
          <p>
            {term
              ? "Search by staff member, action or record reference."
              : "Recorded staff activity will appear in this timeline."}
          </p>
          {term ? (
            <Button variant="secondary" onClick={() => setSearch("")}>
              Clear page search
            </Button>
          ) : (
            page > 0 && (
              <Button variant="secondary" onClick={() => changePage(0)}>
                Return to first page
              </Button>
            )
          )}
        </div>
      ) : (
        <div
          className="org-audit-timeline"
          role="region"
          aria-label="Organization event timeline"
          tabIndex={0}
        >
          {groups.map((group) => (
            <section
              className="org-audit-day"
              key={group.day}
              aria-label={auditDate(group.entries[0].createdAt)}
            >
              <h3 className="org-audit-day-heading">
                <span>{auditDate(group.entries[0].createdAt)}</span>
                <span>
                  {group.entries.length}{" "}
                  {group.entries.length === 1 ? "event" : "events"} on this page
                </span>
              </h3>
              {group.entries.map((entry) => {
                const Icon = eventIcon(entry.action);
                return (
                  <details className="org-audit-event" key={entry.id}>
                    <summary>
                      <span className="org-audit-event-marker" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <span className="org-audit-event-summary">
                        <strong>{actionLabel(entry.action)}</strong>
                        <span>
                          <UserRound size={11} aria-hidden />
                          {entry.actorName || "Actor not recorded"}
                          <span className="org-audit-entity">
                            {entry.entityType}
                          </span>
                        </span>
                      </span>
                      <time dateTime={entry.createdAt}>
                        {auditTime(entry.createdAt)}
                        <span>UTC</span>
                      </time>
                      <ChevronDown
                        className="org-audit-expand"
                        size={16}
                        aria-hidden
                      />
                      <span className="sr-only">View event details</span>
                    </summary>
                    <div className="org-audit-event-detail">
                      <div className="org-audit-detail-title">
                        <h4>Event details</h4>
                        <button
                          type="button"
                          onClick={() => void copyReference(entry.id)}
                        >
                          <Copy size={12} aria-hidden /> Copy event ID
                        </button>
                      </div>
                      <dl>
                        <div>
                          <dt>Record reference</dt>
                          <dd>{entry.entityId}</dd>
                        </div>
                        <div>
                          <dt>Event ID</dt>
                          <dd>{entry.id}</dd>
                        </div>
                        <div>
                          <dt>Recorded at</dt>
                          <dd>{auditDate(entry.createdAt, true)} UTC</dd>
                        </div>
                        <div>
                          <dt>Action code</dt>
                          <dd>{entry.action}</dd>
                        </div>
                        <div>
                          <dt>IP address</dt>
                          <dd>{entry.ipAddress ?? "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>User agent</dt>
                          <dd>{entry.deviceSignature ?? "Not recorded"}</dd>
                        </div>
                      </dl>
                      {entry.beforeValue !== null ||
                      entry.afterValue !== null ? (
                        <div className="org-audit-snapshots">
                          <div>
                            <h4>Before</h4>
                            <pre>{prettySnapshot(entry.beforeValue)}</pre>
                          </div>
                          <div>
                            <h4>After</h4>
                            <pre>{prettySnapshot(entry.afterValue)}</pre>
                          </div>
                        </div>
                      ) : (
                        <p className="org-audit-no-changes">
                          No before or after values were recorded for this
                          event.
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {query.data && (
        <div className="org-audit-pagination">
          <p>
            {entries.length
              ? `${page * size + 1}–${page * size + entries.length} of ${total.toLocaleString()} events`
              : "0 events on this page"}
            {term && " · before page search"}
          </p>
          <div>
            <label>
              Rows
              <select
                aria-label="Organization audit events per page"
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  changePage(0);
                }}
              >
                {[25, 50, 100].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Previous audit page"
              disabled={!page || query.isFetching}
              onClick={() => changePage(page - 1)}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <span>Page {page + 1}</span>
            <button
              aria-label="Next audit page"
              disabled={!query.data.hasMore || query.isFetching}
              onClick={() => changePage(page + 1)}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}
      <footer className="org-audit-footer">
        <span>
          <ShieldCheck size={12} aria-hidden /> {organizationName}
        </span>
        <span role="status">
          {query.isFetching
            ? "Updating activity…"
            : stale
              ? "Previously loaded activity"
              : query.dataUpdatedAt
                ? `Updated ${auditTime(new Date(query.dataUpdatedAt).toISOString())} UTC`
                : "Organization audit records"}
        </span>
      </footer>
    </section>
  );
}
