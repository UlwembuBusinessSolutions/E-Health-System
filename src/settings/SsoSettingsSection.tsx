import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Fingerprint, Info, Save, ShieldCheck } from "lucide-react";
import { getOrganizationSsoSettings, updateOrganizationSsoSettings } from "@/shared/api/organization";
import { apiOrigin } from "@/shared/api/client";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { FormRow } from "@/shared/components/FormRow";
import { Switch } from "@/shared/components/Switch";

// Mirrors OrganizationSsoSettingsController.SsoSettingsRequest — clientSecret
// is optional here for the same reason it's optional server-side: leaving
// it blank keeps whatever's already stored (see PasswordInput's hint
// below), so this form never round-trips the real secret back out.
const ssoSettingsSchema = z.object({
  enabled: z.boolean(),
  microsoftTenantId: z.string().trim().min(1, "Directory (tenant) ID is required").max(200),
  clientId: z.string().trim().min(1, "Application (client) ID is required").max(200),
  clientSecret: z.string().max(500),
});
type SsoSettingsValues = z.infer<typeof ssoSettingsSchema>;

// Backend's own callback URL every organization's Azure AD app
// registration needs configured as its redirect URI — shown read-only so
// an admin can copy it straight into the Azure portal rather than
// guessing at it (MicrosoftSsoService.backendCallbackUrl's own why-note on
// why this exact value matters: Microsoft rejects a mismatch).
const REDIRECT_URI = `${apiOrigin()}/api/v1/auth/sso/microsoft/callback`;

export function SsoSettingsSection() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["organization", "sso-settings"],
    queryFn: getOrganizationSsoSettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SsoSettingsValues>({
    resolver: zodResolver(ssoSettingsSchema),
    defaultValues: { enabled: false, microsoftTenantId: "", clientId: "", clientSecret: "" },
  });
  const enabled = watch("enabled");

  // clientSecret always resets to blank: the GET never returns it (see
  // organization.ts's own why-note), so there's nothing real to show.
  useEffect(() => {
    if (!settingsQuery.data || isDirty) return;
    reset({
      enabled: settingsQuery.data.enabled,
      microsoftTenantId: settingsQuery.data.microsoftTenantId ?? "",
      clientId: settingsQuery.data.clientId ?? "",
      clientSecret: "",
    });
  }, [settingsQuery.data, reset, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const mutation = useMutation({
    mutationFn: (values: SsoSettingsValues) =>
      updateOrganizationSsoSettings({
        enabled: values.enabled,
        microsoftTenantId: values.microsoftTenantId,
        clientId: values.clientId,
        clientSecret: values.clientSecret || undefined,
      }),
    onSuccess: (updated) => {
      setSaved(true);
      queryClient.setQueryData(["organization", "sso-settings"], updated);
      reset({
        enabled: updated.enabled,
        microsoftTenantId: updated.microsoftTenantId ?? "",
        clientId: updated.clientId ?? "",
        clientSecret: "",
      });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't save those settings. Try again.");
    },
  });

  const onSubmit = (values: SsoSettingsValues) => {
    setFormError(null);
    setSaved(false);
    if (values.enabled && !settingsQuery.data?.clientSecretSet && !values.clientSecret.trim()) {
      setError("clientSecret", { message: "Enter a client secret to turn on single sign-on." }, { shouldFocus: true });
      return;
    }
    mutation.mutate(values);
  };

  return (
    <div>
      {settingsQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : settingsQuery.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-[14px] text-text-secondary">
          <p>Single sign-on settings could not be loaded. Please try again.</p>
          <Button type="button" variant="secondary" loading={settingsQuery.isFetching} onClick={() => void settingsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onChange={() => { setSaved(false); setFormError(null); }} noValidate className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <Fingerprint className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-text-primary">
                {settingsQuery.data?.usable ? "Microsoft single sign-on is live" : "Set up Microsoft single sign-on"}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                {settingsQuery.data?.usable
                  ? "Staff can sign in with their own Microsoft account. Saving settings does not verify the connection."
                  : "Let staff sign in with their existing Microsoft (Microsoft 365 / Entra ID) account instead of a separate password. Register an application in your organization's Azure AD and paste its details below."}
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
              Single sign-on settings saved.
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card">
            <div className="m-5 flex items-center justify-between gap-4 sm:m-6">
              <div>
                <p className="text-[15px] font-semibold text-text-primary">Enable single sign-on</p>
                <p className="mt-1 text-[13px] text-text-secondary">
                  Shows a "Sign in with Microsoft" button on this organization's staff login page.
                </p>
              </div>
              <Switch
                checked={enabled}
                onChange={(checked) => setValue("enabled", checked, { shouldDirty: true })}
                label="Enable Microsoft single sign-on"
              />
            </div>

            <div className="border-t border-border-subtle" />
            <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
              <legend className="mb-2 text-[15px] font-semibold text-text-primary">Azure AD application</legend>
              <p className="text-[13px] text-text-secondary">
                From your Azure AD (Entra ID) admin center, under App registrations.
              </p>
              <FormRow>
                <Input
                  label="Directory (tenant) ID"
                  required
                  icon={<ShieldCheck className="size-4" aria-hidden />}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  autoComplete="off"
                  error={errors.microsoftTenantId?.message}
                  {...register("microsoftTenantId")}
                />
                <Input
                  label="Application (client) ID"
                  required
                  icon={<Fingerprint className="size-4" aria-hidden />}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  autoComplete="off"
                  error={errors.clientId?.message}
                  {...register("clientId")}
                />
              </FormRow>
              <PasswordInput
                label="Client secret"
                required={!settingsQuery.data?.clientSecretSet}
                autoComplete="new-password"
                hint={settingsQuery.data?.clientSecretSet ? "A client secret is stored. Leave blank to keep it." : "From \"Certificates & secrets\" on the app registration."}
                error={errors.clientSecret?.message}
                {...register("clientSecret")}
              />
            </fieldset>

            <div className="border-t border-border-subtle" />
            <div className="m-5 flex flex-col gap-2 sm:m-6">
              <p className="text-[13px] font-medium text-text-primary">Redirect URI</p>
              <p className="text-[13px] text-text-secondary">
                Add this exact value as a "Web" redirect URI on the app registration.
              </p>
              <code className="w-full overflow-x-auto rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2.5 font-mono text-[12.5px] text-text-primary">
                {REDIRECT_URI}
              </code>
            </div>
          </div>
          <div className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Single sign-on signs a staff member into their existing account (matched by email) — it doesn't create
              new accounts. Add staff under Staff before they try to sign in with Microsoft.
            </p>
          </div>
          <div className="z-10 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-card sm:sticky sm:bottom-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-[13px] text-text-secondary">
              {mutation.isPending ? "Saving changes…" : isDirty ? "You have unsaved changes" : saved ? "All changes saved" : "No unsaved changes"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={!isDirty || mutation.isPending} onClick={() => { reset(); setSaved(false); setFormError(null); }}>
                Discard changes
              </Button>
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
