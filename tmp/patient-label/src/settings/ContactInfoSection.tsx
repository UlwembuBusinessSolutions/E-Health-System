import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, MapPin, Save } from "lucide-react";
import { getOrganizationSelf, updateOrganizationProfile } from "@/shared/api/organization";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { FormRow } from "@/shared/components/FormRow";

// Mirrors OrganizationProfileController.ProfileRequest — org-wide contact/
// location info, distinct from Facilities' own per-clinic address/phone/
// hours (FacilitiesSettingsSection). Read rides along on
// getOrganizationSelf() (the same call the sidebar/dashboard already make);
// writes go through updateOrganizationProfile().
const profileSchema = z.object({
  description: z.string().trim().max(1000),
  contactEmail: z.string().trim().max(255).refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Enter a valid email address",
  ),
  contactPhone: z.string().trim().max(20),
  address: z.string().trim().max(300),
  businessHours: z.string().trim().max(200),
  websiteUrl: z.string().trim().max(255),
  facebookUrl: z.string().trim().max(255),
  instagramUrl: z.string().trim().max(255),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ContactInfoSection() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      description: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      businessHours: "",
      websiteUrl: "",
      facebookUrl: "",
      instagramUrl: "",
    },
  });

  useEffect(() => {
    if (!orgQuery.data || isDirty) return;
    reset({
      description: orgQuery.data.description ?? "",
      contactEmail: orgQuery.data.contactEmail ?? "",
      contactPhone: orgQuery.data.contactPhone ?? "",
      address: orgQuery.data.address ?? "",
      businessHours: orgQuery.data.businessHours ?? "",
      websiteUrl: orgQuery.data.websiteUrl ?? "",
      facebookUrl: orgQuery.data.facebookUrl ?? "",
      instagramUrl: orgQuery.data.instagramUrl ?? "",
    });
  }, [orgQuery.data, reset, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      updateOrganizationProfile({
        description: values.description || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        address: values.address || undefined,
        businessHours: values.businessHours || undefined,
        websiteUrl: values.websiteUrl || undefined,
        facebookUrl: values.facebookUrl || undefined,
        instagramUrl: values.instagramUrl || undefined,
      }),
    onSuccess: (_, values) => {
      setSaved(true);
      queryClient.setQueryData(["organization", "self"], (current: typeof orgQuery.data) =>
        current ? { ...current, ...values } : current);
      reset(values);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't save those settings. Try again.");
    },
  });

  const onSubmit = (values: ProfileValues) => {
    setFormError(null);
    setSaved(false);
    mutation.mutate(values);
  };

  return (
    <div>
      {orgQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : orgQuery.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-[14px] text-text-secondary">
          <p>Contact info could not be loaded. Please try again.</p>
          <Button type="button" variant="secondary" loading={orgQuery.isFetching} onClick={() => void orgQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onChange={() => { setSaved(false); setFormError(null); }} noValidate className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <MapPin className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-text-primary">Organization contact info</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                Shown wherever your organization's contact details and location matter — a future patient-facing
                site reads this instead of it being hardcoded anywhere.
              </p>
            </div>
          </div>
          {formError && (
            <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
              {formError}
            </div>
          )}
          {saved && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-50 px-3.5 py-2.5 text-[13.5px] text-success-600">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Contact info saved.
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card">
            <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
              <legend className="mb-2 text-[15px] font-semibold text-text-primary">About</legend>
              <Input
                label="Description"
                placeholder="A short description of your organization"
                error={errors.description?.message}
                {...register("description")}
              />
            </fieldset>

            <div className="border-t border-border-subtle" />
            <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
              <legend className="mb-2 text-[15px] font-semibold text-text-primary">Contact</legend>
              <FormRow>
                <Input
                  label="Contact email"
                  type="email"
                  placeholder="info@yourcompany.example"
                  error={errors.contactEmail?.message}
                  {...register("contactEmail")}
                />
                <Input
                  label="Contact phone"
                  type="tel"
                  placeholder="+27 11 555 0100"
                  error={errors.contactPhone?.message}
                  {...register("contactPhone")}
                />
              </FormRow>
              <Input
                label="Address"
                placeholder="12 Cradle Street, Johannesburg"
                error={errors.address?.message}
                {...register("address")}
              />
              <Input
                label="Business hours"
                placeholder="Mon-Fri 07:00-17:00"
                error={errors.businessHours?.message}
                {...register("businessHours")}
              />
            </fieldset>

            <div className="border-t border-border-subtle" />
            <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
              <legend className="mb-2 text-[15px] font-semibold text-text-primary">Online presence</legend>
              <Input
                label="Website"
                placeholder="https://yourcompany.example"
                error={errors.websiteUrl?.message}
                {...register("websiteUrl")}
              />
              <FormRow>
                <Input
                  label="Facebook"
                  placeholder="https://facebook.com/yourcompany"
                  error={errors.facebookUrl?.message}
                  {...register("facebookUrl")}
                />
                <Input
                  label="Instagram"
                  placeholder="https://instagram.com/yourcompany"
                  error={errors.instagramUrl?.message}
                  {...register("instagramUrl")}
                />
              </FormRow>
            </fieldset>
          </div>
          <div className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /><p>Visible to every signed-in staff member; only an ORG_ADMIN can change it.</p></div>
          <div className="z-10 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-card sm:sticky sm:bottom-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-[13px] text-text-secondary">{mutation.isPending ? "Saving changes…" : isDirty ? "You have unsaved changes" : saved ? "All changes saved" : "No unsaved changes"}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={!isDirty || mutation.isPending} onClick={() => { reset(); setSaved(false); setFormError(null); }}>Discard changes</Button>
              <Button type="submit" icon={<Save className="size-4" aria-hidden />} disabled={!isDirty} loading={isSubmitting || mutation.isPending}>
                Save changes
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
