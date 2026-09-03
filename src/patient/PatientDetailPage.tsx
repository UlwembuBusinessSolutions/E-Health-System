import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Pill, Plus, Ticket, Trash2 } from "lucide-react";
import { getPatient, updatePatient, type UpdatePatientPayload } from "@/shared/api/patients";
import { createVisit, type ServiceStream, type VisitType, type VisitWithToken } from "@/shared/api/visits";
import { createPrescription, type Prescription, type PrescriptionItem } from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const EMPTY_ITEM: PrescriptionItem = { drugName: "", dosage: "", quantity: 1 };

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: "NEW", label: "New visit" },
  { value: "FOLLOW_UP", label: "Follow-up visit" },
];

const SERVICE_STREAM_OPTIONS: { value: ServiceStream; label: string }[] = [
  { value: "GENERAL", label: "General / acute care" },
  { value: "CHRONIC_CARE", label: "Chronic care" },
  { value: "MATERNAL_CHILD", label: "Maternal & child health" },
  { value: "OCCUPATIONAL_HEALTH", label: "Occupational health" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
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

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-[13.5px] text-text-primary">{value}</p>
    </div>
  );
}

// The read half of PREG-US-001/015 — "view longitudinal record" is a later
// story (visits/consultations don't exist yet), so this is the demographic
// record on its own: everything PatientController.PatientSummary returns,
// laid out the same "profile card" shape OrganizationDetailPage's own
// header already uses.
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [visitType, setVisitType] = useState<VisitType | "">("");
  const [serviceStream, setServiceStream] = useState<ServiceStream | "">("");
  const [visitError, setVisitError] = useState<string | null>(null);
  const [startedVisit, setStartedVisit] = useState<VisitWithToken | null>(null);
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [createdPrescription, setCreatedPrescription] = useState<Prescription | null>(null);
  const [isEditingDemographics, setIsEditingDemographics] = useState(false);
  const [demographicDraft, setDemographicDraft] = useState<UpdatePatientPayload | null>(null);
  const [demographicError, setDemographicError] = useState<string | null>(null);

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, enabled: isStartingVisit });

  const startVisit = useMutation({
    mutationFn: () =>
      createVisit({
        patientId,
        facilityId,
        visitType: visitType as VisitType,
        serviceStream: serviceStream as ServiceStream,
      }),
    onSuccess: (result) => {
      setStartedVisit(result);
      setIsStartingVisit(false);
    },
    onError: (error) => {
      setVisitError(error instanceof ApiError ? error.message : "Couldn't start that visit. Try again.");
    },
  });

  const handleStartVisit = () => {
    setVisitError(null);
    if (!facilityId || !visitType || !serviceStream) {
      setVisitError("Select a facility, visit type, and service stream.");
      return;
    }
    startVisit.mutate();
  };

  const prescribe = useMutation({
    mutationFn: (visitId: string) => createPrescription({ visitId, items: prescriptionItems }),
    onSuccess: (result) => {
      setCreatedPrescription(result);
      setIsPrescribing(false);
    },
    onError: (error) => {
      setPrescriptionError(error instanceof ApiError ? error.message : "Couldn't create that prescription. Try again.");
    },
  });

  const updateDemographics = useMutation({
    mutationFn: (payload: UpdatePatientPayload) => updatePatient(patientId, payload),
    onSuccess: () => {
      setIsEditingDemographics(false);
      setDemographicDraft(null);
      setDemographicError(null);
      patientQuery.refetch();
    },
    onError: (error) => {
      setDemographicError(error instanceof ApiError ? error.message : "Couldn't update demographics. Try again.");
    },
  });

  const handlePrescribe = () => {
    setPrescriptionError(null);
    if (!startedVisit) return;
    const incomplete = prescriptionItems.some((item) => !item.drugName.trim() || !item.dosage.trim());
    if (incomplete) {
      setPrescriptionError("Every item needs a drug name and dosage.");
      return;
    }
    prescribe.mutate(startedVisit.visit.id);
  };

  const updateItem = (index: number, patch: Partial<PrescriptionItem>) => {
    setPrescriptionItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const patient = patientQuery.data;

  const beginDemographicEdit = () => {
    if (!patient) return;
    setDemographicDraft({
      firstName: patient.firstName,
      lastName: patient.lastName,
      idNumber: patient.idNumber,
      address: patient.address,
      contactNumber: patient.contactNumber,
      medicalAidProvider: patient.medicalAidProvider ?? "",
      medicalAidNumber: patient.medicalAidNumber ?? "",
    });
    setDemographicError(null);
    setIsEditingDemographics(true);
  };

  const updateDraft = (field: keyof UpdatePatientPayload, value: string) => {
    setDemographicDraft((draft) => (draft ? { ...draft, [field]: value } : draft));
  };

  return (
    <div>
      <Link
        to="/app/patients"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to patients
      </Link>

      {patientQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : !patient ? (
        <p className="text-[14px] text-text-secondary">This patient couldn't be found.</p>
      ) : (
        <>
          <Card className="mb-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[14px] font-semibold text-brand-600">
                  {initials(patient.firstName, patient.lastName)}
                </span>
                <div>
                  <h1 className="text-[19px] font-semibold text-text-primary">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <p className="font-mono text-[13px] text-text-secondary">
                    {patient.mpiNumber} · registered {formatDate(patient.createdAt)}
                  </p>
                </div>
              </div>
              {!isStartingVisit && !startedVisit && (
                <Button
                  variant="secondary"
                  icon={<Ticket className="size-4" aria-hidden />}
                  onClick={() => setIsStartingVisit(true)}
                >
                  Start visit
                </Button>
              )}
            </div>
          </Card>

          {(isStartingVisit || startedVisit) && (
            <Card className="mb-6 p-6">
              {startedVisit ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <Ticket className="size-6" aria-hidden />
                  </span>
                  <h2 className="text-[16px] font-semibold text-text-primary">Visit started</h2>
                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[18px] font-semibold text-text-primary">
                    Token #{startedVisit.token.tokenNumber}
                  </p>
                  <p className="text-[13.5px] text-text-secondary">
                    {patient.firstName} is now in the queue.{" "}
                    <Link to="/app/queue" className="font-medium text-brand-600 hover:text-brand-700">
                      View queue
                    </Link>
                  </p>
                  <div className="mt-1 flex gap-2">
                    {!isPrescribing && !createdPrescription && (
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Pill className="size-3.5" aria-hidden />}
                        onClick={() => setIsPrescribing(true)}
                      >
                        Prescribe
                      </Button>
                    )}
                    <Button variant="secondary" size="md" onClick={() => setStartedVisit(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Start a visit</h2>
                  {visitError && (
                    <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
                      {visitError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select
                      label="Facility"
                      required
                      options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                    />
                    <Select
                      label="Visit type"
                      required
                      options={VISIT_TYPE_OPTIONS}
                      value={visitType}
                      onChange={(e) => setVisitType(e.target.value as VisitType)}
                    />
                    <Select
                      label="Service stream"
                      required
                      options={SERVICE_STREAM_OPTIONS}
                      value={serviceStream}
                      onChange={(e) => setServiceStream(e.target.value as ServiceStream)}
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button loading={startVisit.isPending} onClick={handleStartVisit}>
                      Issue queue token
                    </Button>
                    <Button variant="secondary" onClick={() => setIsStartingVisit(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {(isPrescribing || createdPrescription) && (
            <Card className="mb-6 p-6">
              {createdPrescription ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <Pill className="size-6" aria-hidden />
                  </span>
                  <h2 className="text-[16px] font-semibold text-text-primary">Prescription created</h2>
                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[15px] font-semibold text-text-primary">
                    {createdPrescription.serialNumber}
                  </p>
                  <p className="text-[13.5px] text-text-secondary">
                    Sent to the dispensing queue.{" "}
                    <Link to="/app/pharmacy" className="font-medium text-brand-600 hover:text-brand-700">
                      View pharmacy queue
                    </Link>
                  </p>
                  <Button variant="secondary" size="md" className="mt-1" onClick={() => setCreatedPrescription(null)}>
                    Dismiss
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Prescribe</h2>
                  {prescriptionError && (
                    <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
                      {prescriptionError}
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    {prescriptionItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
                        <Input
                          label="Drug name"
                          required={index === 0}
                          placeholder="Paracetamol"
                          value={item.drugName}
                          onChange={(e) => updateItem(index, { drugName: e.target.value })}
                        />
                        <Input
                          label="Dosage"
                          required={index === 0}
                          placeholder="500mg twice daily"
                          value={item.dosage}
                          onChange={(e) => updateItem(index, { dosage: e.target.value })}
                        />
                        <Input
                          label="Quantity"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                        />
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={prescriptionItems.length === 1}
                            onClick={() =>
                              setPrescriptionItems((items) => items.filter((_, i) => i !== index))
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrescriptionItems((items) => [...items, { ...EMPTY_ITEM }])}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add another item
                  </button>
                  <div className="mt-4 flex gap-2">
                    <Button loading={prescribe.isPending} onClick={handlePrescribe}>
                      Create prescription
                    </Button>
                    <Button variant="secondary" onClick={() => setIsPrescribing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[14.5px] font-semibold text-text-primary">Demographics</h2>
              {!isEditingDemographics && (
                <Button variant="secondary" size="md" icon={<Pencil className="size-3.5" aria-hidden />} onClick={beginDemographicEdit}>
                  Edit demographics
                </Button>
              )}
            </div>
            {isEditingDemographics && demographicDraft ? (
              <div>
                {demographicError && <p role="alert" className="mb-4 text-[13.5px] text-danger-600">{demographicError}</p>}
                <p className="mb-4 text-[13px] text-text-secondary">Changes are recorded in the patient audit trail.</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="First name" required value={demographicDraft.firstName} onChange={(e) => updateDraft("firstName", e.target.value)} />
                  <Input label="Last name" required value={demographicDraft.lastName} onChange={(e) => updateDraft("lastName", e.target.value)} />
                  <Input label="ID number" required value={demographicDraft.idNumber} onChange={(e) => updateDraft("idNumber", e.target.value)} />
                  <Input label="Contact number" required value={demographicDraft.contactNumber} onChange={(e) => updateDraft("contactNumber", e.target.value)} />
                  <div className="sm:col-span-2"><Input label="Address" required value={demographicDraft.address} onChange={(e) => updateDraft("address", e.target.value)} /></div>
                  <Input label="Medical aid provider" value={demographicDraft.medicalAidProvider ?? ""} onChange={(e) => updateDraft("medicalAidProvider", e.target.value)} />
                  <Input label="Medical aid number" value={demographicDraft.medicalAidNumber ?? ""} onChange={(e) => updateDraft("medicalAidNumber", e.target.value)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button loading={updateDemographics.isPending} onClick={() => updateDemographics.mutate(demographicDraft)}>Save changes</Button>
                  <Button variant="secondary" disabled={updateDemographics.isPending} onClick={() => { setIsEditingDemographics(false); setDemographicDraft(null); setDemographicError(null); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Date of birth" value={formatDate(patient.dateOfBirth)} />
              <Field label="Gender" value={titleCase(patient.gender)} />
              <Field label="Citizenship" value={patient.citizenshipStatus === "SA_CITIZEN" ? "SA citizen" : "Permanent resident"} />
              <Field label="ID number" value={patient.idNumber} />
              <Field label="Contact number" value={patient.contactNumber} />
              <Field label="Address" value={patient.address} />
              <Field label="Medical aid provider" value={patient.medicalAidProvider ?? "—"} />
              <Field label="Medical aid number" value={patient.medicalAidNumber ?? "—"} />
              <Field label="Registered" value={formatDateTime(patient.createdAt)} />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
