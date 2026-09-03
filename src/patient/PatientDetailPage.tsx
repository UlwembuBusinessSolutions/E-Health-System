import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, HeartCrack, Pencil, Pill, Plus, Ticket, Trash2 } from "lucide-react";
import clsx from "clsx";

import { useAuth } from "@/auth/AuthContext";

import { getPatient, markPatientDeceased } from "@/shared/api/patients";
import {
  createVisit,
  type ServiceStream,
  type VisitType,
  type VisitWithToken,
} from "@/shared/api/visits";
import {
  createPrescription,
  type Prescription,
  type PrescriptionItem,
} from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";

import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";

const EMPTY_ITEM: PrescriptionItem = {
  drugName: "",
  dosage: "",
  quantity: 1,
};

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: "NEW", label: "New visit" },
  { value: "FOLLOW_UP", label: "Follow-up visit" },
];

const SERVICE_STREAM_OPTIONS: {
  value: ServiceStream;
  label: string;
}[] = [
  { value: "GENERAL", label: "General / acute care" },
  { value: "CHRONIC_CARE", label: "Chronic care" },
  { value: "MATERNAL_CHILD", label: "Maternal & child health" },
  {
    value: "OCCUPATIONAL_HEALTH",
    label: "Occupational health",
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>

      <p className="mt-1 text-[13.5px] text-text-primary">
        {value}
      </p>
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  const MarkPermissions =
    user?.role === "ORG_ADMIN" || user?.role === "Admin Staff";

  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [visitType, setVisitType] = useState<VisitType | "">("");
  const [serviceStream, setServiceStream] =
    useState<ServiceStream | "">("");

  const [visitError, setVisitError] = useState<string | null>(null);
  const [startedVisit, setStartedVisit] =
    useState<VisitWithToken | null>(null);

  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescriptionItems, setPrescriptionItems] =
    useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);

  const [prescriptionError, setPrescriptionError] =
    useState<string | null>(null);

  const [createdPrescription, setCreatedPrescription] =
    useState<Prescription | null>(null);

  const [showDeceasedModal, setShowDeceasedModal] = useState(false);
  const [confirmDob, setConfirmDob] = useState("");

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
    enabled: isStartingVisit,
  });

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
      setVisitError(
        error instanceof ApiError
          ? error.message
          : "Couldn't start that visit. Try again.",
      );
    },
  });

  const markDeceased = useMutation({
    mutationFn: (confirmDobValue: string) =>
      markPatientDeceased(patientId, todayIso(), confirmDobValue),
    onSuccess: (updatedPatient) => {
      queryClient.setQueryData(["patients", patientId], updatedPatient);
      setShowDeceasedModal(false);
      setConfirmDob("");
      showToast("Patient marked deceased and archived.", "success");
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Couldn't mark this patient deceased. Try again.",
        "error",
      );
    },
  });

  const handleConfirmDeceased = () => {
    if (!confirmDob) return;
    markDeceased.mutate(confirmDob);
  };

  const handleStartVisit = () => {
    setVisitError(null);

    if (!facilityId || !visitType || !serviceStream) {
      setVisitError(
        "Select a facility, visit type, and service stream.",
      );
      return;
    }

    startVisit.mutate();
  };

  const prescribe = useMutation({
    mutationFn: (visitId: string) =>
      createPrescription({
        visitId,
        items: prescriptionItems,
      }),

    onSuccess: (result) => {
      setCreatedPrescription(result);
      setIsPrescribing(false);
    },

    onError: (error) => {
      setPrescriptionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't create that prescription. Try again.",
      );
    },
  });

  const handlePrescribe = () => {
    setPrescriptionError(null);

    if (!startedVisit) return;

    const incomplete = prescriptionItems.some(
      (item) =>
        !item.drugName.trim() ||
        !item.dosage.trim(),
    );

    if (incomplete) {
      setPrescriptionError(
        "Every item needs a drug name and dosage.",
      );
      return;
    }

    prescribe.mutate(startedVisit.visit.id);
  };

  const updateItem = (
    index: number,
    patch: Partial<PrescriptionItem>,
  ) => {
    setPrescriptionItems((items) =>
      items.map((item, i) =>
        i === index
          ? { ...item, ...patch }
          : item,
      ),
    );
  };

  const patient = patientQuery.data;

  return (
    <div>
      <Link
        to="/app/patients"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft
          className="size-4"
          aria-hidden
        />
        Back to patients
      </Link>

      {patientQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">
          Loading…
        </p>
      ) : !patient ? (
        <p className="text-[14px] text-text-secondary">
          This patient couldn't be found.
        </p>
      ) : (
        <>
          <Card className="mb-6 p-6">
            {patient.deceased && (
              <div className="mb-4 rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-600">
                Archived — deceased {patient.dateOfDeath ? formatDate(patient.dateOfDeath) : "—"}. This record is
                locked from further editing.
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[14px] font-semibold text-brand-600">
                  {initials(
                    patient.firstName,
                    patient.lastName,
                  )}
                </span>

                <div>
                  <h1 className="text-[19px] font-semibold text-text-primary">
                    {patient.firstName}{" "}
                    {patient.lastName}
                  </h1>

                  <p className="font-mono text-[13px] text-text-secondary">
                    {patient.mpiNumber} · registered{" "}
                    {formatDate(patient.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {MarkPermissions && (<Button
                  variant="secondary"
                  disabled={patient.deceased}
                  icon={
                    <Pencil
                      className="size-4"
                      aria-hidden
                    />
                  }
                  onClick={() =>
                    navigate(`/app/patients/${patient.id}/edit`)
                  }
                >
                  Edit details
                </Button>)}

                {!patient.deceased && MarkPermissions && (
                  <Button
                    variant="secondary"
                    icon={<HeartCrack className="size-4" aria-hidden />}
                    onClick={() => setShowDeceasedModal(true)}
                  >
                    Mark deceased
                  </Button>
                )}

                {!isStartingVisit && !startedVisit && MarkPermissions && (
                  <Button
                    variant="secondary"
                    disabled={patient.deceased}
                    icon={
                      <Ticket
                        className="size-4"
                        aria-hidden
                      />
                    }
                    onClick={() =>
                      setIsStartingVisit(true)
                    }
                  >
                    Start visit
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {showDeceasedModal && (
            <Card className="mb-6 p-6">
              <h2 className="mb-1 text-[14.5px] font-semibold text-text-primary">Mark deceased</h2>
              <p className="mb-4 text-[13.5px] text-text-secondary">
                Confirm {patient.firstName}'s date of birth to archive this record and lock it from further
                editing.
              </p>

              <Input
                label="Confirm date of birth"
                required
                type="date"
                hint="Re-enter the patient's date of birth to confirm you have the right record."
                value={confirmDob}
                onChange={(e) => setConfirmDob(e.target.value)}
              />

              <div className="mt-4 flex gap-2">
                <Button
                  loading={markDeceased.isPending}
                  disabled={!confirmDob}
                  className={clsx(
                    !confirmDob
                      ? "bg-ink-200! text-ink-500! hover:bg-ink-200!"
                      : "bg-danger-500! hover:bg-danger-600!",
                  )}
                  onClick={handleConfirmDeceased}
                >
                  Confirm
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeceasedModal(false);
                    setConfirmDob("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {(isStartingVisit || startedVisit) && (
            <Card className="mb-6 p-6">
              {startedVisit ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <Ticket
                      className="size-6"
                      aria-hidden
                    />
                  </span>

                  <h2 className="text-[16px] font-semibold text-text-primary">
                    Visit started
                  </h2>

                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[18px] font-semibold text-text-primary">
                    Token #
                    {startedVisit.token.tokenNumber}
                  </p>

                  <p className="text-[13.5px] text-text-secondary">
                    {patient.firstName} is now in the queue.{" "}
                    <Link
                      to="/app/queue"
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      View queue
                    </Link>
                  </p>

                  <div className="mt-1 flex gap-2">
                    {!isPrescribing &&
                      !createdPrescription && (
                        <Button
                          variant="secondary"
                          size="md"
                          icon={
                            <Pill
                              className="size-3.5"
                              aria-hidden
                            />
                          }
                          onClick={() =>
                            setIsPrescribing(true)
                          }
                        >
                          Prescribe
                        </Button>
                      )}

                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        setStartedVisit(null)
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">
                    Start a visit
                  </h2>

                  {visitError && (
                    <p
                      role="alert"
                      className="mb-4 text-[13.5px] text-danger-600"
                    >
                      {visitError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select
                      label="Facility"
                      required
                      options={(
                        facilitiesQuery.data ?? []
                      ).map((f) => ({
                        value: f.id,
                        label: f.name,
                      }))}
                      value={facilityId}
                      onChange={(e) =>
                        setFacilityId(
                          e.target.value,
                        )
                      }
                    />

                    <Select
                      label="Visit type"
                      required
                      options={VISIT_TYPE_OPTIONS}
                      value={visitType}
                      onChange={(e) =>
                        setVisitType(
                          e.target.value as VisitType,
                        )
                      }
                    />

                    <Select
                      label="Service stream"
                      required
                      options={SERVICE_STREAM_OPTIONS}
                      value={serviceStream}
                      onChange={(e) =>
                        setServiceStream(
                          e.target
                            .value as ServiceStream,
                        )
                      }
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      loading={startVisit.isPending}
                      onClick={handleStartVisit}
                    >
                      Issue queue token
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        setIsStartingVisit(false)
                      }
                    >
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
                    <Pill
                      className="size-6"
                      aria-hidden
                    />
                  </span>

                  <h2 className="text-[16px] font-semibold text-text-primary">
                    Prescription created
                  </h2>

                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[15px] font-semibold text-text-primary">
                    {createdPrescription.serialNumber}
                  </p>

                  <p className="text-[13.5px] text-text-secondary">
                    Sent to the dispensing queue.{" "}
                    <Link
                      to="/app/pharmacy"
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      View pharmacy queue
                    </Link>
                  </p>

                  <Button
                    variant="secondary"
                    size="md"
                    className="mt-1"
                    onClick={() =>
                      setCreatedPrescription(null)
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">
                    Prescribe
                  </h2>

                  {prescriptionError && (
                    <p
                      role="alert"
                      className="mb-4 text-[13.5px] text-danger-600"
                    >
                      {prescriptionError}
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    {prescriptionItems.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]"
                        >
                          <Input
                            label="Drug name"
                            required={index === 0}
                            placeholder="Paracetamol"
                            value={item.drugName}
                            onChange={(e) =>
                              updateItem(index, {
                                drugName:
                                  e.target.value,
                              })
                            }
                          />

                          <Input
                            label="Dosage"
                            required={index === 0}
                            placeholder="500mg twice daily"
                            value={item.dosage}
                            onChange={(e) =>
                              updateItem(index, {
                                dosage:
                                  e.target.value,
                              })
                            }
                          />

                          <Input
                            label="Quantity"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, {
                                quantity:
                                  Number(
                                    e.target.value,
                                  ) || 1,
                              })
                            }
                          />

                          <div className="flex items-end">
                            <button
                              type="button"
                              disabled={
                                prescriptionItems.length ===
                                1
                              }
                              onClick={() =>
                                setPrescriptionItems(
                                  (items) =>
                                    items.filter(
                                      (_, i) =>
                                        i !== index,
                                    ),
                                )
                              }
                              className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Remove item"
                            >
                              <Trash2
                                className="size-4"
                                aria-hidden
                              />
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPrescriptionItems(
                        (items) => [
                          ...items,
                          { ...EMPTY_ITEM },
                        ],
                      )
                    }
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus
                      className="size-3.5"
                      aria-hidden
                    />
                    Add another item
                  </button>

                  <div className="mt-4 flex gap-2">
                    <Button
                      loading={prescribe.isPending}
                      onClick={handlePrescribe}
                    >
                      Create prescription
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        setIsPrescribing(false)
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">
              Demographics
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Date of birth"
                value={formatDate(
                  patient.dateOfBirth,
                )}
              />

              <Field
                label="Gender"
                value={titleCase(
                  patient.gender,
                )}
              />

              <Field
                label="Citizenship"
                value={
                  patient.citizenshipStatus ===
                  "SA_CITIZEN"
                    ? "SA citizen"
                    : "Permanent resident"
                }
              />

              {/* ID / Passport — same position */}
              <Field
                label={
                  patient.idNumber
                    ? "ID number"
                    : "Passport number"
                }
                value={
                  patient.idNumber ??
                  patient.passportNumber ??
                  "—"
                }
              />

              <Field
                label="Contact number"
                value={patient.contactNumber}
              />

              <Field
                label="Address"
                value={patient.address}
              />

              <Field
                label="Medical aid provider"
                value={
                  patient.medicalAidProvider ?? "—"
                }
              />

              <Field
                label="Medical aid number"
                value={
                  patient.medicalAidNumber ?? "—"
                }
              />

              <Field
                label="Registered"
                value={formatDateTime(
                  patient.createdAt,
                )}
              />

              {patient.deceased && patient.dateOfDeath && (
                <Field
                  label="Date of death"
                  value={formatDate(patient.dateOfDeath)}
                />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
