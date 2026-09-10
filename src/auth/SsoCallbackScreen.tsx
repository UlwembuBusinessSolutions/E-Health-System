import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";
import { completeSamlHandoff, completeSso, SsoUnavailableError } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";

function callbackError(searchParams: URLSearchParams): string | null {
  const providerError = searchParams.get("error");
  if (providerError) {
    const description = searchParams.get("error_description");
    return description
      ? `Your identity provider could not sign you in: ${description}`
      : `Your identity provider could not sign you in (${providerError}).`;
  }
  if (searchParams.get("ssoCode")) return null;
  if (!searchParams.get("code") || !searchParams.get("state")) {
    return "The single sign-on response was incomplete. Start again from your organisation's login page.";
  }
  return null;
}

export function SsoCallbackScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      setError("The organisation could not be identified. Return to the login page and try again.");
      return;
    }
    const invalidResponse = callbackError(searchParams);
    if (invalidResponse) {
      setError(invalidResponse);
      return;
    }

    const completion = searchParams.get("ssoCode")
      ? completeSamlHandoff({ tenantSlug, code: searchParams.get("ssoCode")! })
      : completeSso({
          tenantSlug,
          code: searchParams.get("code")!,
          state: searchParams.get("state")!,
          redirectUri: window.location.origin + window.location.pathname,
        });
    completion
      .then((user) => {
        setUser(user);
        navigate("/app", { replace: true });
      })
      .catch((callbackFailure) => {
        setError(
          callbackFailure instanceof ApiError
            ? callbackFailure.message
            : callbackFailure instanceof SsoUnavailableError
              ? callbackFailure.message
            : "We could not complete single sign-on. Return to the login page and try again.",
        );
      });
  }, [navigate, searchParams, setUser, tenantSlug]);

  return (
    <AuthLayout title={error ? "Sign-in could not be completed" : "Completing sign-in"} tenantSlug={tenantSlug}>
      {error ? (
        <div className="flex flex-col gap-4">
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {error}
          </div>
          <Link
            to={tenantSlug ? `/org/${tenantSlug}/login` : "/login"}
            className="text-center text-[13.5px] font-medium text-brand-600 hover:text-brand-700"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <p className="text-[14px] text-text-secondary">Verifying your identity provider response…</p>
      )}
    </AuthLayout>
  );
}
