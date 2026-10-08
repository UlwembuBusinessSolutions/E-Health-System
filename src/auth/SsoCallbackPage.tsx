import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { establishSsoSession } from "@/shared/api/auth";
import { useAuth } from "./AuthContext";

// Where MicrosoftSsoService.frontendSuccessRedirect() lands the browser
// after a completed Microsoft sign-in — the token/expiresAt pair arrives
// as query params on a full-page redirect, not a fetch response, since
// the whole point of this flow is that the browser (not this app's JS)
// followed Microsoft's own redirect chain. This page's only job is to
// pick that token up, store it the same way a password login does
// (establishSsoSession), and hand off into the normal app shell — nothing
// here is rendered long enough for a real visitor to read twice.
export function SsoCallbackPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const ranOnce = useRef(false);

  const token = params.get("token");

  useEffect(() => {
    if (!tenantSlug || !token || ranOnce.current) return;
    ranOnce.current = true;
    establishSsoSession(tenantSlug, token)
      .then((user) => {
        setUser(user);
        navigate("/app", { replace: true });
      })
      .catch(() => {
        navigate(`/org/${encodeURIComponent(tenantSlug)}/login?ssoError=session_failed`, { replace: true });
      });
  }, [tenantSlug, token, navigate, setUser]);

  if (!tenantSlug) return <Navigate to="/login" replace />;
  if (!token) return <Navigate to={`/org/${encodeURIComponent(tenantSlug)}/login?ssoError=missing_token`} replace />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface">
      <HeartPulse className="size-8 animate-pulse text-brand-500" aria-hidden />
      <p className="text-[14px] text-text-secondary">Signing you in…</p>
    </div>
  );
}
