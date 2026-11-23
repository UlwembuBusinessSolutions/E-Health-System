import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell, HeartPulse, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import {
  listIncomingReferralNotifications,
  type IncomingReferralNotification,
  type ReferralStatus,
} from "@/shared/api/referrals";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

type StatusFilter = "ALL" | ReferralStatus;

const filters: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All referrals" },
  { value: "SUBMITTED", label: "Awaiting review" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const statusLabels: Record<ReferralStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export function ReferralsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const queryKey = ["incoming-referral-notifications", getTenantSlug(), user?.id];
  const referrals = useQuery({
    queryKey,
    queryFn: listIncomingReferralNotifications,
    enabled: Boolean(user),
  });
  const items = referrals.data ?? [];
  const filteredItems = statusFilter === "ALL"
    ? items
    : items.filter((item) => item.status === statusFilter);
  const counts = new Map<StatusFilter, number>([
    ["ALL", items.length],
    ...filters.slice(1).map(({ value }) => [value, items.filter((item) => item.status === value).length] as const),
  ]);

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="A record of all referrals and transfers received by this clinic, including accepted referrals."
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter referrals by status">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              statusFilter === value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border-subtle bg-surface-raised text-text-secondary hover:text-text-primary"
            }`}
          >
            {label} <span className="ml-1 tabular-nums">{counts.get(value) ?? 0}</span>
          </button>
        ))}
      </div>

      {referrals.isPending ? (
        <Card className="p-6 text-[14px] text-text-secondary" role="status">Loading referrals…</Card>
      ) : referrals.isError ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p role="alert" className="text-[14px] text-danger-600">
            {referrals.error instanceof ApiError
              ? `Referrals could not be loaded: ${referrals.error.message}`
              : "Referrals could not be loaded."}
          </p>
          <Button type="button" variant="secondary" loading={referrals.isFetching}
            onClick={() => void referrals.refetch()}>Try again</Button>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Bell className="size-8 text-text-secondary" aria-hidden />
          <h2 className="text-[15px] font-semibold text-text-primary">
            {items.length === 0 ? "No referrals received yet" : `No ${filters.find((filter) => filter.value === statusFilter)?.label.toLowerCase()} referrals`}
          </h2>
          <p className="text-[13px] text-text-secondary">
            {items.length === 0
              ? "Incoming referrals and transfers will be kept here."
              : "Choose another status filter to see more referrals."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {filteredItems.map((referral) => (
              <ReferralRow
                key={referral.id}
                referral={referral}
                onReview={() => navigate(`/app/notifications?notificationId=${encodeURIComponent(referral.id)}`)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ReferralRow({ referral, onReview }: { referral: IncomingReferralNotification; onReview: () => void }) {
  const isTransfer = referral.referralType === "TRANSFER";
  const accepted = referral.status === "ACCEPTED";
  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          {isTransfer ? <RefreshCw className="size-5" aria-hidden /> : <HeartPulse className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">
            Patient {isTransfer ? "transfer" : "referral"} — {referral.patientName}
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">Sent by {referral.sourceOrganizationName}</p>
          <time className="mt-1 block text-[12px] text-text-secondary" dateTime={referral.createdAt}>
            {formatDate(referral.createdAt)}
          </time>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
          accepted ? "bg-success-50 text-success-700" : "bg-surface-sunken text-text-secondary"
        }`}>
          {statusLabels[referral.status]}
        </span>
        <Button type="button" variant="secondary" icon={<ArrowUpRight className="size-4" aria-hidden />}
          onClick={onReview}>
          Review
        </Button>
      </div>
    </li>
  );
}
