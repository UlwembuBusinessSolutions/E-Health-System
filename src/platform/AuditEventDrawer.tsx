import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import type { PlatformAuditEntry } from "@/shared/api/platform";
import { actionAppearance, actionLabel, auditDate } from "./auditPresentation";

export function AuditEventDrawer({
  entry,
  onClose,
}: {
  entry: PlatformAuditEntry;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyState, setCopyState] = useState("");
  const { icon: Icon, category, attention } = actionAppearance(entry.action);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  async function copyId() {
    try {
      await navigator.clipboard.writeText(entry.id);
      setCopyState("Event ID copied");
    } catch {
      setCopyState(
        "Couldn't copy. Select the event ID below to copy it manually.",
      );
    }
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="audit-drawer platform-shell"
      aria-labelledby="audit-event-title"
      onCancel={onClose}
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          event.clientX < event.currentTarget.getBoundingClientRect().left
        )
          onClose();
      }}
    >
      <div className="audit-drawer-top">
        <span>EVENT DETAILS</span>
        <button
          autoFocus
          type="button"
          className="audit-icon-button"
          aria-label="Close event details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="audit-drawer-content">
        <span
          className={`audit-event-icon audit-event-icon-large ${attention ? "audit-attention" : ""}`}
        >
          <Icon size={24} aria-hidden />
        </span>
        <p className="audit-eyebrow">{category}</p>
        <h2 id="audit-event-title">{actionLabel(entry.action)}</h2>
        <p className="audit-drawer-date">
          {auditDate(entry.createdAt, true)} UTC
        </p>
        <section>
          <h3>Event context</h3>
          <dl className="audit-definition">
            <div>
              <dt>Operator</dt>
              <dd>
                {entry.operatorName}
                <span>{entry.operatorEmail ?? "Email not recorded"}</span>
              </dd>
            </div>
            <div>
              <dt>Organization</dt>
              <dd>
                {entry.organizationName ??
                  (entry.organizationId
                    ? "Name not recorded"
                    : "Platform-wide")}
                {entry.organizationId && (
                  <Link
                    className="audit-inline-link"
                    to={`/platform/organizations/${entry.organizationId}`}
                    onClick={onClose}
                  >
                    View organization <ArrowUpRight size={13} aria-hidden />
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt>Action code</dt>
              <dd className="audit-mono">{entry.action}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>Recorded detail</h3>
          <div className="audit-recorded-detail">
            {entry.detail ||
              "No additional detail was recorded for this event."}
          </div>
        </section>
        <section>
          <h3>Request information</h3>
          <dl className="audit-definition">
            <div>
              <dt>IP address</dt>
              <dd className="audit-mono">
                {entry.ipAddress ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>User agent</dt>
              <dd className="audit-user-agent">
                {entry.deviceSignature ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Timestamp (UTC)</dt>
              <dd className="audit-mono">{entry.createdAt}</dd>
            </div>
          </dl>
        </section>
        <section>
          <div className="audit-detail-heading">
            <h3>Event reference</h3>
            <button
              type="button"
              className="audit-inline-link"
              onClick={() => void copyId()}
            >
              {copyState === "Event ID copied" ? (
                <Check size={14} aria-hidden />
              ) : (
                <Copy size={14} aria-hidden />
              )}{" "}
              Copy ID
            </button>
          </div>
          <p className="audit-event-id audit-mono">{entry.id}</p>
          <p className="audit-copy-status" role="status">
            {copyState}
          </p>
        </section>
      </div>
      <div className="audit-drawer-footer">
        Platform activity record · Read-only view
      </div>
    </dialog>,
    document.body,
  );
}
