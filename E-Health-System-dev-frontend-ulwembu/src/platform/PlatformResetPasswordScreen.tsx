import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { confirmPlatformPasswordReset } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";

export function PlatformResetPasswordScreen() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => confirmPlatformPasswordReset(email, token, password),
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Something went wrong. Try again."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-10">
      <Card className="w-full max-w-sm p-8">
        {mutation.isSuccess ? (
          <div className="flex flex-col gap-3 text-center">
            <h1 className="text-[18px] font-semibold text-text-primary">Password reset complete</h1>
            <p className="text-[13.5px] text-text-secondary">Your existing sessions have been signed out.</p>
            <Link to="/platform/login" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Sign in again</Link>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setError(null); mutation.mutate(); }} className="flex flex-col gap-4">
            <div>
              <h1 className="text-[18px] font-semibold text-text-primary">Choose a new password</h1>
              <p className="mt-1 text-[13.5px] text-text-secondary">This reset link can only be used once.</p>
            </div>
            {error && <p role="alert" className="text-[13.5px] text-danger-600">{error}</p>}
            <PasswordInput label="New password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button type="submit" loading={mutation.isPending} disabled={!token} className="w-full">Reset password</Button>
            <Link to="/platform/forgot-password" className="text-center text-[13px] font-medium text-brand-600 hover:text-brand-700">Request a new link</Link>
          </form>
        )}
      </Card>
    </div>
  );
}
