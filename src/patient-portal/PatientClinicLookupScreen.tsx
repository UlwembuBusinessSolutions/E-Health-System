import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, HeartPulse } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { getPublicOrganization } from "@/shared/api/publicOrganization";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import "./patient-clinic-lookup.css";

export function PatientClinicLookupScreen() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const lookup = useMutation({
    mutationFn: (tenantSlug: string) => getPublicOrganization(tenantSlug),
    onSuccess: (organization) => navigate(`/org/${encodeURIComponent(organization.slug)}/patient/login`),
    onError: (cause) => setError(
      cause instanceof ApiError && cause.status === 404
        ? "We couldn't find a clinic with that address. Check the clinic slug with your clinic administrator."
        : cause instanceof Error ? cause.message : "We couldn't check that clinic. Please try again.",
    ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(normalized) && !/^[a-z]$/.test(normalized)) {
      setError("Enter the clinic slug using lowercase letters, numbers, and hyphens.");
      return;
    }
    setError("");
    lookup.mutate(normalized);
  };

  return (
    <main className="clinic-lookup">
      <section className="cl-visual">
        <Link to="/" className="cl-brand"><span><HeartPulse size={25} aria-hidden /></span><b>ULWEMBU<small>HEALTHCARE MANAGEMENT SYSTEM</small></b></Link>
        <div className="cl-story">
          <p className="cl-eyebrow">YOUR CARE JOURNEY</p>
          <h1>Your clinic.<br /><em>Your care.</em></h1>
          <p>Find your clinic’s secure patient portal to sign in, book visits, and manage your appointments.</p>
        </div>
        <div className="cl-orbit" aria-hidden />
      </section>
      <section className="cl-main">
        <Link to="/login" className="cl-back"><ArrowLeft size={16} aria-hidden /> Staff and organization sign in</Link>
        <div className="cl-card">
          <span className="cl-icon"><Building2 size={23} aria-hidden /></span>
          <p className="cl-eyebrow">PATIENT PORTAL</p>
          <h2>Find your clinic<span>.</span></h2>
          <p className="cl-intro">Enter the clinic address or slug provided by your clinic. Your email or South African ID is used on the next screen.</p>
          <form onSubmit={submit} noValidate>
            <Input
              label="Clinic slug"
              required
              icon={<Building2 className="size-4" aria-hidden />}
              placeholder="e.g. riverbend-health"
              hint="Ask your clinic administrator if you do not know this."
              autoComplete="organization"
              autoCapitalize="none"
              spellCheck={false}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              error={error || undefined}
            />
            <Button type="submit" size="lg" loading={lookup.isPending} disabled={!slug.trim()} className="cl-submit" icon={!lookup.isPending ? <ArrowRight size={18} aria-hidden /> : undefined}>
              {lookup.isPending ? "Checking clinic…" : "Continue to patient sign in"}
            </Button>
          </form>
          <p className="cl-footnote">This lookup checks the clinic address only. You’ll still sign in with your patient email or South African ID and password.</p>
        </div>
        <footer className="cl-footer">Ulwembu eHealth <span>Secure access to your care</span></footer>
      </section>
    </main>
  );
}
