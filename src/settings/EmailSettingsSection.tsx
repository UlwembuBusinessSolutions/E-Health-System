import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, Server, User, Info, Save } from "lucide-react";
import {
  getOrganizationMailSettings,
  updateOrganizationMailSettings,
} from "@/shared/api/organization";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { FormRow } from "@/shared/components/FormRow";

// Mirrors OrganizationMailSettingsController.MailSettingsRequest — password
// is optional here for the same reason it's optional server-side: leaving
// it blank keeps whatever's already stored (see PasswordInput's hint
// below), so this form never round-trips the real password back out.
const mailSettingsSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required").max(255),
  port: z
    .string()
    .trim()
    .min(1, "Port is required")
    .refine((value) => {
      const port = Number(value);
      return Number.isInteger(port) && port > 0 && port <= 65535;
    }, "Enter a valid port number"),
  username: z.string().trim().min(1, "Username is required").max(255),
  password: z.string().max(255),
  fromAddress: z.string().trim().min(1, "\"From\" address is required").email("Enter a valid email address"),
});
type MailSettingsValues = z.infer<typeof mailSettingsSchema>;

export function EmailSettingsSection() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["organization", "mail-settings"],
    queryFn: getOrganizationMailSettings,
  });
  const configured = Boolean(settingsQuery.data?.host && settingsQuery.data?.username && settingsQuery.data?.passwordSet);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MailSettingsValues>({
    resolver: zodResolver(mailSettingsSchema),
    defaultValues: { host: "", port: "587", username: "", password: "", fromAddress: "" },
  });

  // Populated once the current settings load — port comes back as a
  // number from the API but react-hook-form's registered inputs here are
  // all text, so it's converted going in and back out (onSubmit below).
  // password always resets to blank: the GET never returns it (see
  // organization.ts's own why-note), so there's nothing real to show.
  useEffect(() => {
    if (!settingsQuery.data || isDirty) return;
    reset({
      host: settingsQuery.data.host ?? "",
      port: settingsQuery.data.port ? String(settingsQuery.data.port) : "587",
      username: settingsQuery.data.username ?? "",
      password: "",
      fromAddress: settingsQuery.data.fromAddress ?? "",
    });
  }, [settingsQuery.data, reset, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const mutation = useMutation({
    mutationFn: (values: MailSettingsValues) =>
      updateOrganizationMailSettings({
        host: values.host,
        port: Number(values.port),
        username: values.username,
        password: values.password || undefined,
        fromAddress: values.fromAddress,
      }),
    onSuccess: (updated) => {
      setSaved(true);
      queryClient.setQueryData(["organization", "mail-settings"], updated);
      reset({
        host: updated.host ?? "",
        port: updated.port ? String(updated.port) : "587",
        username: updated.username ?? "",
        password: "",
        fromAddress: updated.fromAddress ?? "",
      });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't save those settings. Try again.");
    },
  });

  const onSubmit = (values: MailSettingsValues) => {
    setFormError(null);
    setSaved(false);
    if (!settingsQuery.data?.passwordSet && !values.password.trim()) {
      setError("password", { message: "Enter a password to configure your mail server." }, { shouldFocus: true });
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
          <p>Email settings could not be loaded. Please try again.</p>
          <Button type="button" variant="secondary" loading={settingsQuery.isFetching} onClick={() => void settingsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onChange={() => { setSaved(false); setFormError(null); }} noValidate className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-text-primary">{configured ? "Organization email configured" : "Set up organization email"}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{configured ? "Your saved mail server is used for organization notifications. Saving settings does not verify delivery." : "Connect your mail provider to send account invitations, password resets and patient transfer notices."}</p>
            </div>
          </div>
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600"
            >
              {formError}
            </div>
          )}
          {saved && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-50 px-3.5 py-2.5 text-[13.5px] text-success-600">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Email settings saved.
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card">
          <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
            <legend className="mb-2 text-[15px] font-semibold text-text-primary">Mail server</legend>
            <p className="text-[13px] text-text-secondary">Enter the outgoing server details supplied by your email provider.</p>
            <FormRow>
              <Input
                label="SMTP host"
                required
                icon={<Server className="size-4" aria-hidden />}
                placeholder="smtp.yourprovider.example"
                autoComplete="off"
                error={errors.host?.message}
                {...register("host")}
              />
              <Input
                label="Port"
                required
                inputMode="numeric"
                placeholder="587"
                hint="Use the port provided by your mail administrator."
                autoComplete="off"
                error={errors.port?.message}
                {...register("port")}
              />
            </FormRow>
          </fieldset>

          <div className="border-t border-border-subtle" />
          <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
            <legend className="mb-2 text-[15px] font-semibold text-text-primary">Authentication</legend>
            <p className="text-[13px] text-text-secondary">Use your mail provider's credentials or an app password.</p>
            <FormRow>
              <Input
                label="Username"
                required
                icon={<User className="size-4" aria-hidden />}
                placeholder="noreply@yourcompany.example"
                autoComplete="off"
                error={errors.username?.message}
                {...register("username")}
              />
              <PasswordInput
                label="Password"
                required={!settingsQuery.data?.passwordSet}
                autoComplete="new-password"
                hint={settingsQuery.data?.passwordSet ? "A password is stored. Leave blank to keep it." : "Enter the password supplied by your mail provider."}
                error={errors.password?.message}
                {...register("password")}
              />
            </FormRow>
          </fieldset>

          <div className="border-t border-border-subtle" />
          <fieldset className="m-5 flex min-w-0 flex-col gap-4 sm:m-6" disabled={mutation.isPending}>
            <legend className="mb-2 text-[15px] font-semibold text-text-primary">Sender details</legend>
            <Input
              label="Sender email address"
              required
              type="email"
              icon={<Mail className="size-4" aria-hidden />}
              placeholder="noreply@yourcompany.example"
              autoComplete="off"
              hint="Shown as the sender on every email this organization sends."
              error={errors.fromAddress?.message}
              {...register("fromAddress")}
            />

          </fieldset>
          </div>
          <div className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /><p>These settings apply to this organization. Platform operator emails are managed separately.</p></div>
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
