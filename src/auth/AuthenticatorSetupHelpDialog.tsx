import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

export function AuthenticatorSetupHelpDialog({
  setupKey,
  onClose,
}: {
  setupKey: string;
  onClose: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const copySetupKey = async () => {
    try {
      await navigator.clipboard.writeText(setupKey);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="authenticator-help-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-md p-6 shadow-xl">
        <h2 id="authenticator-help-title" className="text-[16px] font-semibold text-text-primary">
          Set up an authenticator app
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-text-secondary">
          <li>
            Install an authenticator app, such as Google Authenticator or Microsoft Authenticator, from your device's
            official app store.
          </li>
          <li>In the app, choose to add an account and select manual key entry.</li>
          <li>Enter this setup key in the app, then enter its current 6-digit code on this page to finish setup.</li>
        </ol>
        <p className="mt-4 text-[12px] font-medium text-text-secondary">Setup key</p>
        <code className="mt-1 block select-all break-all rounded-lg bg-surface-sunken px-3 py-2.5 font-mono text-[13px] text-text-primary">
          {setupKey}
        </code>
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void copySetupKey()}>
            Copy setup key
          </Button>
          {copyStatus === "copied" && <span role="status" className="text-[12px] text-success-600">Setup key copied.</span>}
          {copyStatus === "error" && (
            <span role="alert" className="text-[12px] text-danger-600">
              Could not copy. Select the key above and copy it manually.
            </span>
          )}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
          Keep the setup key private.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
