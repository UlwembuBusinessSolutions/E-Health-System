import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ClipboardList,
  HeartPulse,
  LockKeyhole,
  Pause,
  Pill,
  Play,
  Plus,
  Stethoscope,
} from "lucide-react";
import { getPublicOrganization } from "@/shared/api/publicOrganization";
import "./StaffLoginLayout.css";

export function StaffLoginLayout({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const organization = useQuery({
    queryKey: ["public-organization", tenantSlug],
    queryFn: () => getPublicOrganization(tenantSlug),
    retry: false,
    staleTime: 60000,
  });
  const org = organization.data;
  const base = `/org/${encodeURIComponent(tenantSlug)}`;
  const motionPaused = paused || !!reducedMotion;

  return (
    <div
      className="staff-login"
      data-motion={motionPaused ? "paused" : "running"}
    >
      <aside className="sl-story" aria-label="Connected healthcare">
        <Link to={base} className="sl-brand">
          <span>
            <HeartPulse size={24} strokeWidth={1.7} aria-hidden />
          </span>
          <div>
            <strong>
              Ulwembu<span>eHealth</span>
            </strong>
            <small>CONNECTED CARE. HUMAN FIRST.</small>
          </div>
        </Link>
        <div className="sl-story-body">
          <p className="sl-eyebrow">
            <span /> BUILT AROUND BETTER CARE
          </p>
          <h2>
            More connected.
            <br />
            <em>Better care.</em>
          </h2>
          <p className="sl-story-description">
            Less between you and your patients.
            <br />
            Bring your people, records and care together.
          </p>
          <CareIllustration />
          <div className="sl-story-caption">
            <span className="sl-caption-line" />
            <p>
              From the first visit to the next step.
              <br />
              <strong>One connected care journey.</strong>
            </p>
          </div>
        </div>
        <div className="sl-story-bottom">
          <span>Made for the people who care.</span>
          <button
            type="button"
            aria-label={
              motionPaused
                ? "Play healthcare animation"
                : "Pause healthcare animation"
            }
            aria-pressed={motionPaused}
            disabled={!!reducedMotion}
            onClick={() => setPaused((value) => !value)}
          >
            {motionPaused ? (
              <Play size={12} aria-hidden />
            ) : (
              <Pause size={12} aria-hidden />
            )}
            {reducedMotion
              ? "Reduced motion"
              : motionPaused
                ? "Play animation"
                : "Pause animation"}
          </button>
        </div>
      </aside>

      <main className="sl-main">
        <nav className="sl-topbar" aria-label="Clinic navigation">
          <Link to={base}>
            <ArrowLeft size={14} aria-hidden /> Back to clinic
          </Link>
          <span>
            <Stethoscope size={13} aria-hidden /> Staff workspace
          </span>
        </nav>
        <div className="sl-form-area">
          <div className="sl-form-container">
            <span className="sl-welcome-icon" aria-hidden>
              <Stethoscope size={25} strokeWidth={1.5} />
            </span>
            <p className="sl-form-eyebrow">YOUR WORKDAY STARTS HERE</p>
            <h1>Welcome back.</h1>
            <p className="sl-form-description">
              Sign in to your clinic workspace.
            </p>
            <div className="sl-clinic">
              <span className="sl-clinic-icon">
                <ClinicLogo
                  key={org?.logoUrl ?? "fallback"}
                  url={org?.logoUrl}
                />
              </span>
              <div>
                <span>Signing in to</span>
                <strong>{org?.displayName ?? tenantSlug}</strong>
                <small>{tenantSlug}</small>
              </div>
              <Link to="/login">
                Change<span className="sr-only"> organization</span>
                <ArrowUpRight size={12} aria-hidden />
              </Link>
            </div>
            {children}
            <div className="sl-account-help">
              <span>Need a staff account?</span>
              <p>Contact your facility administrator to get started.</p>
            </div>
            <div className="sl-patient-link">
              <span>Here as a patient?</span>
              <Link to={`${base}/patient/login`}>
                Go to patient sign in <ArrowUpRight size={13} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        <footer className="sl-footer">
          <span>
            <LockKeyhole size={12} aria-hidden /> For authorized healthcare
            staff
          </span>
          <span>Powered by Ulwembu</span>
        </footer>
      </main>
    </div>
  );
}

function ClinicLogo({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img src={url} alt="" onError={() => setFailed(true)} />
  ) : (
    <Building2 size={20} aria-hidden />
  );
}

function CareIllustration() {
  return (
    <div className="sl-care-art" aria-hidden="true">
      <div className="sl-orbit sl-orbit-outer" />
      <div className="sl-orbit sl-orbit-inner" />
      <svg className="sl-connections" viewBox="0 0 520 350" fill="none">
        <path
          d="M120 103 C180 103 170 167 260 167 S330 95 425 95 M260 167 C260 235 350 257 399 257"
          stroke="rgba(173,225,204,.24)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <circle
          className="sl-connection-dot"
          cx="183"
          cy="126"
          r="3"
          fill="#a0e6c0"
        />
        <circle
          className="sl-connection-dot sl-delay"
          cx="344"
          cy="128"
          r="3"
          fill="#a0e6c0"
        />
      </svg>
      <div className="sl-core">
        <div className="sl-core-ring" />
        <div className="sl-core-face">
          <Plus size={56} strokeWidth={2.8} />
          <span>CARE, CONNECTED</span>
        </div>
      </div>
      <div className="sl-care-node sl-records">
        <span className="sl-node-icon">
          <ClipboardList size={18} />
        </span>
        <div>
          <strong>Patient records</strong>
          <span>A clearer picture</span>
        </div>
        <span className="sl-node-dot" />
      </div>
      <div className="sl-care-node sl-consultations">
        <span className="sl-node-icon">
          <Stethoscope size={19} />
        </span>
        <div>
          <strong>Consultations</strong>
          <span>Care with context</span>
        </div>
      </div>
      <div className="sl-care-node sl-pharmacy">
        <span className="sl-node-icon">
          <Pill size={18} />
        </span>
        <div>
          <strong>Pharmacy</strong>
          <span>The next step in care</span>
        </div>
      </div>
      <div className="sl-heartbeat">
        <div>
          <span>
            <HeartPulse size={14} /> At the heart of it all
          </span>
          <span className="sl-heartbeat-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
        <svg viewBox="0 0 250 55" fill="none">
          <path
            d="M0 31 H42 L50 23 L58 31 H78 L88 42 L100 7 L113 49 L125 25 L134 31 H161 L169 22 L179 31 H250"
            stroke="rgba(167,222,196,.15)"
            strokeWidth="1.7"
          />
          <path
            className="sl-ecg"
            pathLength="100"
            d="M0 31 H42 L50 23 L58 31 H78 L88 42 L100 7 L113 49 L125 25 L134 31 H161 L169 22 L179 31 H250"
            stroke="#b0ebce"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        <p>People at the centre. Always.</p>
      </div>
    </div>
  );
}
