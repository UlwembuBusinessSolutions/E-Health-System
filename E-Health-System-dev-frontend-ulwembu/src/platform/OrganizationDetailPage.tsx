import { useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Camera, Check, Copy, Hospital, KeyRound, Mail, Pencil, Pill, Plus, Store, Trash2, UserPlus, X } from "lucide-react";
import {
  getOrganization,
  listOrganizationAdmins,
  removeOrganizationAdmin,
  resetOrganizationAdminPassword,
  setOrganizationAdminEnabled,
  suspendOrganization,
  reactivateOrganization,
  uploadOrganizationLogo,
  updateOrganization,
  listOrganizationModules,
  toggleOrganizationModule,
  listOrganizationFacilities,
  getOrganizationMailSettings,
  updateOrganizationMailSettings,
  type ModulePhase,
  type OrganizationSector,
  type FacilityType,
} from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { StatusPill } from "@/shared/components/StatusPill";
import { FormRow } from "@/shared/components/FormRow";
import { SectorTag, SECTOR_OPTIONS } from "./components/SectorTag";

import { OrganizationAuditTrail } from "./OrganizationAuditTrail";

// Slug isn't part of this — see the backend's own why-note (Organization.rename())
// on why that one stays permanent.
const editDetailsSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  sector: z.string().min(1, "Select a sector"),
});
type EditDetailsValues = z.infer<typeof editDetailsSchema>;

// Same shape as settings/OrganizationSettingsPage.tsx's own schema — that
// one is an org admin editing their own tenant's SMTP account,
// self-service; this is the platform team doing the same thing on a
// tenant's behalf (support requests, an admin who isn't set up yet). Kept
// as two copies rather than a shared module: the tenant and platform apps
// don't otherwise share form code, same call the rest of this codebase
// already makes between core.tenant's two mail-settings controllers.
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const FACILITY_TYPE_ICON: Record<FacilityType, typeof Building2> = {
  CLINIC: Building2,
  HOSPITAL: Hospital,
  STORE: Store,
  PHARMACY: Pill,
};

