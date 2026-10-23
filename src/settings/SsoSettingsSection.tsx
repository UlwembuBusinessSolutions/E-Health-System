import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Fingerprint, Save, ShieldCheck } from "lucide-react";
import { getOrganizationSsoSettings, updateOrganizationSsoSettings, type UpdateOrganizationSsoSettingsPayload } from "@/shared/api/organization";
import { apiOrigin, ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Switch } from "@/shared/components/Switch";

const DEFAULTS: UpdateOrganizationSsoSettingsPayload = {
  enabled: false, provider: "MICROSOFT", microsoftTenantId: "", clientId: "", clientSecret: "",
  issuerUri: "", samlIdpEntityId: "", samlSsoUrl: "", samlVerificationCertificate: "",
  nativeLoginAllowed: true, jitProvisioningEnabled: false, allowedEmailDomain: "",
};
export function SsoSettingsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateOrganizationSsoSettingsPayload>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["organization", "sso-settings"], queryFn: getOrganizationSsoSettings });
  useEffect(() => {
    if (!query.data || dirty) return;
    setForm({
      enabled: query.data.enabled, provider: query.data.provider ?? "MICROSOFT",
      microsoftTenantId: query.data.microsoftTenantId ?? "", clientId: query.data.clientId ?? "",
      clientSecret: "", issuerUri: query.data.issuerUri ?? "",
      samlIdpEntityId: query.data.samlIdpEntityId ?? "", samlSsoUrl: query.data.samlSsoUrl ?? "",
      samlVerificationCertificate: "", nativeLoginAllowed: query.data.nativeLoginAllowed ?? true,
      jitProvisioningEnabled: query.data.jitProvisioningEnabled ?? false,
      allowedEmailDomain: query.data.allowedEmailDomain ?? "",
    });
  }, [query.data, dirty]);
  const update = <K extends keyof UpdateOrganizationSsoSettingsPayload>(field: K, value: UpdateOrganizationSsoSettingsPayload[K]) => {
    setForm((old) => ({ ...old, [field]: value })); setDirty(true); setSaved(false); setError(null);
  };
  const mutation = useMutation({
    mutationFn: updateOrganizationSsoSettings,
    onSuccess: (result) => { queryClient.setQueryData(["organization", "sso-settings"], result); setDirty(false); setSaved(true); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "SSO settings could not be saved."),
  });
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.enabled && form.jitProvisioningEnabled && !form.allowedEmailDomain.trim()) {
      setError("Provide the employer's approved email domain before enabling JIT provisioning."); return;
    }
    if (form.enabled && form.provider === "SAML" && !query.data?.samlCertificateSet && !form.samlVerificationCertificate?.trim()) {
      setError("Upload or paste the trusted IdP X.509 signing certificate before enabling SAML."); return;
    }
    if (form.enabled && form.provider !== "SAML" && (!query.data?.clientSecretSet || query.data?.provider !== form.provider) && !form.clientSecret?.trim()) {
      setError("Enter the identity provider's client secret."); return;
    }
    if (form.enabled && !form.nativeLoginAllowed && !form.allowedEmailDomain.trim()) {
      setError("For an SSO-only tenant, specify a trusted employer email domain first."); return;
    }
    mutation.mutate(form);
  };
  const callback = `${apiOrigin()}/api/v1/auth/sso/oidc/callback`;
  const metadata = `${apiOrigin()}/saml2/service-provider-metadata/{tenant-slug}`;
  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
        <Fingerprint className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-text-primary">Tenant Single Sign-On (SSO)</p>
          <p className="mt-1 text-[13px] text-text-secondary">Configure the employer's own OAuth2/OpenID Connect or SAML 2.0 identity provider. Credentials are stored server-side; never shown to employees.</p>
          {query.data?.usable && <p className="mt-2 text-[13px] text-success-600">Configured for {query.data.provider} (connection has not been live-tested)</p>}
        </div>
      </div>
      {query.isLoading && <p>Loading SSO settings…</p>}
      {query.isError && <p role="alert">SSO settings could not be loaded. <button onClick={() => void query.refetch()}>Retry</button></p>}
      {query.data && <form onSubmit={save} className="space-y-5" autoComplete="off">
        {error && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-[13px] text-danger-600">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-[13px] text-success-600"><CheckCircle2 size={16}/>Settings saved.</p>}
        <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <div className="flex items-center justify-between gap-4">
            <div><strong>Enable SSO</strong><p className="text-[13px] text-text-secondary">Employees sign in using their employer's identity provider.</p></div>
            <Switch checked={form.enabled} onChange={(value) => update("enabled", value)} label="Enable single sign-on" />
          </div>
          <label className="block text-[13px] font-medium text-text-primary">Identity provider
            <select className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[14px]"
              value={form.provider} onChange={(e) => update("provider", e.target.value as UpdateOrganizationSsoSettingsPayload["provider"])}>
              <option value="MICROSOFT">Microsoft Entra ID (OIDC)</option>
              <option value="OIDC">Other OAuth2 / OpenID Connect</option>
              <option value="SAML">SAML 2.0 Identity Provider</option>
            </select>
          </label>
          {form.provider === "MICROSOFT" && <Input label="Entra Directory (tenant) UUID" value={form.microsoftTenantId} onChange={(e) => update("microsoftTenantId", e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />}
          {form.provider === "OIDC" && <Input label="OIDC issuer URL (HTTPS)" value={form.issuerUri} onChange={(e) => update("issuerUri", e.target.value)} placeholder="https://idp.example.com/realms/organization" />}
          {form.provider !== "SAML" && <>
            <Input label="OAuth2 / OIDC client ID" value={form.clientId} onChange={(e) => update("clientId", e.target.value)} />
            <PasswordInput label="Client secret" value={form.clientSecret} onChange={(e) => update("clientSecret", e.target.value)} hint={query.data.clientSecretSet ? "Secret stored. Leave blank to retain." : "Required to enable SSO."} />
            <p className="text-[12px] text-text-secondary">Register this redirect URI with the provider:</p>
            <code className="block overflow-x-auto rounded-lg bg-surface-sunken px-3 py-2 text-[12px]">{callback}</code>
          </>}
          {form.provider === "SAML" && <>
            <Input label="IdP entity ID (issuer)" value={form.samlIdpEntityId} onChange={(e) => update("samlIdpEntityId", e.target.value)} placeholder="https://idp.example.com/metadata" />
            <Input label="IdP SSO redirect URL (HTTPS)" value={form.samlSsoUrl} onChange={(e) => update("samlSsoUrl", e.target.value)} placeholder="https://idp.example.com/sso" />
            <label className="block text-[13px] text-text-primary">IdP signing certificate (PEM)
              <textarea className="mt-1 min-h-28 w-full rounded-lg border border-border-subtle bg-surface p-3 font-mono text-[12px]" value={form.samlVerificationCertificate ?? ""} onChange={(e) => update("samlVerificationCertificate", e.target.value)} placeholder={query.data.samlCertificateSet ? "Certificate saved — leave blank to retain" : "-----BEGIN CERTIFICATE-----"} />
            </label>
            <p className="text-[12px] text-text-secondary">SP metadata URL (replace placeholder with tenant slug):</p>
            <code className="block overflow-x-auto rounded-lg bg-surface-sunken px-3 py-2 text-[12px]">{metadata}</code>
            <p className="text-[12px] text-text-secondary">IdP must support unsigned AuthnRequests and signed assertions or responses.</p>
          </>}
        </div>
        <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <div className="flex items-center gap-2"><ShieldCheck size={18}/><strong>Tenant authentication policy</strong></div>
          <Input label="Approved employer email domain" value={form.allowedEmailDomain} onChange={(e) => update("allowedEmailDomain", e.target.value)} placeholder="employer.example.com" />
          <p className="text-[12px] text-text-secondary">Only identities with trusted work emails in this exact domain can be linked or provisioned.</p>
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-medium text-[14px]">Allow native username/password login</p><p className="text-[12px] text-text-secondary">Turn off to enforce SSO only. Controls fallback if the IdP is unavailable.</p></div>
            <Switch checked={form.nativeLoginAllowed} onChange={(v) => update("nativeLoginAllowed", v)} label="Allow native login" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-medium text-[14px]">Just-in-time employee provisioning</p><p className="text-[12px] text-text-secondary">Creates passwordless employee accounts with no clinical permissions. An admin must assign roles.</p></div>
            <Switch checked={form.jitProvisioningEnabled} onChange={(v) => update("jitProvisioningEnabled", v)} label="Enable JIT provisioning" />
          </div>
        </div>
        <div className="flex justify-end"><Button type="submit" icon={<Save size={16}/>} disabled={!dirty} loading={mutation.isPending}>Save SSO configuration</Button></div>
      </form>}
    </div>
  );
}
