import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ImagePlus, Palette, RotateCcw, Save } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { getOrganizationSelf, updateOrganizationBranding, uploadOrganizationLogo } from "@/shared/api/organization";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function BrandingSettingsSection() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const organization = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const [color, setColor] = useState("");
  const [shortName, setShortName] = useState("");
  const [fileError, setFileError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!organization.data) return;
    setColor(organization.data.primaryColor ?? "");
    setShortName(organization.data.shortName ?? "");
  }, [organization.data?.primaryColor, organization.data?.shortName]);

  const saveMutation = useMutation({
    mutationFn: () => updateOrganizationBranding({ primaryColor: color || null, shortName: shortName.trim() || null }),
    onSuccess: (branding) => {
      queryClient.setQueryData(["organization", "self"], (current: typeof organization.data) => current ? { ...current, ...branding } : current);
      setSaved(true);
    },
  });
  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadOrganizationLogo(file),
    onSuccess: ({ logoUrl }) => {
      queryClient.setQueryData(["organization", "self"], (current: typeof organization.data) => current ? { ...current, logoUrl } : current);
      setFileError("");
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (error) => setFileError(error instanceof ApiError ? error.message : "Logo upload failed. Try again."),
  });
  function upload(file?: File) {
    setFileError("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) { setFileError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > MAX_LOGO_BYTES) { setFileError("Logo images must be 5 MB or smaller."); return; }
    logoMutation.mutate(file);
  }

  if (organization.isLoading) return <p className="text-[14px] text-text-secondary">Loading branding…</p>;
  if (organization.isError || !organization.data) return <div role="alert" className="text-[14px] text-danger-600">Branding settings could not be loaded. <Button variant="secondary" onClick={() => void organization.refetch()}>Retry</Button></div>;
  const error = saveMutation.error;
  return <div className="flex flex-col gap-5">
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3"><Palette className="mt-0.5 size-5 text-brand-600" aria-hidden /><div><h3 className="font-semibold text-text-primary">Organization identity</h3><p className="mt-1 text-[13px] text-text-secondary">Your logo and primary color appear across staff and patient experiences. Leave the color empty to use the platform default.</p></div></div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-sunken text-text-secondary">{organization.data.logoUrl ? <img src={organization.data.logoUrl} alt={`${organization.data.displayName} logo`} className="size-full object-contain" /> : <ImagePlus className="size-6" aria-hidden />}</div>
          <div><p className="text-[14px] font-medium text-text-primary">Organization logo</p><p className="mt-1 text-[12px] text-text-secondary">JPEG, PNG, or WebP · up to 5 MB</p><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => upload(event.target.files?.[0])} /><Button type="button" variant="secondary" className="mt-2" loading={logoMutation.isPending} onClick={() => inputRef.current?.click()}>{organization.data.logoUrl ? "Replace logo" : "Upload logo"}</Button></div>
        </div>
        {fileError && <p role="alert" className="text-[13px] text-danger-600">{fileError}</p>}
        <label className="flex max-w-sm flex-col gap-1.5 text-[13px] font-medium text-text-primary">Organization short name <input maxLength={40} value={shortName} onChange={event => { setShortName(event.target.value); setSaved(false); }} placeholder={organization.data.displayName} className="h-10 rounded-lg border border-border-subtle bg-surface px-3 text-[14px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" /><span className="font-normal text-text-secondary">Used in compact navigation and identity labels. Up to 40 characters.</span></label>
        <label className="flex max-w-sm flex-col gap-1.5 text-[13px] font-medium text-text-primary">Primary color <span className="flex items-center gap-3"><input aria-label="Choose primary color" type="color" value={/^#[\da-f]{6}$/i.test(color) ? color : "#1F6F63"} onChange={event => { setColor(event.target.value.toUpperCase()); setSaved(false); }} className="size-11 cursor-pointer rounded border-0 bg-transparent p-0" /><input aria-label="Primary color hex value" value={color} onChange={event => { setColor(event.target.value); setSaved(false); }} placeholder="#1F6F63" maxLength={7} className="h-10 w-32 rounded-lg border border-border-subtle bg-surface px-3 font-mono text-[14px] uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" /><span className="size-7 rounded-full border border-border-subtle" style={{ backgroundColor: /^#[\da-f]{6}$/i.test(color) ? color : "#1F6F63" }} /></span><span className="font-normal text-text-secondary">Enter a six-digit hex color.</span></label>
        {error && <p role="alert" className="text-[13px] text-danger-600">{error instanceof ApiError ? error.message : "Branding settings could not be saved."}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-[13px] text-success-600"><CheckCircle2 className="size-4" aria-hidden />Branding saved and applied.</p>}
        <div className="flex flex-wrap gap-2"><Button type="button" loading={saveMutation.isPending} onClick={() => { setSaved(false); saveMutation.mutate(); }}><Save className="size-4" aria-hidden />Save branding</Button><Button type="button" variant="secondary" onClick={() => { setColor(""); setShortName(""); setSaved(false); }}><RotateCcw className="size-4" aria-hidden />Use platform defaults</Button></div>
      </div>
    </Card>
  </div>;
}
