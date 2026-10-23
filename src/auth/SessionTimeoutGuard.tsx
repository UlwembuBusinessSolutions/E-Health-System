import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthContext";
import { getTenantSlug, getTenantToken } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { continueSession, endSession, getSessionStatus, recordSessionActivity, type SessionStatus } from "@/shared/api/session";
import { Button } from "@/shared/components/Button";
import "./SessionTimeoutGuard.css";

const ACTIVITY_INTERVAL_MS = 30_000;

function tokenExpiry(): number {
  try {
    const payload = getTenantToken()?.split(".")[1];
    if (!payload) return Infinity;
    const exp = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))).exp;
    return typeof exp === "number" ? exp * 1000 : Infinity;
  } catch { return Infinity; }
}

export function SessionTimeoutGuard({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const lifecycle = useRef({ warning: false, ended: false, busy: false });
  const timing = useRef({ idleEnd: Date.now() + 15 * 60_000, tokenEnd: tokenExpiry(), warningMs: 60_000 });
  const pendingActivity = useRef(false);
  const lastActivitySent = useRef(0);
  const heartbeatPending = useRef(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controls = useRef({ signOut: () => {}, update: (_status: SessionStatus) => {}, tick: () => {} });

  useEffect(() => {
    let mounted = true;
    lifecycle.current = { warning: false, ended: false, busy: false };

    function signOut() {
      if (lifecycle.current.ended) return;
      lifecycle.current.ended = true;
      // Start the revocation request before clearing the tab's token.
      void endSession().catch(() => {});
      const slug = getTenantSlug();
      void queryClient.cancelQueries();
      queryClient.clear();
      navigate(slug ? `/org/${encodeURIComponent(slug)}/login` : "/login", { replace: true });
      logout();
    }

    function update(status: SessionStatus) {
      const serverNow = Date.parse(status.serverTime);
      const idleEnd = Date.parse(status.idleExpiresAt);
      const tokenEnd = Date.parse(status.expiresAt);
      if (![serverNow, idleEnd, tokenEnd].every(Number.isFinite) || !(status.warningSeconds > 0))
        throw new Error("The session status could not be verified. Please try again.");
      const received = Date.now();
      timing.current = {
        idleEnd: received + idleEnd - serverNow,
        tokenEnd: received + tokenEnd - serverNow,
        warningMs: status.warningSeconds * 1000,
      };
    }

    function tick() {
      if (!mounted || lifecycle.current.ended) return;
      const remaining = Math.min(timing.current.idleEnd, timing.current.tokenEnd) - Date.now();
      if (remaining <= 0) { signOut(); return; }
      if (remaining <= timing.current.warningMs || lifecycle.current.warning) {
        lifecycle.current.warning = true;
        setSeconds(Math.ceil(remaining / 1000));
      }
    }

    async function flushActivity() {
      if (lifecycle.current.warning || lifecycle.current.ended || !pendingActivity.current || heartbeatPending.current
          || document.visibilityState !== "visible" || Date.now() - lastActivitySent.current < ACTIVITY_INTERVAL_MS) return;
      heartbeatPending.current = true;
      pendingActivity.current = false;
      lastActivitySent.current = Date.now();
      try {
        const status = await recordSessionActivity();
        if (mounted && !lifecycle.current.ended && !lifecycle.current.warning) update(status);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 419)) signOut();
        // Keep the last verified deadline when offline; don't silently extend it.
      } finally { heartbeatPending.current = false; }
    }

    function activity(event: Event) {
      if (!event.isTrusted || lifecycle.current.warning || lifecycle.current.ended) return;
      tick();
      if (lifecycle.current.warning || lifecycle.current.ended) return;
      pendingActivity.current = true;
      void flushActivity();
    }
    function onVisible() { tick(); }
    controls.current = { signOut, update, tick };
    void getSessionStatus().then(status => {
      if (mounted && !lifecycle.current.ended) { update(status); tick(); }
    }).catch(e => {
      if (mounted && e instanceof ApiError && (e.status === 401 || e.status === 419)) signOut();
    });

    const activityEvents = ["pointerdown", "keydown", "input", "touchstart", "wheel"];
    activityEvents.forEach(type => window.addEventListener(type, activity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("ulwembu:session-ended", signOut);
    const interval = window.setInterval(() => { tick(); void flushActivity(); }, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
      activityEvents.forEach(type => window.removeEventListener(type, activity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("ulwembu:session-ended", signOut);
    };
  }, [logout, navigate, queryClient]);

  const open = seconds !== null;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    continueButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  async function staySignedIn() {
    if (lifecycle.current.busy || lifecycle.current.ended) return;
    lifecycle.current.busy = true;
    setBusy(true); setError("");
    try {
      const result = await continueSession();
      if (lifecycle.current.ended) return;
      controls.current.update(result);
      lifecycle.current.warning = false;
      pendingActivity.current = false;
      lastActivitySent.current = Date.now();
      setSeconds(null);
      controls.current.tick();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 419)) controls.current.signOut();
      else if (!lifecycle.current.ended) setError("We couldn't continue your session. Check your connection and try again before the timer ends.");
    } finally { lifecycle.current.busy = false; setBusy(false); }
  }

  const countdown = `${Math.floor((seconds ?? 0) / 60)}:${String((seconds ?? 0) % 60).padStart(2, "0")}`;
  return <>{children}{open && createPortal(
    <dialog ref={dialog} className="session-warning" aria-labelledby="session-warning-title" aria-describedby="session-warning-description" onCancel={event => event.preventDefault()}>
      <div className="session-warning-content">
        <span className="session-warning-icon"><Clock3 size={27} aria-hidden /></span>
        <p className="session-warning-eyebrow">Session reminder</p>
        <h2 id="session-warning-title">Still working?</h2>
        <p id="session-warning-description">Your session is about to end. Continue to stay signed in and keep working on this page.</p>
        <div className="session-warning-countdown"><span>Automatic log out in</span><strong role="timer" aria-label={`${seconds} seconds until automatic log out`}>{countdown}</strong></div>
        {error && <p className="session-warning-error" role="alert">{error}</p>}
        <div className="session-warning-actions"><Button type="button" variant="secondary" icon={<LogOut size={16} aria-hidden />} onClick={() => controls.current.signOut()}>Log out</Button><Button ref={continueButton} type="button" loading={busy} onClick={() => void staySignedIn()}>Continue session</Button></div>
        <p className="session-warning-footer"><ShieldCheck size={14} aria-hidden /> Helping protect patient information on shared devices.</p>
      </div>
    </dialog>, document.body)}</>;
}
