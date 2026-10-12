import { ShieldAlert } from "lucide-react";
import type { AuthorisationType, CollectorIdType, CollectorRelationship } from "@/shared/api/pharmacy";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { SignaturePad } from "@/shared/components/SignaturePad";
import { AUTHORISATION_LABELS, ID_TYPE_LABELS, RELATIONSHIP_LABELS, toOptions } from "./collectorOptions";
import { idNumberProblem, isProofRequired, isVerbalBlocked, type CollectorFormState } from "./collectorForm";
import { ProofUpload } from "./ProofUpload";
import { TextAreaField } from "./TextAreaField";

interface ThirdPartyFormProps {
  form: CollectorFormState;
  onChange: (patch: Partial<CollectorFormState>) => void;
  hasScheduledItem: boolean;
}

const ID_TYPE_OPTIONS = toOptions(ID_TYPE_LABELS);
const RELATIONSHIP_OPTIONS = toOptions(RELATIONSHIP_LABELS);
const AUTHORISATION_OPTIONS = toOptions(AUTHORISATION_LABELS);

// Everything the pharmacist must capture when someone other than the patient
// collects. Required-ness is enforced by `missingRequirements`; this only
// presents the fields and the two rules that need explaining on screen.
export function ThirdPartyForm({ form, onChange, hasScheduledItem }: ThirdPartyFormProps) {
  const verbalBlocked = isVerbalBlocked(form, hasScheduledItem);
  const proofRequired = isProofRequired(form, hasScheduledItem);

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-[15px] font-semibold text-text-primary">Third-party collector details</legend>
      {hasScheduledItem && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          This prescription contains scheduled medication. A third party can collect it only with uploaded written
          authorisation.
        </p>
      )}
      <Input label="Full name" required value={form.name} autoComplete="off" onChange={(e) => onChange({ name: e.target.value })} />
      <Select
        label="ID type"
        required
        value={form.idType}
        options={ID_TYPE_OPTIONS}
        onChange={(e) => onChange({ idType: e.target.value as CollectorIdType })}
      />
      <Input
        label="ID / passport number"
        required
        inputMode={form.idType === "SA_ID" ? "numeric" : "text"}
        value={form.idNumber}
        autoComplete="off"
        error={idNumberProblem(form.idType, form.idNumber) ?? undefined}
        hint={form.idType === "SA_ID" ? "SA ID numbers are 13 digits." : undefined}
        onChange={(e) => onChange({ idNumber: e.target.value.replace(/\s/g, "") })}
      />
      <Select
        label="Relationship to patient"
        required
        value={form.relationship}
        options={RELATIONSHIP_OPTIONS}
        onChange={(e) => onChange({ relationship: e.target.value as CollectorRelationship })}
      />
      {form.relationship === "OTHER" && (
        <Input
          label="Describe relationship"
          required
          value={form.relationshipDescription}
          onChange={(e) => onChange({ relationshipDescription: e.target.value })}
        />
      )}
      <Input
        label="Contact number"
        required
        type="tel"
        autoComplete="off"
        value={form.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
      />
      <Select
        label="Authorisation type"
        required
        value={form.authorisation}
        options={AUTHORISATION_OPTIONS}
        error={
          verbalBlocked
            ? "Verbal consent isn't accepted for Schedule 5 or 6 medication. Upload written authorisation instead."
            : undefined
        }
        onChange={(e) => onChange({ authorisation: e.target.value as AuthorisationType })}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">
          Proof of authorisation{proofRequired && <span className="text-danger-500"> *</span>}
        </span>
        <ProofUpload file={form.proof} onChange={(proof) => onChange({ proof })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">
          Collector signature <span className="text-danger-500">*</span>
        </span>
        <SignaturePad onChange={(signature) => onChange({ signature })} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border-strong px-3.5 py-3">
        <input
          type="checkbox"
          checked={form.idVerified}
          onChange={(e) => onChange({ idVerified: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-brand-500"
        />
        <span>
          <span className="block text-[14px] font-medium text-text-primary">
            I have physically checked the collector's ID <span className="text-danger-500">*</span>
          </span>
          <span className="block text-[13px] text-text-secondary">
            The name and number match the document presented at the counter.
          </span>
        </span>
      </label>
      <TextAreaField label="Notes (optional)" value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
    </fieldset>
  );
}
