import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug, getTenantToken } from "@/shared/api/auth";
import { ApiError, apiOrigin } from "@/shared/api/client";
import type { RegisterPatientPayload } from "@/shared/api/patients";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { createVault, isUnlocked, isVaultSupported, lockVault, onVaultChange, unlockVault, vaultExists } from "./vault";
import { enqueue, listEntries, removeEntry, type OutboxEntry } from "./outbox";
import { loadOfflineIdentity } from "./identity";
import { runSync } from "./syncEngine";
import { UnlockOutboxDialog } from "./UnlockOutboxDialog";

interface RecentlySynced { name: string; mpiNumber: string | null; at: string }

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  supported: boolean;
  unlocked: boolean;
  needsSignIn: boolean;
  entries: OutboxEntry[];
  pendingCount: number;
  problemCount: number;
  recentlySynced: RecentlySynced[];
  saveOffline: (data: RegisterPatientPayload, clientRecordId?: string) => Promise<string>;
  discard: (clientRecordId: string) => Promise<void>;
  syncNow: (opts?: { manual?: boolean }) => Promise<void>;
  requestUnlock: () => Promise<boolean>;
  provisionAfterLogin: (userId: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

// "Can we reach the API" — navigator.onLine only says there's a network
// interface, not that the server answers (captive portals, dead mine-site
// uplinks). /actuator/health is permitAll and skipped by TenantFilter.
async function probe(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${apiOrigin()}/actuator/health`, { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.id ?? null;
  const supported = isVaultSupported();

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [vaultPresent, setVaultPresent] = useState<boolean | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [recentlySynced, setRecentlySynced] = useState<RecentlySynced[]>([]);
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || !supported) { setEntries([]); setVaultPresent(null); return; }
    setVaultPresent(await vaultExists(userId));
    setEntries(await listEntries(userId, isUnlocked(userId)));
  }, [userId, supported]);

  // Vault lock state -> React state; refresh so names appear/disappear.
  useEffect(() => {
    const update = () => setUnlocked(userId ? isUnlocked(userId) : false);
    update();
    return onVaultChange(() => { update(); void refresh(); });
  }, [userId, refresh]);

  // Signing out locks the vault (the outbox itself is kept on the device).
  useEffect(() => { if (!userId) lockVault(); }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);

  // Connectivity: browser events for speed, a health probe for truth.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await probe();
      if (!cancelled) { setIsOnline(ok); setTick((t) => t + 1); }
    };
    const down = () => setIsOnline(false);
    window.addEventListener("online", check);
    window.addEventListener("offline", down);
    void check();
    const id = window.setInterval(check, 20_000);
    return () => { cancelled = true; window.clearInterval(id); window.removeEventListener("online", check); window.removeEventListener("offline", down); };
  }, []);

  const requestUnlock = useCallback(() => {
    if (!userId) return Promise.resolve(false);
    if (isUnlocked(userId)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => { resolverRef.current = resolve; setDialogOpen(true); });
  }, [userId]);

  const closeDialog = (ok: boolean) => { setDialogOpen(false); resolverRef.current?.(ok); resolverRef.current = null; };

  const submitUnlock = async (secret: string): Promise<boolean> => {
    if (!userId) return false;
    const ok = vaultPresent ? await unlockVault(userId, secret) : (await createVault(userId, secret), true);
    if (ok) closeDialog(true);
    return ok;
  };

  // Called by LoginScreen with the password just typed — the only moment it's
  // available, so the vault is created/unlocked here with no extra prompt.
  const provisionAfterLogin = useCallback(async (id: string, password: string) => {
    if (!isVaultSupported()) return;
    try {
      if (await vaultExists(id)) await unlockVault(id, password); // stale password -> stays locked, dialog handles it
      else await createVault(id, password);
    } catch { /* never block sign-in on offline storage */ }
  }, []);

  const syncNow = useCallback(async (opts?: { manual?: boolean }) => {
    const manual = !!opts?.manual;
    if (!userId || syncingRef.current) return;
    if (!isUnlocked(userId)) { if (!manual || !(await requestUnlock())) return; }
    if (!getTenantToken()) { setNeedsSignIn(true); return; }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const summary = await runSync(userId, manual);
      setNeedsSignIn(false);
      const at = new Date().toISOString();
      if (summary.synced.length) {
        setRecentlySynced((prev) => [...summary.synced.map((s) => ({ ...s, at })), ...prev].slice(0, 20));
        const mpis = summary.synced.map((s) => s.mpiNumber).filter(Boolean).join(", ");
        showToast(`${summary.synced.length} registration${summary.synced.length === 1 ? "" : "s"} synced${mpis ? `: ${mpis}` : ""}.`, "success");
      }
      if (summary.conflicts) showToast(`${summary.conflicts} registration${summary.conflicts === 1 ? "" : "s"} match an existing patient — an administrator needs to review.`, "error");
      if (summary.rejected) showToast(`${summary.rejected} registration${summary.rejected === 1 ? "" : "s"} need correcting before they can sync.`, "error");
      if (summary.retryLater) showToast("Some records couldn't sync yet and will be retried.", "info");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setNeedsSignIn(true);
      else if (error instanceof ApiError) showToast(error.message, "error");
      else setIsOnline(false); // transport failure -> keep everything pending
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refresh();
    }
  }, [userId, requestUnlock, showToast, refresh]);

  const pendingCount = entries.filter((e) => e.status === "PENDING").length;
  const problemCount = entries.filter((e) => e.status !== "PENDING").length;

  // Automatic sync: connectivity back + vault unlocked + something pending.
  // `tick` re-fires every probe so RETRY_LATER records get another go.
  useEffect(() => {
    if (isOnline && userId && unlocked && pendingCount > 0) void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, userId, unlocked, pendingCount, tick]);

  const saveOffline = useCallback(async (data: RegisterPatientPayload, clientRecordId?: string) => {
    if (!userId) throw new Error("Not signed in.");
    const slug = getTenantSlug() ?? loadOfflineIdentity()?.tenantSlug ?? "";
    const id = await enqueue(userId, slug, data, clientRecordId);
    await refresh();
    return id;
  }, [userId, refresh]);

  const discard = useCallback(async (id: string) => { await removeEntry(id); await refresh(); }, [refresh]);

  const value = useMemo<OfflineContextValue>(
    () => ({ isOnline, isSyncing, supported, unlocked, needsSignIn, entries, pendingCount, problemCount, recentlySynced, saveOffline, discard, syncNow, requestUnlock, provisionAfterLogin, refresh }),
    [isOnline, isSyncing, supported, unlocked, needsSignIn, entries, pendingCount, problemCount, recentlySynced, saveOffline, discard, syncNow, requestUnlock, provisionAfterLogin, refresh],
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
      {dialogOpen && <UnlockOutboxDialog creating={vaultPresent === false} supported={supported} onSubmit={submitUnlock} onCancel={() => closeDialog(false)} />}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}