import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Check } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  captureVitals,
  validateVitalSigns,
  isAbnormal,
  VITAL_RANGES,
  type AvpuLevel,
  type CaptureVitalsPayload,
} from "@/shared/api/triage";
import { getVisit } from "@/shared/api/visits";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";

const AVPU_LEVELS: AvpuLevel[] = ["ALERT", "VOICE", "PAIN", "UNRESPONSIVE"];

export function CaptureVitalsScreen() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();

  // Form state
  const [vitals, setVitals] = useState<CaptureVitalsPayload>({
    systolicBloodPressure: 120,
    diastolicBloodPressure: 80,
    heartRate: 80,
    temperatureCelsius: "37.0",
    respiratoryRate: 16,
    avpu: "ALERT",
    confirmOutOfRange: false,
  });

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [showAbnormalWarning, setShowAbnormalWarning] = useState(false);

  // Fetch visit details
  const { data: visit, isLoading: visitLoading } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => (visitId ? getVisit(visitId) : null),
    enabled: !!visitId,
  });

  // Capture vitals mutation
  const captureVitalsMutation = useMutation({
    mutationFn: () => {
      if (!visitId) throw new Error("Visit ID is required");
      return captureVitals(visitId, vitals);
    },
    onSuccess: (result) => {
      navigate(`/app/triage/assessments/${result.assessment.id}`, {
        state: { prior: result.priorAssessment },
      });
    },
  });

  const handleInputChange = (field: keyof CaptureVitalsPayload, value: any) => {
    const updatedVitals = { ...vitals, [field]: value };
    setVitals(updatedVitals);

    // Revalidate on change
    const errors = validateVitalSigns(updatedVitals);
    setValidationErrors(errors);

    // Check if abnormal
    if (Object.keys(errors).length === 0) {
      setShowAbnormalWarning(isAbnormal(updatedVitals));
    }
  };

  const handleConfirmAbnormal = (confirmed: boolean) => {
    setVitals({ ...vitals, confirmOutOfRange: confirmed });
    setShowAbnormalWarning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const errors = validateVitalSigns(vitals);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Check for abnormal and require confirmation
    if (isAbnormal(vitals) && !vitals.confirmOutOfRange) {
      setShowAbnormalWarning(true);
      return;
    }

    captureVitalsMutation.mutate();
  };

  if (!visitId) {
    return (
      <div className="p-6">
        <Card className="border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">Visit ID is required</p>
        </Card>
      </div>
    );
  }

  if (visitLoading) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-text-secondary">Loading visit details...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Capture Vital Signs"
        description="Record patient vitals during triage assessment"
      />

      {/* Visit Info */}
      {visit && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50 p-4">
          <p className="text-sm text-text-secondary">
            Visit ID: <span className="font-mono text-text-primary">{visitId}</span>
          </p>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-6 p-6">
          <h3 className="text-sm font-semibold text-text-primary">
            Blood Pressure
          </h3>

          {/* Systolic BP */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Systolic BP{" "}
              <span className="text-red-500">
                *
              </span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                label="Systolic BP"
                type="number"
                value={vitals.systolicBloodPressure}
                onChange={(e) =>
                  handleInputChange("systolicBloodPressure", parseInt(e.target.value))
                }
                min={VITAL_RANGES.systolicBP.min}
                max={VITAL_RANGES.systolicBP.max}
                className="w-32"
              />
              <span className="text-sm text-text-secondary">mmHg</span>
              <span className="text-xs text-text-secondary">
                ({VITAL_RANGES.systolicBP.min}-{VITAL_RANGES.systolicBP.max})
              </span>
            </div>
            {validationErrors.systolicBloodPressure && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.systolicBloodPressure}
              </p>
            )}
          </div>

          {/* Diastolic BP */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Diastolic BP{" "}
              <span className="text-red-500">
                *
              </span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                label="Diastolic BP"
                type="number"
                value={vitals.diastolicBloodPressure}
                onChange={(e) =>
                  handleInputChange("diastolicBloodPressure", parseInt(e.target.value))
                }
                min={VITAL_RANGES.diastolicBP.min}
                max={VITAL_RANGES.diastolicBP.max}
                className="w-32"
              />
              <span className="text-sm text-text-secondary">mmHg</span>
              <span className="text-xs text-text-secondary">
                ({VITAL_RANGES.diastolicBP.min}-{VITAL_RANGES.diastolicBP.max})
              </span>
            </div>
            {validationErrors.diastolicBloodPressure && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.diastolicBloodPressure}
              </p>
            )}
          </div>
        </Card>

        {/* Other Vitals */}
        <Card className="space-y-6 p-6">
          <h3 className="text-sm font-semibold text-text-primary">
            Other Vital Signs
          </h3>

          {/* Heart Rate */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Heart Rate <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                label="Heart Rate"
                type="number"
                value={vitals.heartRate}
                onChange={(e) =>
                  handleInputChange("heartRate", parseInt(e.target.value))
                }
                min={VITAL_RANGES.heartRate.min}
                max={VITAL_RANGES.heartRate.max}
                className="w-32"
              />
              <span className="text-sm text-text-secondary">bpm</span>
              <span className="text-xs text-text-secondary">
                ({VITAL_RANGES.heartRate.min}-{VITAL_RANGES.heartRate.max})
              </span>
            </div>
            {validationErrors.heartRate && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.heartRate}
              </p>
            )}
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Temperature <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                label="Temperature"
                type="number"
                value={vitals.temperatureCelsius}
                onChange={(e) =>
                  handleInputChange("temperatureCelsius", e.target.value)
                }
                min={VITAL_RANGES.temperature.min}
                max={VITAL_RANGES.temperature.max}
                step="0.1"
                className="w-32"
              />
              <span className="text-sm text-text-secondary">°C</span>
              <span className="text-xs text-text-secondary">
                ({VITAL_RANGES.temperature.min}-{VITAL_RANGES.temperature.max})
              </span>
            </div>
            {validationErrors.temperatureCelsius && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.temperatureCelsius}
              </p>
            )}
          </div>

          {/* Respiratory Rate */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Respiratory Rate <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                label="Respiratory Rate"
                type="number"
                value={vitals.respiratoryRate}
                onChange={(e) =>
                  handleInputChange("respiratoryRate", parseInt(e.target.value))
                }
                min={VITAL_RANGES.respiratoryRate.min}
                max={VITAL_RANGES.respiratoryRate.max}
                className="w-32"
              />
              <span className="text-sm text-text-secondary">breaths/min</span>
              <span className="text-xs text-text-secondary">
                ({VITAL_RANGES.respiratoryRate.min}-{VITAL_RANGES.respiratoryRate.max})
              </span>
            </div>
            {validationErrors.respiratoryRate && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.respiratoryRate}
              </p>
            )}
          </div>

          {/* AVPU */}
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Alertness (AVPU) <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVPU_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleInputChange("avpu", level)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    vitals.avpu === level
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 bg-white text-text-primary hover:bg-gray-50"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              A=Alert, V=Responds to Voice, P=Responds to Pain, U=Unresponsive
            </p>
          </div>
        </Card>

        {/* Abnormal Warning */}
        {showAbnormalWarning && (
          <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900">Out-of-Range Values Detected</h4>
                <p className="mt-1 text-sm text-yellow-800">
                  One or more vital signs are outside normal ranges. Please confirm these
                  observations before saving.
                </p>
                <div className="mt-4 flex gap-3">
                  <Button
                    type="button"
                    onClick={() => handleConfirmAbnormal(true)}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Confirm & Save
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleConfirmAbnormal(false)}
                    variant="secondary"
                  >
                    Review Values
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Error Alert */}
        {captureVitalsMutation.isError && (
          <Card className="border-l-4 border-l-red-500 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <h4 className="font-semibold text-red-900">Error Saving Vitals</h4>
                <p className="mt-1 text-sm text-red-800">
                  {captureVitalsMutation.error instanceof ApiError
                    ? captureVitalsMutation.error.message
                    : "An unexpected error occurred"}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={
              captureVitalsMutation.isPending ||
              Object.keys(validationErrors).length > 0
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {captureVitalsMutation.isPending ? "Saving..." : "Save Vital Signs"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/app/triage")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
