import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatVitals, type VitalSigns } from "@/shared/api/triage";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

const VITAL_RANGES = {
  systolicBP: { min: 90, max: 180 },
  diastolicBP: { min: 60, max: 120 },
  heartRate: { min: 50, max: 120 },
  temperature: { min: 35.0, max: 38.0 },
  respiratoryRate: { min: 12, max: 20 },
};

function isOutOfRange(
  value: number | string,
  min: number,
  max: number
): boolean {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num < min || num > max;
}

function getIndicator(
  value: number | string,
  min: number,
  max: number
): "normal" | "abnormal" {
  return isOutOfRange(value, min, max) ? "abnormal" : "normal";
}

export function TriageAssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Get prior assessment from location state (passed from capture screen)
  const priorAssessment = (location.state as { prior?: VitalSigns })?.prior;

  // TODO: Fetch actual assessment from backend GET /api/v1/visits/{visitId}/triage-assessments/{id}
  // For now, mock data
  const mockAssessment: VitalSigns = {
    id: id || "mock-id",
    visitId: "visit-123",
    patientId: "patient-123",
    systolicBloodPressure: 145,
    diastolicBloodPressure: 92,
    heartRate: 88,
    temperatureCelsius: "37.5",
    respiratoryRate: 18,
    avpu: "ALERT",
    capturedAt: new Date().toISOString(),
    capturedByUserId: "clinician-123",
  };

  const assessment = mockAssessment;
  const formatted = formatVitals(assessment);

  // Indicators
  const sysIndicator = getIndicator(
    assessment.systolicBloodPressure,
    VITAL_RANGES.systolicBP.min,
    VITAL_RANGES.systolicBP.max
  );
  const hrIndicator = getIndicator(
    assessment.heartRate,
    VITAL_RANGES.heartRate.min,
    VITAL_RANGES.heartRate.max
  );
  const tempIndicator = getIndicator(
    parseFloat(assessment.temperatureCelsius),
    VITAL_RANGES.temperature.min,
    VITAL_RANGES.temperature.max
  );
  const rrIndicator = getIndicator(
    assessment.respiratoryRate,
    VITAL_RANGES.respiratoryRate.min,
    VITAL_RANGES.respiratoryRate.max
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Triage Assessment"
        description="Vital signs recorded during patient assessment"
      />

      {/* Assessment Info */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary">Assessment ID</p>
            <p className="font-mono text-text-primary">{assessment.id}</p>
          </div>
          <div>
            <p className="text-text-secondary">Captured At</p>
            <p className="text-text-primary">{formatted.capturedAt}</p>
          </div>
          <div>
            <p className="text-text-secondary">Patient ID</p>
            <p className="font-mono text-text-primary">{assessment.patientId}</p>
          </div>
          <div>
            <p className="text-text-secondary">AVPU</p>
            <p className="text-text-primary">{assessment.avpu}</p>
          </div>
        </div>
      </Card>

      {/* Vital Signs Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Blood Pressure */}
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              Blood Pressure
            </h4>
            {sysIndicator === "abnormal" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {assessment.systolicBloodPressure}/{assessment.diastolicBloodPressure}
          </p>
          <p className="text-sm text-text-secondary">mmHg</p>
          <p className="text-xs text-text-secondary">
            Normal: {VITAL_RANGES.systolicBP.min}-{VITAL_RANGES.systolicBP.max}/
            {VITAL_RANGES.diastolicBP.min}-{VITAL_RANGES.diastolicBP.max} mmHg
          </p>
        </Card>

        {/* Heart Rate */}
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              Heart Rate
            </h4>
            {hrIndicator === "abnormal" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {assessment.heartRate}
          </p>
          <p className="text-sm text-text-secondary">bpm</p>
          <p className="text-xs text-text-secondary">
            Normal: {VITAL_RANGES.heartRate.min}-{VITAL_RANGES.heartRate.max} bpm
          </p>
        </Card>

        {/* Temperature */}
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              Temperature
            </h4>
            {tempIndicator === "abnormal" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {assessment.temperatureCelsius}
          </p>
          <p className="text-sm text-text-secondary">°C</p>
          <p className="text-xs text-text-secondary">
            Normal: {VITAL_RANGES.temperature.min}-{VITAL_RANGES.temperature.max}
            °C
          </p>
        </Card>

        {/* Respiratory Rate */}
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              Respiratory Rate
            </h4>
            {rrIndicator === "abnormal" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {assessment.respiratoryRate}
          </p>
          <p className="text-sm text-text-secondary">breaths/min</p>
          <p className="text-xs text-text-secondary">
            Normal: {VITAL_RANGES.respiratoryRate.min}-
            {VITAL_RANGES.respiratoryRate.max} breaths/min
          </p>
        </Card>
      </div>

      {/* Prior Assessment Comparison */}
      {priorAssessment && (
        <Card className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-text-primary">
            Comparison with Prior Assessment
          </h3>

          <div className="space-y-3">
            {/* BP Comparison */}
            <div className="flex items-center justify-between border-b border-border-subtle py-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Blood Pressure
                </p>
                <p className="text-xs text-text-secondary">
                  Current: {assessment.systolicBloodPressure}/
                  {assessment.diastolicBloodPressure} mmHg
                </p>
                <p className="text-xs text-text-secondary">
                  Prior: {priorAssessment.systolicBloodPressure}/
                  {priorAssessment.diastolicBloodPressure} mmHg
                </p>
              </div>
              <div className="text-right">
                {assessment.systolicBloodPressure >
                priorAssessment.systolicBloodPressure ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : assessment.systolicBloodPressure <
                  priorAssessment.systolicBloodPressure ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs text-text-secondary">stable</span>
                )}
              </div>
            </div>

            {/* HR Comparison */}
            <div className="flex items-center justify-between border-b border-border-subtle py-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Heart Rate
                </p>
                <p className="text-xs text-text-secondary">
                  Current: {assessment.heartRate} bpm
                </p>
                <p className="text-xs text-text-secondary">
                  Prior: {priorAssessment.heartRate} bpm
                </p>
              </div>
              <div className="text-right">
                {assessment.heartRate > priorAssessment.heartRate ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : assessment.heartRate < priorAssessment.heartRate ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs text-text-secondary">stable</span>
                )}
              </div>
            </div>

            {/* Temperature Comparison */}
            <div className="flex items-center justify-between border-b border-border-subtle py-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Temperature
                </p>
                <p className="text-xs text-text-secondary">
                  Current: {assessment.temperatureCelsius}°C
                </p>
                <p className="text-xs text-text-secondary">
                  Prior: {priorAssessment.temperatureCelsius}°C
                </p>
              </div>
              <div className="text-right">
                {parseFloat(assessment.temperatureCelsius) >
                parseFloat(priorAssessment.temperatureCelsius) ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : parseFloat(assessment.temperatureCelsius) <
                  parseFloat(priorAssessment.temperatureCelsius) ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs text-text-secondary">stable</span>
                )}
              </div>
            </div>

            {/* RR Comparison */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Respiratory Rate
                </p>
                <p className="text-xs text-text-secondary">
                  Current: {assessment.respiratoryRate} breaths/min
                </p>
                <p className="text-xs text-text-secondary">
                  Prior: {priorAssessment.respiratoryRate} breaths/min
                </p>
              </div>
              <div className="text-right">
                {assessment.respiratoryRate > priorAssessment.respiratoryRate ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : assessment.respiratoryRate <
                  priorAssessment.respiratoryRate ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs text-text-secondary">stable</span>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-text-secondary">
            Prior captured at:{" "}
            {new Date(priorAssessment.capturedAt).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate("/app/triage")}
          variant="secondary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
