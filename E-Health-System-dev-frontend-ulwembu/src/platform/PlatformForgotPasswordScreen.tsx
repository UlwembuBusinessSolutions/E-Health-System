import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { requestPlatformPasswordReset } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";

export function PlatformForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => requestPlatformPasswordReset(email),
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Something went wrong. Try again."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-10">
      <Card className="w-full max-w-sm p-8">
        {mutation.isSuccess ? (
          <div className="flex flex-col gap-3 text-center">
            <h1 className="text-[18px] font-semibold text-text-primary">Check your email</h1>
            <p className="text-[13.5px] text-text-secondary">If the address is verified, a reset link is on its way.</p>
            <Link to="/platform/login" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setError(null); mutation.mutate(); }} className="flex flex-col gap-4">
            <div>
              <h1 className="text-[18px] font-semibold text-text-primary">Reset platform password</h1>
              <p className="mt-1 text-[13.5px] text-text-secondary">Enter your verified platform email address.</p>
            </div>
            {error && <p role="alert" className="text-[13.5px] text-danger-600">{error}</p>}
            <Input label="Email" required type="email" icon={<Mail className="size-4" aria-hidden />} value={email} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" loading={mutation.isPending} className="w-full">Email reset link</Button>
            <Link to="/platform/login" className="text-center text-[13px] font-medium text-brand-600 hover:text-brand-700">Back to sign in</Link>
          </form>
        )}
      </Card>
    </div>
  );
}
