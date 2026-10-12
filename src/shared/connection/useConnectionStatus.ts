import { useCallback, useEffect, useRef, useState } from "react";

// "online": reachable. "offline": the browser says the network is down or the
// server cannot be reached. "restored": it was offline a moment ago and is
// back, held for a few seconds so the person can see it.
export type ConnectionStatus = "online" | "offline" | "restored";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const PROBE_TIMEOUT_MS = 5000;
const RETRY_EVERY_MS = 5000;
const RESTORED_SHOWN_MS = 4000;

// The browser's online/offline events are quick but not always right (a
// network can be "connected" with no internet), so before saying "back online"
// we ask the server. Any answer at all, even an error page, proves the way is
// open; only a network failure or a timeout means it is not.
async function serverIsReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE}/`, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Tracks whether the device can reach the server, and calls `onRestored` when it comes back. */
export function useConnectionStatus(onRestored?: () => void) {
  const [status, setStatus] = useState<ConnectionStatus>(() => (navigator.onLine ? "online" : "offline"));
  const [checking, setChecking] = useState(false);
  const statusRef = useRef(status);
  const restoredCallback = useRef(onRestored);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    restoredCallback.current = onRestored;
  }, [onRestored]);

  const goOffline = useCallback(() => setStatus("offline"), []);

  // Used by the "Try again" button and the automatic retry while offline.
  const checkNow = useCallback(async () => {
    setChecking(true);
    const reachable = await serverIsReachable();
    setChecking(false);
    if (reachable && statusRef.current === "offline") {
      setStatus("restored");
      restoredCallback.current?.();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", checkNow);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", checkNow);
    };
  }, [goOffline, checkNow]);

  // While offline keep asking: the "online" event can be missed or arrive early.
  useEffect(() => {
    if (status !== "offline") return;
    const timer = window.setInterval(() => void checkNow(), RETRY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [status, checkNow]);

  useEffect(() => {
    if (status !== "restored") return;
    const timer = window.setTimeout(() => setStatus("online"), RESTORED_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const dismissRestored = useCallback(() => setStatus("online"), []);

  return { status, checking, checkNow, dismissRestored };
}
