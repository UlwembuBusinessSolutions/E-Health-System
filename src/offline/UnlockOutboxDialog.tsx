import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PasswordInput } from "@/shared/components/PasswordInput";

// Same modal shell as the rest of the app (fixed overlay, Card panel).
export function UnlockOutboxDialog({
  creating, supported, onSubmit, onCancel,
}: {
  creating: boolean; // no vault yet (e.g. a first SSO sign-in) -> choose a passphrase
  supported: boolean;
  onSubmit: (secret: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (creating && secret.length < 8) return setError("Use at least 8 characters.");
    if (creating && secret !== confirm) return setError("The two entries don't match.");
    setBusy(true);
    const ok = await onSubmit(secret).catch(() => false);
    setBusy(false);
    if (!ok) setError("That isn't right. Use the password these records were saved with.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Lock className="size-5" aria-hidden /></span>
          <div>
            <h2 id="unlock-title" className="text-[16px] font-semibold text-text-primary">
              {creating ? "Create an offline passphrase" : "Unlock offline storage"}
            </h2>
            <p className="text-[13px] text-text-secondary">
              {creating
                ? "Records saved on this device are encrypted with it."
                : "Enter your password to save or sync records on this device."}
            </p>
          </div>
        </div>
        {!supported ? (
          <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            Offline storage needs a secure (HTTPS) connection and isn't available in this browser context.
          </p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
            <PasswordInput label={creating ? "Passphrase" : "Password"} required autoFocus autoComplete={creating ? "new-password" : "current-password"} value={secret} onChange={(e) => setSecret(e.target.value)} />
            {creating && <PasswordInput label="Confirm passphrase" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            {error && <p role="alert" className="text-[13px] text-danger-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
              <Button type="submit" loading={busy}>{creating ? "Create" : "Unlock"}</Button>
            </div>
          </form>
        )}
        {!supported && <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={onCancel}>Close</Button></div>}
      </Card>
    </div>
  );
}