const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  CLINIC: "Clinic",
  HOSPITAL: "Hospital",
  STORE: "Store",
  PHARMACY: "Pharmacy",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text-primary"
      aria-label="Copy password"
      title="Copy"
    >
      {copied ? <Check className="size-3.5 text-success-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

// Declaration order, not alphabetical — build-sequence order (Foundation
// first), matching the Conversion Ledger's own phase grouping.
const PHASE_ORDER: ModulePhase[] = ["FOUNDATION", "MVP0", "PHASE_2", "PHASE_3", "PHASE_4"];
const PHASE_LABELS: Record<ModulePhase, string> = {
  FOUNDATION: "Foundation",
  MVP0: "MVP0",
  PHASE_2: "Phase 2",
  PHASE_3: "Phase 3",
  PHASE_4: "Phase 4",
};

// One organization's own page — what OrganizationsPage's row chevron leads
// to. Everything scoped to this one client: its lifecycle switch (suspend/
// reactivate, same action the list offers, kept here too since this is
// where someone lands after clicking in specifically to manage it) and its
// admin roster, including the remove path the list never had room for.
export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{ id: string; password: string } | null>(null);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isEditingMail, setIsEditingMail] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId],
    queryFn: () => getOrganization(organizationId),
  });

  const {
    register: registerDetails,
    handleSubmit: handleDetailsSubmit,
    reset: resetDetailsForm,
    formState: { errors: detailsErrors, isSubmitting: isSubmittingDetails },
  } = useForm<EditDetailsValues>({
    resolver: zodResolver(editDetailsSchema),
    defaultValues: { displayName: "", sector: "" },
  });

  const startEditing = () => {
    if (!orgQuery.data) return;
    resetDetailsForm({ displayName: orgQuery.data.displayName, sector: orgQuery.data.sector });
    setDetailsError(null);
    setIsEditing(true);
  };

  const updateDetails = useMutation({
    mutationFn: (values: EditDetailsValues) =>
      updateOrganization(organizationId, { displayName: values.displayName, sector: values.sector as OrganizationSector }),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (error) => {
      setDetailsError(error instanceof ApiError ? error.message : "Couldn't save those changes. Try again.");
    },
  });

  const mailSettingsQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "mail-settings"],
    queryFn: () => getOrganizationMailSettings(organizationId),
    enabled: !!organizationId,
  });

  const {
    register: registerMail,
    handleSubmit: handleMailSubmit,
    reset: resetMailForm,
    formState: { errors: mailErrors, isSubmitting: isSubmittingMail },
  } = useForm<MailSettingsValues>({
    resolver: zodResolver(mailSettingsSchema),
    defaultValues: { host: "", port: "587", username: "", password: "", fromAddress: "" },
  });

  const startEditingMail = () => {
    if (!mailSettingsQuery.data) return;
    resetMailForm({
      host: mailSettingsQuery.data.host ?? "",
      port: mailSettingsQuery.data.port ? String(mailSettingsQuery.data.port) : "587",
      username: mailSettingsQuery.data.username ?? "",
      password: "",
      fromAddress: mailSettingsQuery.data.fromAddress ?? "",
    });
    setMailError(null);
    setIsEditingMail(true);
  };

  const updateMailSettings = useMutation({
    mutationFn: (values: MailSettingsValues) =>
      updateOrganizationMailSettings(organizationId, {
        host: values.host,
        port: Number(values.port),
        username: values.username,
        password: values.password || undefined,
        fromAddress: values.fromAddress,
      }),
    onSuccess: () => {
      setIsEditingMail(false);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId, "mail-settings"] });
    },
    onError: (error) => {
      setMailError(error instanceof ApiError ? error.message : "Couldn't save those settings. Try again.");
    },
  });

  const adminsQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "admins"],
    queryFn: () => listOrganizationAdmins(organizationId),
    enabled: !!organizationId,
  });

  const facilitiesQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "facilities"],
    queryFn: () => listOrganizationFacilities(organizationId),
    enabled: !!organizationId,
  });

  const toggleStatus = useMutation({
    mutationFn: async () => {
      if (!orgQuery.data) return;
      if (orgQuery.data.status === "ACTIVE") {
        await suspendOrganization(organizationId);
      } else {
        await reactivateOrganization(organizationId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadOrganizationLogo(organizationId, file),
    onMutate: () => setLogoError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (error) => {
      setLogoError(error instanceof ApiError ? error.message : "Couldn't upload that logo. Try again.");
    },
  });

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadLogo.mutate(file);
  };

  const modulesQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "modules"],
    queryFn: () => listOrganizationModules(organizationId),
    enabled: !!organizationId,
  });

  const toggleModule = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      toggleOrganizationModule(organizationId, code, enabled),
    onMutate: ({ code }) => {
      setModuleError(null);
      setTogglingCode(code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId, "modules"] });
    },
    onError: (error) => {
      setModuleError(error instanceof ApiError ? error.message : "Couldn't update that module. Try again.");
    },
    onSettled: () => setTogglingCode(null),
  });

  const removeAdmin = useMutation({
    mutationFn: (userId: string) => removeOrganizationAdmin(organizationId, userId),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId, "admins"] });
    },
    onError: (error) => {
      setRemoveTarget(null);
      setRemoveError(error instanceof ApiError ? error.message : "Couldn't remove this admin. Try again.");
    },
  });

  const resetAdminPassword = useMutation({
    mutationFn: (userId: string) => resetOrganizationAdminPassword(organizationId, userId),
    onMutate: () => setAdminActionError(null),
    onSuccess: (result, userId) => {
      setConfirmResetId(null);
      setRevealedPassword({ id: userId, password: result.temporaryPassword });
    },
    onError: (error) => {
      setConfirmResetId(null);
      setAdminActionError(error instanceof ApiError ? error.message : "Couldn't reset that password. Try again.");
    },
  });

  const toggleAdminEnabled = useMutation({
    mutationFn: ({ userId, enabled }: { userId: string; enabled: boolean }) =>
      setOrganizationAdminEnabled(organizationId, userId, enabled),
    onMutate: () => setAdminActionError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organizations", organizationId, "admins"] }),
    onError: (error) => {
      setAdminActionError(error instanceof ApiError ? error.message : "Couldn't update that account. Try again.");
    },
  });

  const admins = adminsQuery.data ?? [];
  const facilities = facilitiesQuery.data ?? [];
  const modules = modulesQuery.data ?? [];
  const enabledCount = modules.filter((m) => m.enabled).length;

  return (
    <div>
      <Link
        to="/platform/organizations"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to organizations
      </Link>

      {orgQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : !orgQuery.data ? (
        <p className="text-[14px] text-text-secondary">This organization couldn't be found.</p>
      ) : (
        <>
          <Card className="mb-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLogo.isPending}
                  className="group relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-brand-600 disabled:cursor-wait"
                  aria-label="Upload organization logo"
                  title="Upload logo"
                >
                  {orgQuery.data.logoUrl ? (
                    <img src={orgQuery.data.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Building2 className="size-5" aria-hidden />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-white opacity-0 transition-all duration-150 group-hover:bg-ink-900/50 group-hover:opacity-100">
                    <Camera className="size-4" aria-hidden />
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                {isEditing ? (
                  <form
                    id="edit-org-details"
                    onSubmit={handleDetailsSubmit((values) => updateDetails.mutate(values))}
                    noValidate
                    className="flex flex-col gap-3 sm:flex-row sm:items-start"
                  >
                    <Input
                      label="Display name"
                      required
                      autoFocus
                      className="sm:w-64"
                      error={detailsErrors.displayName?.message}
                      {...registerDetails("displayName")}
                    />
                    <Select
                      label="Sector"
                      required
                      options={SECTOR_OPTIONS}
                      className="sm:w-40"
                      error={detailsErrors.sector?.message}
                      {...registerDetails("sector")}
                    />
                  </form>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-[19px] font-semibold text-text-primary">{orgQuery.data.displayName}</h1>
                      <SectorTag sector={orgQuery.data.sector} />
                      <button
                        type="button"
                        onClick={startEditing}
                        className="flex size-6 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
                        aria-label="Edit organization details"
                        title="Edit details"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <p className="font-mono text-[13px] text-text-secondary">
                      {orgQuery.data.slug} · created {formatDate(orgQuery.data.createdAt)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<X className="size-4" aria-hidden />}
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" form="edit-org-details" loading={isSubmittingDetails || updateDetails.isPending}>
                      Save changes
                    </Button>
                  </>
                ) : (
                  <>
                    <StatusPill tone={orgQuery.data.status === "ACTIVE" ? "success" : "danger"}>
                      {orgQuery.data.status === "ACTIVE" ? "Active" : "Suspended"}
                    </StatusPill>
                    <Button variant="secondary" loading={toggleStatus.isPending} onClick={() => toggleStatus.mutate()}>
                      {orgQuery.data.status === "ACTIVE" ? "Suspend organization" : "Reactivate organization"}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {detailsError && (
              <p role="alert" className="mt-3 text-[12.5px] text-danger-600">
                {detailsError}
              </p>
            )}
            {(uploadLogo.isPending || logoError) && (
              <p className={`mt-3 text-[12.5px] ${logoError ? "text-danger-600" : "text-text-secondary"}`}>
                {logoError ?? "Uploading logo…"}
              </p>
            )}
          </Card>

          <Card className="mb-6 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Mail className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <h2 className="text-[14.5px] font-semibold text-text-primary">Email settings</h2>
                  <p className="text-[12.5px] text-text-secondary">
                    The SMTP account this organization sends every outbound email through — account creation,
                    password resets, and sign-in related notices.
                  </p>
                </div>
              </div>
              {!isEditingMail && mailSettingsQuery.data && (
                <button
                  type="button"
                  onClick={startEditingMail}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
                  aria-label="Edit email settings"
                  title="Edit email settings"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              )}
            </div>

            {mailSettingsQuery.isLoading ? (
              <p className="mt-4 text-[13.5px] text-text-secondary">Loading…</p>
            ) : isEditingMail ? (
              <form
                onSubmit={handleMailSubmit((values) => updateMailSettings.mutate(values))}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <FormRow>
                  <Input
                    label="SMTP host"
                    required
                    placeholder="smtp.yourprovider.example"
                    autoComplete="off"
                    error={mailErrors.host?.message}
                    {...registerMail("host")}
                  />
                  <Input
                    label="Port"
                    required
                    inputMode="numeric"
                    placeholder="587"
                    autoComplete="off"
                    error={mailErrors.port?.message}
                    {...registerMail("port")}
                  />
                </FormRow>
                <FormRow>
                  <Input
                    label="Username"
                    required
                    placeholder="noreply@yourcompany.example"
                    autoComplete="off"
                    error={mailErrors.username?.message}
                    {...registerMail("username")}
                  />
                  <PasswordInput
                    label="Password"
                    autoComplete="new-password"
                    hint={mailSettingsQuery.data?.passwordSet ? "Leave blank to keep the current password." : undefined}
                    error={mailErrors.password?.message}
                    {...registerMail("password")}
                  />
                </FormRow>
                <Input
                  label={'"From" address'}
                  required
                  type="email"
                  placeholder="noreply@yourcompany.example"
                  autoComplete="off"
                  error={mailErrors.fromAddress?.message}
                  {...registerMail("fromAddress")}
                />
                {mailError && (
                  <p role="alert" className="text-[12.5px] text-danger-600">
                    {mailError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={isSubmittingMail || updateMailSettings.isPending}>
                    Save email settings
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setIsEditingMail(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : mailSettingsQuery.data?.host ? (
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
                <div>
                  <dt className="text-text-secondary">SMTP host</dt>
                  <dd className="text-text-primary">
                    {mailSettingsQuery.data.host}:{mailSettingsQuery.data.port}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Username</dt>
                  <dd className="text-text-primary">{mailSettingsQuery.data.username}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Password</dt>
                  <dd className="text-text-primary">{mailSettingsQuery.data.passwordSet ? "Set" : "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">"From" address</dt>
                  <dd className="text-text-primary">{mailSettingsQuery.data.fromAddress}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-[13.5px] text-text-secondary">
                Not configured yet — this organization's emails send through the platform's default account.{" "}
                <button type="button" onClick={startEditingMail} className="font-medium text-brand-600 hover:underline">
                  Set it up
                </button>
                .
              </p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div>
                <h2 className="text-[14.5px] font-semibold text-text-primary">Admins</h2>
                <p className="text-[12.5px] text-text-secondary">
                  {admins.length} admin{admins.length === 1 ? "" : "s"} with ORG_ADMIN on this organization
                </p>
              </div>
              {orgQuery.data.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  icon={<UserPlus className="size-4" aria-hidden />}
                  onClick={() => navigate(`/platform/organizations/${organizationId}/admins/new`)}
                >
                  Add admin
                </Button>
              )}
            </div>

            {(removeError || adminActionError) && (
              <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600">
                {removeError ?? adminActionError}
              </div>
            )}

            <div className="divide-y divide-border-subtle">
              {adminsQuery.isLoading && (
                <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading admins…</p>
              )}
              {admins.length === 0 && !adminsQuery.isLoading && (
                <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">No admins on this organization.</p>
              )}
              {admins.map((admin) => (
                <div key={admin.userId} className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11.5px] font-semibold text-ink-600">
                      {initials(admin.firstName, admin.lastName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-medium text-text-primary">
                          {admin.firstName} {admin.lastName}
                        </p>
                        <StatusPill tone={admin.status === "ACTIVE" ? "success" : admin.status === "LOCKED" ? "warning" : "neutral"}>
                          {admin.status === "ACTIVE" ? "Active" : admin.status === "LOCKED" ? "Locked" : "Disabled"}
                        </StatusPill>
                      </div>
                      <p className="flex items-center gap-1 truncate text-[12.5px] text-text-secondary">
                        <Mail className="size-3" aria-hidden />
                        {admin.email}
                      </p>
                    </div>
                  </div>

                  {revealedPassword?.id === admin.userId ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-surface-sunken px-2 py-1 font-mono text-[12.5px] text-text-primary">
                        {revealedPassword.password}
                      </span>
                      <CopyButton text={revealedPassword.password} />
                      <Button size="md" variant="secondary" onClick={() => setRevealedPassword(null)}>
                        Done
                      </Button>
                    </div>
                  ) : confirmResetId === admin.userId ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[12.5px] text-text-secondary">Generate a new password?</span>
                      <Button variant="secondary" size="md" onClick={() => setConfirmResetId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="md"
                        loading={resetAdminPassword.isPending}
                        onClick={() => resetAdminPassword.mutate(admin.userId)}
                      >
                        Confirm
                      </Button>
                    </div>
                  ) : removeTarget === admin.userId ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[12.5px] text-text-secondary">Remove this admin?</span>
                      <Button variant="secondary" size="md" onClick={() => setRemoveTarget(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="md"
                        loading={removeAdmin.isPending}
                        className="bg-danger-500! hover:bg-danger-600!"
                        onClick={() => removeAdmin.mutate(admin.userId)}
                      >
                        Confirm
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<KeyRound className="size-3.5" aria-hidden />}
                        onClick={() => setConfirmResetId(admin.userId)}
                      >
                        Reset password
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        loading={toggleAdminEnabled.isPending && toggleAdminEnabled.variables?.userId === admin.userId}
                        onClick={() =>
                          toggleAdminEnabled.mutate({ userId: admin.userId, enabled: admin.status === "DISABLED" })
                        }
                      >
                        {admin.status === "DISABLED" ? "Enable" : "Disable"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(admin.userId)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-danger-600 transition-colors duration-150 hover:bg-danger-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-6 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div>
                <h2 className="text-[14.5px] font-semibold text-text-primary">Clinics</h2>
                <p className="text-[12.5px] text-text-secondary">
                  {facilities.length} clinic{facilities.length === 1 ? "" : "s"} in this organization's facility network
                </p>
              </div>
              {orgQuery.data.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  icon={<Plus className="size-4" aria-hidden />}
                  onClick={() => navigate(`/platform/organizations/${organizationId}/facilities/new`)}
                >
                  Add clinic
                </Button>
              )}
            </div>

            <div className="divide-y divide-border-subtle">
              {facilitiesQuery.isLoading && (
                <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading clinics…</p>
              )}
              {facilities.length === 0 && !facilitiesQuery.isLoading && (
                <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">
                  No clinics yet — this organization's facility network is empty.
                </p>
              )}
              {facilities.map((facility) => {
                const Icon = FACILITY_TYPE_ICON[facility.type];
                return (
                  <div key={facility.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13.5px] font-medium text-text-primary">{facility.name}</p>
                          <StatusPill tone={facility.active ? "success" : "neutral"}>
                            {facility.active ? "Active" : "Inactive"}
                          </StatusPill>
                        </div>
                        <p className="truncate text-[12.5px] text-text-secondary">
                          {facility.code} · {FACILITY_TYPE_LABEL[facility.type]}
                          {facility.address ? ` · ${facility.address}` : ""}
                        </p>
                      </div>
                    </div>
                    {facility.operatingHours && (
                      <span className="shrink-0 text-[12px] text-text-secondary">{facility.operatingHours}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="mt-6 overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[14.5px] font-semibold text-text-primary">Modules</h2>
              <p className="text-[12.5px] text-text-secondary">
                {enabledCount} of {modules.length || 20} enabled
              </p>
            </div>

            {moduleError && (
              <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600">
                {moduleError}
              </div>
            )}

            {modulesQuery.isLoading ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading modules…</p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {PHASE_ORDER.map((phase) => {
                  const phaseModules = modules.filter((m) => m.phase === phase);
                  if (phaseModules.length === 0) return null;
                  return (
                    <div key={phase} className="px-5 py-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        {PHASE_LABELS[phase]}
                      </p>
                      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                        {phaseModules.map((mod) => (
                          <div key={mod.code} className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                                {mod.code}
                              </span>
                              <span className="truncate text-[13px] text-text-primary">{mod.displayName}</span>
                            </div>
                            {mod.foundation ? (
                              <span className="shrink-0 text-[11px] font-medium text-text-secondary">Always on</span>
                            ) : (
                              <Switch
                                checked={mod.enabled}
                                disabled={togglingCode === mod.code}
                                onChange={(enabled) => toggleModule.mutate({ code: mod.code, enabled })}
                                label={`${mod.enabled ? "Disable" : "Enable"} ${mod.displayName}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <OrganizationAuditTrail
            key={organizationId}
            organizationId={organizationId}
            organizationName={orgQuery.data.displayName}
          />
        </>
      )}
    </div>
  );
}
