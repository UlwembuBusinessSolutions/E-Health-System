import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ArrowLeft, Bell, FileText, HeartPulse, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import {
  acceptIncomingReferralNotification,
  getIncomingReferralDocumentUrl,
  getIncomingReferralDetails,
  listIncomingReferralDocuments,
  listIncomingReferralNotifications,
  type IncomingReferralDetail,
  type IncomingReferralNotification,
} from "@/shared/api/referrals";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const selectedId = searchParams.get("notificationId");
  const queryKey = ["incoming-referral-notifications", getTenantSlug(), user?.id];
  const notifications = useQuery({
    queryKey,
    queryFn: listIncomingReferralNotifications,
    enabled: Boolean(user),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const details = useQuery({
    queryKey: ["incoming-referral-details", getTenantSlug(), user?.id, selectedId],
    queryFn: () => getIncomingReferralDetails(selectedId!),
    enabled: Boolean(user && selectedId),
  });
  const documents = useQuery({
    queryKey: ["incoming-referral-documents", getTenantSlug(), user?.id, selectedId],
    queryFn: () => listIncomingReferralDocuments(selectedId!),
    enabled: Boolean(user && selectedId),
  });
  const accept = useMutation({
    mutationFn: acceptIncomingReferralNotification,
    onSuccess: async (_data, notificationId) => {
      queryClient.setQueryData<IncomingReferralNotification[]>(queryKey, (current) =>
        current?.map((notification) => notification.id === notificationId
          ? { ...notification, status: "ACCEPTED" }
          : notification));
      queryClient.setQueryData<IncomingReferralDetail>(
        ["incoming-referral-details", getTenantSlug(), user?.id, notificationId],
        (current) => current ? { ...current, status: "ACCEPTED" } : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incoming-referral-details", getTenantSlug(), user?.id, notificationId] }),
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
      ]);
    },
  });

  async function downloadDocument(documentId: string) {
    setDocumentError(null);
    const tab = window.open("", "_blank");
    if (!tab) {
      setDocumentError("Allow pop-ups to open the supporting document.");
      return;
    }
    try {
      tab.location.assign(await getIncomingReferralDocumentUrl(selectedId!, documentId));
    } catch (error) {
      tab.close();
      setDocumentError(error instanceof ApiError
        ? `The supporting document could not be opened: ${error.message}`
        : "The supporting document could not be opened.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Review patient and clinical information before accepting an incoming referral or transfer."
      />

      {notifications.isPending ? (
        <Card className="p-6 text-[14px] text-text-secondary" role="status">
          Loading notifications…
        </Card>
      ) : notifications.isError ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p role="alert" className="text-[14px] text-danger-600">
            {notifications.error instanceof ApiError
              ? `Notifications could not be loaded: ${notifications.error.message}`
              : "Notifications could not be loaded."}
          </p>
          <Button
            type="button"
            variant="secondary"
            loading={notifications.isFetching}
            onClick={() => void notifications.refetch()}
          >
            Try again
          </Button>
        </Card>
      ) : notifications.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Bell className="size-8 text-text-secondary" aria-hidden />
          <h2 className="text-[15px] font-semibold text-text-primary">You’re all caught up</h2>
          <p className="text-[13px] text-text-secondary">Incoming referrals and transfers will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          <ul className="space-y-3">
            {notifications.data.map((notification) => {
              const isTransfer = notification.referralType === "TRANSFER";
              const isSelected = selectedId === notification.id;
              return (
                <li key={notification.id}>
                  <Card className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${isSelected ? "border-brand-500" : ""}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        {isTransfer
                          ? <RefreshCw className="size-5" aria-hidden />
                          : <HeartPulse className="size-5" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-text-primary">
                          Incoming patient {isTransfer ? "transfer" : "referral"}
                        </h2>
                        <p className="mt-1 text-[13px] text-text-secondary">
                          Sent by {notification.sourceOrganizationName}
                        </p>
                        <p className="mt-1 text-[12px] text-text-secondary">
                          {notification.status.charAt(0) + notification.status.slice(1).toLowerCase()}
                          {notification.acknowledged ? " · Acknowledged" : ""}
                        </p>
                        <time className="mt-1 block text-[12px] text-text-secondary" dateTime={notification.createdAt}>
                          {formatNotificationDate(notification.createdAt)}
                        </time>
                      </div>
                    </div>
                    <Button type="button" variant={isSelected ? "primary" : "secondary"}
                      onClick={() => setSearchParams({ notificationId: notification.id })}>
                      {isSelected ? "Reviewing details" : "Review patient details"}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>

          {selectedId && (
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-text-primary">Patient and referral details</h2>
                  <p className="mt-1 text-[13px] text-text-secondary">Review these details before accepting or acknowledging.</p>
                </div>
                <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />}
                  onClick={() => setSearchParams({}, { replace: true })}>
                  Back to notifications
                </Button>
              </div>

              {details.isPending ? (
                <p role="status" className="text-sm text-text-secondary">Loading patient and referral information…</p>
              ) : details.isError ? (
                <div role="alert" className="space-y-3">
                  <p className="text-sm text-danger-600">
                    {details.error instanceof ApiError
                      ? `Patient details could not be loaded: ${details.error.message}`
                      : "Patient details could not be loaded. No action has been taken."}
                  </p>
                  <Button type="button" variant="secondary" loading={details.isFetching}
                    onClick={() => void details.refetch()}>Try again</Button>
                </div>
              ) : (
                <>
                  {accept.isSuccess && accept.variables === selectedId && (
                    <p role="status" className="mb-5 rounded-lg bg-success-50 p-3 text-[14px] text-success-700">
                      {accept.data.alreadyRegistered
                        ? `${accept.data.patientName} already has a record at this clinic.`
                        : `${accept.data.patientName} was added to the patient list.`}{" "}
                      MPI: {accept.data.mpiNumber}
                    </p>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    <section className="space-y-2">
                      <h3 className="border-b border-border-subtle pb-2 text-sm font-semibold text-text-primary">Patient</h3>
                      <Detail label="Name" value={details.data.patientName} />
                      <Detail label="MPI number" value={details.data.patientMpiNumber} />
                      <Detail label="Date of birth" value={details.data.patientDateOfBirth ?? "Not recorded"} />
                      <Detail label="Gender" value={details.data.patientGender ?? "Not recorded"} />
                      <Detail label="Contact number" value={details.data.patientContactNumber} />
                    </section>
                    <section className="space-y-2">
                      <h3 className="border-b border-border-subtle pb-2 text-sm font-semibold text-text-primary">
                        {details.data.referralType === "TRANSFER" ? "Transfer" : "Referral"}
                      </h3>
                      <Detail label="From" value={details.data.sourceOrganizationName} />
                      <Detail label="Receiving facility" value={details.data.institutionName ?? "Not specified"} />
                      <Detail label="Date" value={details.data.referralDate} />
                      <Detail label="Status" value={details.data.status} />
                      <Detail label="Reason" value={details.data.reason ?? "Not provided"} />
                    </section>
                    <section className="space-y-2 md:col-span-2">
                      <h3 className="border-b border-border-subtle pb-2 text-sm font-semibold text-text-primary">Clinical information</h3>
                      <Detail label="Clinical summary" value={details.data.clinicalSummary ?? "Not provided"} />
                      <Detail label="Required medication" value={details.data.requiredMedication ?? "None listed"} />
                      <Detail label="Medication instructions" value={details.data.medicationInstructions ?? "None listed"} />
                      <Detail label="Additional notes" value={details.data.additionalNotes ?? "None"} />
                    </section>
                  </div>
                  <section className="mt-6 border-t border-border-subtle pt-5">
                    <h3 className="text-sm font-semibold text-text-primary">Supporting documents</h3>
                    {documents.isPending ? (
                      <p role="status" className="mt-2 text-sm text-text-secondary">Loading supporting documents…</p>
                    ) : documents.isError ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <p role="alert" className="text-sm text-danger-600">Supporting documents could not be loaded.</p>
                        <Button type="button" variant="secondary" loading={documents.isFetching}
                          onClick={() => void documents.refetch()}>Try again</Button>
                      </div>
                    ) : documents.data.length === 0 ? (
                      <p className="mt-2 text-sm text-text-secondary">No supporting documents attached.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border-subtle">
                        {documents.data.map((document) => (
                          <li key={document.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="size-4 shrink-0 text-text-secondary" aria-hidden />
                              <span className="truncate">{document.originalFilename}</span>
                            </span>
                            <Button type="button" variant="ghost" size="md"
                              icon={<ArrowDownToLine className="size-4" aria-hidden />}
                              onClick={() => void downloadDocument(document.id)}>Download</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {documentError && <p role="alert" className="mt-2 text-sm text-danger-600">{documentError}</p>}
                  </section>
                  <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border-subtle pt-5">
                    {accept.isError && (
                      <p role="alert" className="w-full rounded-lg bg-danger-50 p-3 text-[14px] text-danger-600">
                        {actionErrorText(accept.error)}
                      </p>
                    )}
                    <Button type="button" loading={accept.isPending && accept.variables === selectedId}
                      disabled={details.data.status !== "SUBMITTED" || accept.isPending}
                      onClick={() => accept.mutate(selectedId)}>
                      {details.data.status === "ACCEPTED"
                        ? "Referral accepted"
                        : details.data.status === "SUBMITTED"
                          ? `Accept ${details.data.referralType === "TRANSFER" ? "transfer" : "referral"}`
                          : "No longer available to accept"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="whitespace-pre-wrap break-words text-[13px] text-text-primary">{value}</p>
    </div>
  );
}

function actionErrorText(error: unknown): string {
  return error instanceof ApiError
    ? `Could not complete this action: ${error.message}`
    : "Could not complete this action. Please try again.";
}
