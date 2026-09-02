import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPrescription } from "@/shared/api/pharmacy";
import { listVisits } from "@/shared/api/visits";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";

interface PrescriptionItemForm {
  id: string;
  drugName: string;
  dosage: string;
  quantity: number | "";
}

export function CreatePrescriptionScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultVisitId = searchParams.get("visitId") || "";

  const [visitId, setVisitId] = useState(defaultVisitId);
  const [items, setItems] = useState<PrescriptionItemForm[]>([
    { id: "1", drugName: "", dosage: "", quantity: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const visitsQuery = useQuery({ queryKey: ["visits"], queryFn: listVisits });

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null);

      if (!visitId) {
        throw new Error("Select a visit");
      }

      // Validate all items have values
      const validItems = items.filter(
        (item) => item.drugName.trim() && item.dosage.trim() && item.quantity !== ""
      );

      if (validItems.length === 0) {
        throw new Error("Add at least one medication");
      }

      const result = await createPrescription({
        visitId,
        items: validItems.map((item) => ({
          drugName: item.drugName.trim(),
          dosage: item.dosage.trim(),
          quantity: Number(item.quantity),
        })),
      });

      return result;
    },
    onSuccess: (prescription) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy"] });
      navigate(`/app/pharmacy/prescriptions/${prescription.id}`, {
        state: { message: "Prescription created successfully" },
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to create prescription";
      setError(msg);
    },
  });

  const addItem = () => {
    const newId = String(Math.max(...items.map((i) => Number(i.id) || 0)) + 1);
    setItems([...items, { id: newId, drugName: "", dosage: "", quantity: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof PrescriptionItemForm, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const visits = visitsQuery.data ?? [];

  const selectedVisit = visits.find((v) => v.id === visitId);

  return (
    <div>
      <PageHeader
        title="Create Prescription"
        description="Add medications for a patient visit"
      />

      <div className="grid gap-5">
        {/* Visit Selection */}
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Select Visit
          </h3>

          {visitsQuery.isLoading ? (
            <p className="text-sm text-text-secondary">Loading visits…</p>
          ) : visitsQuery.isError ? (
            <p role="alert" className="text-sm text-danger-700">
              {visitsQuery.error instanceof ApiError
                ? visitsQuery.error.message
                : "Unable to load visits. Check that the backend is running, then try again."}
            </p>
          ) : visits.length === 0 ? (
            <p className="text-sm text-text-secondary">No visits available. Create a patient visit before prescribing medication.</p>
          ) : (
            <div className="space-y-3">
<div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Visit
              </label>
              <select
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-text-primary bg-white"
              >
                <option value="">Select a visit…</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patientName} — {new Date(v.checkedInAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

              {selectedVisit && (
                <div className="rounded-lg bg-info-50 p-3">
                  <p className="text-sm text-info-700">
                    <span className="font-semibold">{selectedVisit.patientName}</span> · {selectedVisit.patientMpi}
                  </p>
                  <p className="mt-1 text-xs text-info-600">
                    Facility: {selectedVisit.facilityId}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Medications */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Medications
            </h3>
            <button
              onClick={addItem}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover text-sm font-medium"
            >
              <Plus className="size-4" aria-hidden />
              Add
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3">
              <AlertCircle className="size-4 shrink-0 text-danger-600 mt-0.5" aria-hidden />
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input
                    label={idx === 0 ? "Drug Name" : ""}
                    placeholder="e.g., Aspirin"
                    value={item.drugName}
                    onChange={(e) => updateItem(item.id, "drugName", e.target.value)}
                  />
                  <Input
                    label={idx === 0 ? "Dosage" : ""}
                    placeholder="e.g., 500mg"
                    value={item.dosage}
                    onChange={(e) => updateItem(item.id, "dosage", e.target.value)}
                  />
                  <Input
                    type="number"
                    label={idx === 0 ? "Quantity" : ""}
                    placeholder="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, "quantity", e.target.value ? Number(e.target.value) : "")
                    }
                  />
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover"
                    aria-label="Remove medication"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-text-secondary">
            Fill in all fields for each medication. Remove empty rows if needed.
          </p>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Prescription
          </Button>
        </div>
      </div>
    </div>
  );
}
