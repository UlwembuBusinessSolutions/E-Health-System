// Lihle | 2026-09-09 | Add dispensing with pharmacy cache refresh and error feedback, and keep query hooks before conditional returns so prescription status updates reliably.
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, MessageSquareWarning, Send, XCircle } from "lucide-react";
import {
  checkClinicalSafety,
  dispensePrescription,
  declinePrescription,
  getDuplicateDispensingWarnings,
  getPrescription,
  getPrescriptionDecline,
  previewPrescriptionQuery,
  raisePrescriptionQuery,
  type ClinicalSafetyAlert,
  type DeclineReasonCode,
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

export function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [alerts, setAlerts] = useState<ClinicalSafetyAlert[]>([]);
  const [queryAlerts, setQueryAlerts] = useState<ClinicalSafetyAlert[]>([]);
  const [queryReason, setQueryReason] = useState("");
  const [queryPreviewed, setQueryPreviewed] = useState(false);
  const [checkingQuery, setCheckingQuery] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [coverageUntil, setCoverageUntil] = useState("");
  const [declineReasonCode, setDeclineReasonCode] = useState<DeclineReasonCode | "">("");
  const [declineReasonDetail, setDeclineReasonDetail] = useState("");
  const prescriptionQuery = useQuery({
    queryKey: ["pharmacy", "prescription", id],
    queryFn: () => getPrescription(id!),
    enabled: !!id,
  });
  const dispense = useMutation({
    mutationFn: (reason?: string) => dispensePrescription(id!, reason, coverageUntil || undefined),
    onSettled: () => cache.invalidateQueries({ queryKey: ["pharmacy"] }),
  });
  const warningsQuery = useQuery({
    queryKey: ["pharmacy", "duplicate-warnings", id],
    queryFn: () => getDuplicateDispensingWarnings(id!),
    enabled: !!id && prescriptionQuery.data?.status === "PENDING",
  });
  const declineQuery = useQuery({
    queryKey: ["pharmacy", "decline", id],
    queryFn: () => getPrescriptionDecline(id!),
    enabled: !!id && prescriptionQuery.data?.status === "DECLINED",
  });
  const decline = useMutation({
    mutationFn: () => declinePrescription(id!, declineReasonCode as DeclineReasonCode, declineReasonDetail.trim() || undefined),
    onSettled: () => cache.invalidateQueries({ queryKey: ["pharmacy"] }),
  });
  const raiseQuery = useMutation({
    mutationFn: (reason: string) => raisePrescriptionQuery(id!, reason),
    onSuccess: () => {
      setQueryReason("");
      setQueryPreviewed(false);
      setQueryAlerts([]);
    },
    onSettled: () => cache.invalidateQueries({ queryKey: ["pharmacy"] }),
  });

  if (!id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary">No prescription ID provided</p>
      </div>
    );
  }

  const prescription = prescriptionQuery.data;
  const requiresOverride = alerts.some((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL");
  const isHeld = prescription?.status === "HELD";
  const isDispensed = prescription?.status === "DISPENSED";
  const isDeclined = prescription?.status === "DECLINED";
  const canQuery = prescription?.status === "PENDING";

  const requestDispense = async () => {
    if (!prescription || checkingSafety || dispense.isPending || warningsQuery.isLoading || warningsQuery.isError) return;
    setCheckingSafety(true);
    try {
      const nextAlerts = await checkClinicalSafety(prescription.patientId, prescription.items);
      setAlerts(nextAlerts);
      if (nextAlerts.some((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL") && !overrideReason.trim()) return;
      dispense.mutate(overrideReason.trim() || undefined);
    } finally {
      setCheckingSafety(false);
    }
  };

  const requestQuery = async () => {
    if (!prescription || checkingQuery || raiseQuery.isPending) return;
    if (!queryReason.trim()) return;
    if (!queryPreviewed) {
      setCheckingQuery(true);
      try {
        setQueryAlerts(await previewPrescriptionQuery(prescription.id));
        setQueryPreviewed(true);
      } finally {
        setCheckingQuery(false);
      }
      return;
    }
    raiseQuery.mutate(queryReason.trim());
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <PageHeader
          title={prescription?.serialNumber || "Prescription"}
          description={prescription ? `${prescription.patientName} · ${prescription.patientMpi}` : "Loading…"}
        />
      </div>

      {prescriptionQuery.isError ? <p role="alert" className="text-danger-600">{prescriptionQuery.error.message}</p> : prescriptionQuery.isLoading ? (
        <Card className="p-10 text-center">
          <p className="text-text-secondary">Loading prescription…</p>
        </Card>
      ) : !prescription ? (
        <Card className="p-10 text-center">
          <p className="text-danger-600">Prescription not found</p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {/* Status and Header Info */}
          <Card className="p-6">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Status
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {isDispensed ? (
                    <>
                      <CheckCircle2 className="size-5 text-success-600" aria-hidden />
                      <StatusPill tone="success">Dispensed</StatusPill>
                    </>
                  ) : isDeclined ? (
                    <>
                      <XCircle className="size-5 text-danger-600" aria-hidden />
                      <StatusPill tone="danger">Declined</StatusPill>
                    </>
                  ) : isHeld ? (
                    <>
                      <AlertTriangle className="size-5 text-danger-600" aria-hidden />
                      <StatusPill tone="danger">Held</StatusPill>
                    </>
                  ) : (
                    <>
                      <Clock className="size-5 text-warning-600" aria-hidden />
                      <StatusPill tone="warning">Pending</StatusPill>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Issued
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary">
                  {formatDateTime(prescription.createdAt)}
                </p>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Patient
                  </p>
                  <p className="mt-2 text-sm text-text-primary">{prescription.patientName}</p>
                  <p className="font-mono text-xs text-text-secondary">{prescription.patientMpi}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Visit
                  </p>
                  <p className="mt-2 font-mono text-xs text-text-primary">{prescription.visitId}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Medications */}
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">
              Medications
            </h3>
            <div className="space-y-3">
              {prescription.items.length === 0 ? (
                <p className="text-sm text-text-secondary">No medications on this prescription</p>
              ) : (
                prescription.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between rounded-lg border border-border-subtle bg-surface-raised p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-text-primary">{item.drugName}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Dosage: {item.dosage}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-text-primary">
                        × {item.quantity}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {isHeld && (
            <Card className="border border-danger-200 bg-danger-50 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-600" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-danger-700">Prescription on hold</h3>
                  <p className="mt-1 text-sm text-danger-700">
                    Dispensing is paused while the prescriber reviews the pharmacy query.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {isDeclined && (
            <Card className="border border-danger-200 bg-danger-50 p-6">
              <h3 className="text-sm font-semibold text-danger-700">Dispensing declined</h3>
              {declineQuery.isLoading ? <p className="mt-2 text-sm">Loading recorded reason...</p> :
                declineQuery.isError ? <p role="alert" className="mt-2 text-sm text-danger-700">{declineQuery.error.message}</p> :
                declineQuery.data && <p className="mt-2 text-sm text-danger-700">Reason: {declineQuery.data.reasonCode.replaceAll("_", " ")}{declineQuery.data.reasonDetail ? ` — ${declineQuery.data.reasonDetail}` : ""}</p>}
            </Card>
          )}

          {canQuery && (
            <Card className="border border-warning-200 bg-amber-50 p-6">
              <h3 className="text-sm font-semibold text-amber-700">Prior dispensing review</h3>
              {warningsQuery.isLoading ? <p className="mt-2 text-sm">Checking prior dispensing across clinics...</p> :
                warningsQuery.isError ? <p role="alert" className="mt-2 text-sm text-danger-600">{warningsQuery.error.message}</p> :
                warningsQuery.data?.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-amber-700">
                    {warningsQuery.data.map((warning, index) => <li key={`${warning.prescriptionId}-${index}`}>
                      <strong>{warning.drugName}</strong> dispensed {formatDateTime(warning.dispensedAt)} at {warning.facilityName} ({warning.facilityId}); supply recorded through {warning.coverageUntil}.
                    </li>)}
                  </ul>
                ) : <p className="mt-2 text-sm text-text-secondary">No matching unexpired dispensing was recorded.</p>}
            </Card>
          )}

          {prescription.latestQuery && (
            <Card className="border border-info-200 bg-info-50 p-6">
              <div className="flex items-start gap-3">
                <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-info-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-info-700">Latest prescriber response</h3>
                    <StatusPill tone={prescription.latestQuery.status === "RESPONDED" ? "success" : "warning"}>
                      {prescription.latestQuery.status}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm text-info-700">{prescription.latestQuery.prescriberResponse || prescription.latestQuery.reason}</p>
                  {prescription.latestQuery.guidelineWarning && (
                    <p className="mt-2 text-xs text-info-700">
                      Guideline warning: {prescription.latestQuery.guidelineWarning}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {alerts.length > 0 && (
            <Card className="border border-danger-200 bg-danger-50 p-6">
              <h3 className="text-sm font-semibold text-danger-700">Clinical safety alerts</h3>
              <ul className="mt-3 space-y-2 text-sm text-danger-700">
                {alerts.map((alert) => <li key={alert.ruleId}><span className="font-semibold">{alert.severity}</span> - {alert.message}</li>)}
              </ul>
              {requiresOverride && (
                <div className="mt-4">
                  <label htmlFor="dispensing-override-reason" className="mb-2 block text-sm font-medium text-danger-700">Override reason required</label>
                  <textarea id="dispensing-override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={3}
                    className="w-full rounded-lg border border-danger-300 bg-white px-3 py-2 text-sm text-text-primary" placeholder="Record why dispensing may proceed" />
                </div>
              )}
            </Card>
          )}
          {dispense.isError && <p role="alert" className="text-danger-600">{dispense.error.message}</p>}
          {canQuery && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-primary">Decline to dispense</h3>
              <p className="mt-1 text-sm text-text-secondary">Record the reason and notify the prescriber. No stock will be issued.</p>
              <label htmlFor="decline-reason-code" className="mt-4 block text-sm font-medium">Reason code</label>
              <select id="decline-reason-code" value={declineReasonCode} onChange={event => setDeclineReasonCode(event.target.value as DeclineReasonCode | "")}
                className="mt-1 w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm">
                <option value="">Select a reason</option>
                <option value="DUPLICATE_SUPPLY">Duplicate supply</option>
                <option value="PATIENT_HAS_SUFFICIENT_SUPPLY">Patient has sufficient medication</option>
                <option value="CLINICALLY_INAPPROPRIATE">Clinically inappropriate</option>
                <option value="OTHER">Other</option>
              </select>
              <label htmlFor="decline-reason-detail" className="mt-4 block text-sm font-medium">Reason detail {declineReasonCode === "OTHER" ? "(required)" : "(optional)"}</label>
              <textarea id="decline-reason-detail" value={declineReasonDetail} onChange={event => setDeclineReasonDetail(event.target.value)} maxLength={1000}
                rows={3} className="mt-1 w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm" placeholder="Explain the decision for the prescriber" />
              {decline.isError && <p role="alert" className="mt-2 text-sm text-danger-600">{decline.error.message}</p>}
              <Button variant="secondary" className="mt-4" icon={<XCircle className="size-4" aria-hidden />}
                loading={decline.isPending} disabled={!declineReasonCode || (declineReasonCode === "OTHER" && !declineReasonDetail.trim())}
                onClick={() => decline.mutate()}>Decline and notify prescriber</Button>
            </Card>
          )}
          {canQuery && (
            <Card className="border border-warning-200 bg-amber-50 p-6">
              <div className="mb-4 flex items-start gap-3">
                <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-amber-700">Query prescriber</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Raise a real-time prescription query and place the prescription on hold until the prescriber responds.
                  </p>
                </div>
              </div>
              <label htmlFor="prescription-query-reason" className="mb-2 block text-sm font-medium text-amber-700">Query reason</label>
              <textarea
                id="prescription-query-reason"
                value={queryReason}
                onChange={(event) => {
                  setQueryReason(event.target.value);
                  setQueryPreviewed(false);
                }}
                rows={3}
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-text-primary"
                placeholder="Describe the issue for the prescriber"
              />
              {queryPreviewed && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Guideline deviation check</p>
                  {queryAlerts.length === 0 ? (
                    <p className="mt-2 text-sm text-text-secondary">No configured guideline deviations were detected.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-amber-700">
                      {queryAlerts.map((alert) => <li key={alert.ruleId}><span className="font-semibold">{alert.severity}</span> - {alert.message}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {raiseQuery.isError && <p role="alert" className="mt-3 text-sm text-danger-600">{raiseQuery.error.message}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  icon={queryPreviewed ? <Send className="size-4" aria-hidden /> : <MessageSquareWarning className="size-4" aria-hidden />}
                  loading={checkingQuery || raiseQuery.isPending}
                  disabled={!queryReason.trim()}
                  onClick={() => void requestQuery()}
                >
                  {queryPreviewed ? "Raise query and hold" : "Check guideline warnings"}
                </Button>
              </div>
            </Card>
          )}
          {prescription.status === "PENDING" && <Card className="p-6">
            <label htmlFor="coverage-until" className="block text-sm font-medium">Supply expected to last until (optional)</label>
            <input id="coverage-until" type="date" min={new Date().toISOString().slice(0, 10)} value={coverageUntil} onChange={event => setCoverageUntil(event.target.value)}
              className="mt-1 mb-4 rounded-lg border border-border-strong bg-white px-3 py-2 text-sm" />
            <Button icon={<CheckCircle2 size={16} />} loading={checkingSafety || dispense.isPending} disabled={warningsQuery.isLoading || warningsQuery.isError}
              onClick={() => void requestDispense()}>Dispense prescription</Button>
          </Card>}

          {/* Summary */}
          <Card className="p-6 bg-info-50 border border-info-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-info-700 mb-2">
              About This Prescription
            </p>
            <p className="text-sm text-info-700">
              {prescription.status === "DISPENSED"
                ? "This prescription has been dispensed. A dispensing record has been created."
                : prescription.status === "DECLINED"
                  ? "Dispensing was declined with a recorded reason and the prescriber has been notified."
                : prescription.status === "HELD"
                  ? "This prescription is held while the prescriber reviews the query. It returns to the queue after the response is recorded."
                : "This prescription is waiting to be dispensed. Only pharmacists with current SAPC registration can dispense it."}
            </p>
          </Card>

          {/* Back Button */}
          <Button variant="secondary" onClick={() => navigate(-1)} className="w-full">
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
