import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, FileText, MapPin, Phone, Upload, User } from "lucide-react";
import { addDependant, getPatient, type DependantRelationship } from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const RELATIONSHIP_OPTIONS: { value: DependantRelationship; label: string }[] = [
  { value: "CHILD", label: "Child" },
  { value: "SPOUSE", label: "Spouse" },
  { value: "PARTNER", label: "Partner" },
  { value: "PARENT", label: "Parent" },
  { value: "OTHER", label: "Other dependant" },
];

export function AddDependantScreen() {
  const navigate = useNavigate();
  const { id: principalId } = useParams<{ id: string }>();
  const principalQuery = useQuery({
    queryKey: ["patients", principalId],
    queryFn: () => getPatient(principalId ?? ""),
    enabled: !!principalId,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [relationship, setRelationship] = useState<DependantRelationship | "">("");

  const mutation = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form);
      if (!principalId || !document || !relationship) throw new Error("Complete all required fields.");
      return addDependant(principalId, {
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        idNumber: String(data.get("idNumber") ?? ""),
        address: String(data.get("address") ?? ""),
        contactNumber: String(data.get("contactNumber") ?? ""),
        relationship,
        supportingDocument: document,
      });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't add the dependant. Please try again.");
    },
  });

  const principal = principalQuery.data;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to={principalId ? `/app/patients/${principalId}` : "/app/patients"}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to principal record
      </Link>

      {mutation.isSuccess ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <h1 className="text-[18px] font-semibold text-text-primary">Dependant linked</h1>
            <p className="text-[14px] text-text-secondary">
              {mutation.data.dependant.firstName} {mutation.data.dependant.lastName} is linked to{" "}
              {principal?.firstName} {principal?.lastName}.
            </p>
            <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[13px] text-text-primary">
              New MPI: {mutation.data.dependant.mpiNumber}
            </p>
            <p className="flex items-center gap-1.5 text-[13px] text-text-secondary">
              <FileText className="size-4" aria-hidden /> {mutation.data.supportingDocumentName} attached
            </p>
            <Button className="mt-2 w-full" onClick={() => navigate(`/app/patients/${principalId}`)}>
              Return to principal record
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-[20px] font-semibold text-text-primary">Add dependant</h1>
            <p className="mt-1 text-[14px] text-text-secondary">
              Create a unique MPI and link this person to {principal ? `${principal.firstName} ${principal.lastName}` : "the principal member"}.
            </p>
          </div>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              const form = event.currentTarget;
              if (!relationship || !document) {
                setFormError("Select a relationship and attach supporting documentation.");
                return;
              }
              mutation.mutate(form);
            }}
          >
            {formError && <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{formError}</p>}
            <FormRow>
              <Input label="First name" required icon={<User className="size-4" aria-hidden />} name="firstName" placeholder="Amahle" />
              <Input label="Last name" required name="lastName" placeholder="Mokoena" />
            </FormRow>
            <Input label="SA ID number" required icon={<CreditCard className="size-4" aria-hidden />} name="idNumber" inputMode="numeric" pattern="[0-9]{13}" placeholder="1805155001084" />
            <Input label="Address" required icon={<MapPin className="size-4" aria-hidden />} name="address" placeholder="Street, suburb, city" />
            <Input label="Contact number" required icon={<Phone className="size-4" aria-hidden />} name="contactNumber" pattern="\+?[0-9]{9,15}" placeholder="+27 82 123 4567" />
            <Select
              label="Relationship to principal"
              required
              options={RELATIONSHIP_OPTIONS}
              value={relationship}
              onChange={(event) => setRelationship(event.target.value as DependantRelationship)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="supporting-document" className="text-[13px] font-medium text-text-primary">
                Supporting document <span className="text-danger-500"> *</span>
              </label>
              <label htmlFor="supporting-document" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-surface-sunken/40 px-4 text-center transition-colors hover:border-brand-400 hover:bg-brand-50">
                <Upload className="size-5 text-brand-600" aria-hidden />
                <span className="text-[13.5px] font-medium text-text-primary">{document?.name ?? "Upload birth certificate or other proof"}</span>
                <span className="text-[12px] text-text-secondary">PDF, JPG or PNG up to 10 MB</span>
                <input
                  id="supporting-document"
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <Button type="submit" loading={mutation.isPending}>Create dependant and link</Button>
              <Button type="button" variant="secondary" onClick={() => navigate(`/app/patients/${principalId}`)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
