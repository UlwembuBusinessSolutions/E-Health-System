import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import "./auth-fields.css";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  // Present once a login/reset screen is reached via /org/:tenantSlug/... —
  // shown as a confirmation chip so signing in against the wrong
  // organisation is obvious before typing a password, not just implicit in
  // the URL bar. Absent on screens with no tenant context yet (the
  // FindOrganizationScreen gate itself never renders this layout with one).
  tenantSlug?: string;
}

// Full-bleed photographic hero, replacing the old dot-pattern brand rail —
// deliberately closer to the eHealth Prototype's own login screen
// (login-background.jpg, logo top-left, hero copy bottom-left, a card
// floated over the lighter side of the gradient) now that this app has a
// real asset to use instead of an abstract pattern. Unlike the old version,
// this no longer reads useTenant() — pre-login there's no authenticated
// call to fetch real per-tenant branding from yet (OrganizationBrandingService
// requires a tenant JWT), so the hero stays Ulwembu's own identity and
// tenantSlug is shown as plain confirmation text instead of a re-themed
// card.
export function AuthLayout({ title, subtitle, children, footer, tenantSlug }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/login-background.jpg)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,30,58,.80) 0%, rgba(4,30,58,.58) 32%, rgba(4,30,58,.22) 56%, rgba(4,30,58,.14) 100%), linear-gradient(180deg, rgba(7,58,112,.16), rgba(7,58,112,.28))",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-72 -right-64 hidden size-[760px] rounded-full border border-white/10 lg:block"
        style={{ boxShadow: "0 0 0 70px rgba(255,255,255,.02), 0 0 0 140px rgba(255,255,255,.015)" }}
        aria-hidden
      />

      <div className="absolute left-8 top-8 z-10 hidden rounded-xl bg-white/95 px-3.5 py-2.5 shadow-lg lg:block">
        <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-9 w-auto object-contain" />
      </div>

      <div className="absolute bottom-14 left-8 z-10 hidden max-w-md lg:block">
        <h1 className="text-[30px] font-semibold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.35)]">
          One platform for every facility you run.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.3)]">
          Modular, tenant-aware healthcare operations — isolated per client and audited end to end.
        </p>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <div className="rounded-2xl border border-white/50 bg-white/98 p-7 shadow-2xl backdrop-blur-sm sm:p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
              <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-10 w-auto object-contain" />
            </div>

            <div className="mb-1">
              <h2 className="text-[22px] font-semibold tracking-tight text-text-primary">{title}</h2>
              {subtitle && <p className="mt-1 text-[14px] text-text-secondary">{subtitle}</p>}
            </div>

            {tenantSlug && (
              <div className="mt-4 mb-5 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-[13px] text-text-primary">
                  <Building2 className="size-3.5 shrink-0 text-text-secondary" aria-hidden />
                  Signing in to <span className="font-mono font-semibold">{tenantSlug}</span>
                </span>
                <Link to="/login" className="shrink-0 text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                  Not you?
                </Link>
              </div>
            )}
            {!tenantSlug && <div className="mb-6" />}

            {children}

            {footer && <div className="mt-6 text-center text-[13.5px] text-text-secondary">{footer}</div>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
