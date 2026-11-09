import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareReply, RefreshCw } from "lucide-react";
import {
  listPrescriptionQueries,
  listPrescriptionDeclineNotifications,
  respondToPrescriptionQuery,
  type PrescriptionQuery,
} from "@/shared/api/pharmacy";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QueryCard({ query }: { query: PrescriptionQuery }) {
  const cache = useQueryClient();
  const [response, setResponse] = useState("");
  const respond = useMutation({
    mutationFn: () => respondToPrescriptionQuery(query.id, response.trim()),
    onSuccess: () => setResponse(""),
    onSettled: () => cache.invalidateQueries({ queryKey: ["pharmacy"] }),
  });

  const open = query.status === "OPEN";

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={open ? "warning" : "success"}>{query.status}</StatusPill>
            <span className="text-xs text-text-secondary">{formatDateTime(query.raisedAt)}</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-text-primary">{query.reason}</p>
          {query.guidelineWarning && (
            <p className="mt-2 rounded-lg border border-warning-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Guideline warning: {query.guidelineWarning}
            </p>
          )}
          {query.prescriberResponse && (
            <p className="mt-3 rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-600">
              Response: {query.prescriberResponse}
            </p>
          )}
          <Link
            to={`/app/pharmacy/prescriptions/${query.prescriptionId}`}
            className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Open prescription
          </Link>
        </div>

        {open && (
          <div className="w-full lg:max-w-md">
            <label htmlFor={`query-response-${query.id}`} className="mb-2 block text-sm font-medium text-text-primary">
              Prescriber response
            </label>
            <textarea
              id={`query-response-${query.id}`}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-text-primary"
              placeholder="Record the correction or clinical rationale"
            />
            {respond.isError && <p role="alert" className="mt-2 text-sm text-danger-600">{respond.error.message}</p>}
            <Button
              className="mt-3 w-full"
              icon={<MessageSquareReply className="size-4" aria-hidden />}
              loading={respond.isPending}
              disabled={!response.trim()}
              onClick={() => respond.mutate()}
            >
              Send response
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function PrescriptionQueriesPage() {
  const declineNotifications = useQuery({
    queryKey: ["pharmacy", "decline-notifications"],
    queryFn: listPrescriptionDeclineNotifications,
    refetchInterval: 10_000,
  });
  const queries = useQuery({
    queryKey: ["pharmacy", "queries"],
    queryFn: listPrescriptionQueries,
    refetchInterval: 10_000,
  });

  const items = queries.data ?? [];
  const openCount = items.filter((query) => query.status === "OPEN").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Prescription queries"
          description={`${openCount} open prescriber collaboration${openCount === 1 ? "" : "s"}`}
        />
        <Button
          variant="secondary"
          icon={<RefreshCw className="size-4" aria-hidden />}
          loading={queries.isFetching}
          onClick={() => void queries.refetch()}
        >
          Refresh
        </Button>
      </div>

      <Card className="mb-5 p-5">
        <h3 className="text-sm font-semibold text-text-primary">Dispensing decline notifications</h3>
        {declineNotifications.isError ? <p role="alert" className="mt-2 text-danger-600">{declineNotifications.error.message}</p> :
          declineNotifications.isLoading ? <p className="mt-2 text-sm text-text-secondary">Loading notifications...</p> :
          declineNotifications.data?.length ? <ul className="mt-3 space-y-3">
            {declineNotifications.data.map(notification => <li key={notification.id} className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm">
              Dispensing declined on {formatDateTime(notification.createdAt)}. {" "}
              <Link to={`/app/pharmacy/prescriptions/${notification.prescriptionId}`} className="font-semibold text-brand-600">View recorded reason</Link>
            </li>)}
          </ul> : <p className="mt-2 text-sm text-text-secondary">No dispensing declines have been sent to you.</p>}
      </Card>

      {queries.isError ? (
        <Card className="p-5">
          <p role="alert" className="text-danger-600">{queries.error.message}</p>
        </Card>
      ) : queries.isLoading ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-text-secondary">Loading prescription queries...</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-text-secondary">No prescription queries for the active clinic.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((query) => <QueryCard key={query.id} query={query} />)}
        </div>
      )}
    </div>
  );
}
