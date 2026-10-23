import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, WifiOff } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";
import { useConnectionStatus } from "./useConnectionStatus";

// Tells the person when the device has lost the connection, and when it is
// back. Going offline opens a dialog (the one moment they must not miss);
// dismissing it leaves a bar across the top so it stays obvious that anything
// they change is not being saved. Coming back shows a green confirmation and
// refreshes what is on screen, so nobody keeps reading stale numbers.
export function ConnectionMonitor() {
  const queryClient = useQueryClient();
  const { status, checking, checkNow, dismissRestored } = useConnectionStatus(() => {
    void queryClient.invalidateQueries();
  });
  const [dialogDismissed, setDialogDismissed] = useState(false);

  // A new outage starts with the dialog showing again.
  useEffect(() => {
    if (status === "offline") setDialogDismissed(false);
  }, [status]);

  const offline = status === "offline";

  return (
    <>
      <Modal
        open={offline && !dialogDismissed}
        size="sm"
        title="You're offline"
        description="The connection to the server was lost."
        onClose={() => setDialogDismissed(true)}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialogDismissed(true)}>
              Continue anyway
            </Button>
            <Button loading={checking} onClick={() => void checkNow()}>
              Try again
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-amber-50 text-amber-600">
            <WifiOff className="size-7" aria-hidden />
          </span>
          <p className="text-[14px] leading-relaxed text-text-secondary">
            Nothing you change can be saved until you are back online. What is on the screen may be out of date. We will
            keep trying, and tell you the moment the connection returns.
          </p>
        </div>
      </Modal>

      <div aria-live="polite" role="status" className="fixed inset-x-0 top-0 z-[60]">
        {offline && dialogDismissed && (
          <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-[13.5px] font-medium text-white">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <span>You&apos;re offline. Changes can&apos;t be saved.</span>
            <button
              type="button"
              onClick={() => void checkNow()}
              className="rounded-md bg-white/20 px-2.5 py-1 text-[12.5px] font-semibold hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {checking ? "Checking…" : "Try again"}
            </button>
          </div>
        )}
        {status === "restored" && (
          <div className="flex items-center justify-center gap-3 bg-success-500 px-4 py-2 text-[13.5px] font-medium text-white">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            <span>You&apos;re back online. Everything on screen has been refreshed.</span>
            <button
              type="button"
              onClick={dismissRestored}
              className="rounded-md bg-white/20 px-2.5 py-1 text-[12.5px] font-semibold hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </>
  );
}
