import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  confirmMfaSetup,
  disableMfa,
  getMfaStatus,
  regenerateMfaRecoveryCodes,
  startMfaSetup,
  type MfaEnrolmentSecret,
} from "@/shared/api/mfa";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";

export function SecurityPage() {
  const queryClient = useQueryClient();
  const [secret, setSecret] = useState<MfaEnrolmentSecret | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const statusQuery = useQuery({ queryKey: ["auth", "mfa-status"], queryFn: getMfaStatus });

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ["auth", "mfa-status"] });
  const setup = useMutation({
    mutationFn: startMfaSetup,
    onSuccess: (result) => { setSecret(result); setCodes(null); setError(null); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't start MFA setup. Please try again."),
  });
  const confirm = useMutation({
    mutationFn: () => confirmMfaSetup(code),
    onSuccess: (result) => {
      setCodes(result);
      setSecret(null);
      setCode("");
      setError(null);
      void refreshStatus();
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't verify that code. Please try again."),
  });
  const regenerate = useMutation({
    mutationFn: () => regenerateMfaRecoveryCodes(code),
    onSuccess: (result) => {
      setCodes(result);
      setCode("");
      setError(null);
      void refreshStatus();
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't regenerate recovery codes. Please try again."),
  });
  const disable = useMutation({
    mutationFn: () => disableMfa(password, code),
    onSuccess: () => {
      setPassword("");
      setCode("");
      setCodes(null);
      setError(null);
      void refreshStatus();
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't turn off MFA. Please try again."),
  });

  if (statusQuery.isLoading) return <p className="text-[14px] text-text-secondary">Loading security settings…</p>;
  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="flex flex-col items-start gap-3 text-[14px] text-text-secondary">
        <p role="alert">Security settings could not be loaded.</p>
        <Button type="button" variant="secondary" loading={statusQuery.isFetching} onClick={() => void statusQuery.refetch()}>Retry</Button>
      </div>
    );
  }
  const status = statusQuery.data;
  const pending = setup.isPending || confirm.isPending || regenerate.isPending || disable.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-text-primary">Two-step verification</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              {status.enrolled
                ? "An authenticator code is required whenever you sign in."
                : status.required
                  ? "MFA is required by your role. Set it up before your next sign-in."
                  : "Add an authenticator app as an extra layer of protection for your account."}
            </p>
            <p className="mt-2 text-[13px] font-medium text-text-primary">
              {status.enrolled ? `Recovery codes remaining: ${status.recoveryCodesRemaining}` : "MFA is not set up"}
            </p>
          </div>
        </div>
      </Card>

      {error && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{error}</div>}

      {!status.enrolled && !secret && (
        <Button type="button" loading={setup.isPending} onClick={() => setup.mutate()} icon={<KeyRound size={16} aria-hidden />}>
          Set up authenticator
        </Button>
      )}

      {secret && (
        <Card className="flex flex-col gap-4 p-5 sm:p-6" aria-busy={pending}>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Add your authenticator</h3>
            <p className="mt-1 text-[13px] text-text-secondary">In your authenticator app, add an account manually and enter this setup key.</p>
            <code className="mt-3 block break-all rounded-lg bg-surface-sunken px-3 py-2.5 font-mono text-[13px] text-text-primary">{secret.secret}</code>
            <a href={secret.otpauthUri} className="mt-3 inline-block text-[13px] font-medium text-brand-600 underline">Open in an authenticator app</a>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); setError(null); confirm.mutate(); }} className="flex flex-col gap-4">
            <Input label="6-digit verification code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
            <div className="flex gap-3">
              <Button type="submit" loading={confirm.isPending} disabled={!/^\d{6}$/.test(code)}>Confirm setup</Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => { setSecret(null); setCode(""); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {codes && (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Save these recovery codes</h3>
            <p className="mt-1 text-[13px] text-text-secondary">Each code can only be used once. They will not be shown again after you leave this page.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface-raised p-4">
            {codes.map((item) => <code key={item} className="rounded-md bg-surface-sunken px-2 py-1.5 text-center font-mono text-[13px] text-text-primary">{item}</code>)}
          </div>
          <CopyCodesButton codes={codes} />
          <Button type="button" variant="secondary" onClick={() => setCodes(null)}>I've saved these codes</Button>
        </Card>
      )}

      {status.enrolled && !codes && (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-text-primary">Manage recovery codes</h3>
          <p className="text-[13px] text-text-secondary">Regenerating codes invalidates all previously issued recovery codes.</p>
          <Input label="Current authenticator code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
          <Button type="button" variant="secondary" loading={regenerate.isPending} disabled={!/^\d{6}$/.test(code)} onClick={() => { setError(null); regenerate.mutate(); }}>
            Regenerate recovery codes
          </Button>
        </Card>
      )}

      {status.enrolled && status.canDisable && !codes && (
        <Card className="flex flex-col gap-4 border-danger-500/25 p-5 sm:p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Turn off MFA</h3>
            <p className="mt-1 text-[13px] text-text-secondary">Confirm your password and current authenticator code. Your role policy may still require MFA at sign-in.</p>
          </div>
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input label="Current authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
          <Button type="button" variant="danger" loading={disable.isPending} disabled={!password || !/^\d{6}$/.test(code)} onClick={() => { setError(null); disable.mutate(); }}>Turn off MFA</Button>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-[14px] font-semibold text-text-primary">If you lose your authenticator</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-text-secondary">
          <li>Sign in with one of your unused recovery codes.</li>
          <li>If you no longer have a recovery code, ask an organization administrator to reset your MFA. You will need to set it up again if your role requires it.</li>
          <li>If you are the only administrator and are locked out, contact your platform support operator for an identity-verified reset.</li>
        </ol>
      </Card>
    </div>
  );
}

function CopyCodesButton({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button type="button" variant="secondary" onClick={() => void copy()} icon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}>
      {copied ? "Recovery codes copied" : "Copy recovery codes"}
    </Button>
  );
}
