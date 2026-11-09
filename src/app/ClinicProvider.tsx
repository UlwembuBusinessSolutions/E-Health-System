// Lihle | 2026-09-09 | Manage clinic selection, access refresh, and separate query caches and mounted forms so switching clinics resets the displayed data and form state.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useIsMutating } from "@tanstack/react-query";
import { Building2, LoaderCircle, RefreshCw } from "lucide-react";
import { getAvailableClinics, getClinicContext, selectClinic, type ClinicContextResponse } from "@/shared/api/clinics";
import { getActiveClinicId, setActiveClinicId } from "@/shared/api/auth";
import type { Facility } from "@/shared/api/types";
import { useLocation, useNavigate } from "react-router-dom";

interface ClinicState {
  activeClinicId: string | null;
  clinics: Facility[];
  switchClinic: (id: string) => Promise<void>;
  pending: boolean;
}
const Context = createContext<ClinicState | null>(null);
export function useClinic() {
  const value = useContext(Context);
  if (!value) throw new Error("ClinicProvider is required");
  return value;
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<ClinicContextResponse | null>(null);
  const [clinics, setClinics] = useState<Facility[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [cache, setCache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  const navigate = useNavigate();
  const location = useLocation();
  const load = useCallback(async () => {
    setPending(true);
    setError("");
    setScope(null);
    setCache(new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
    try {
      let context = await getClinicContext();
      const saved = getActiveClinicId();
      if (saved && context.clinicIds.includes(saved)) context = await getClinicContext(saved);
      const available = await getAvailableClinics();
      setActiveClinicId(context.activeClinicId);
      setClinics(available);
      setScope(context);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load clinic access."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const revoked = () => { setActiveClinicId(null); void load(); };
    window.addEventListener("clinic-access-denied", revoked);
    return () => window.removeEventListener("clinic-access-denied", revoked);
  }, [load]);

  async function switchClinic(id: string) {
    if (pending || cache.isMutating() > 0 || id === scope?.activeClinicId) return;
    setPending(true);
    setError("");
    try {
      const context = await selectClinic(id);
      await cache.cancelQueries();
      cache.clear();
      setActiveClinicId(context.activeClinicId);
      setScope(context);
      // Each clinic has its own cache and mounted forms; late requests cannot populate the next clinic's view.
      setCache(new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
      if (/\/patients\/|\/prescriptions\/|\/triage\/(capture|assessments)\//.test(location.pathname)) {
        navigate("/app/patients", { replace: true });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not switch clinic."); }
    finally { setPending(false); }
  }

  const isAdministrative = /^\/app\/(staff|audit)/.test(location.pathname) || location.pathname === "/app";
  return <Context.Provider value={{ activeClinicId: scope?.activeClinicId ?? null, clinics, switchClinic, pending }}>
    <QueryClientProvider client={cache}>
      <div className="border-b border-border-subtle bg-surface-raised px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <Building2 className="size-5 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1"><ClinicSelector /></div>
          {pending && <LoaderCircle className="size-4 animate-spin text-text-secondary" aria-label="Loading clinic" />}
        </div>
        {error && <div role="alert" className="mx-auto mt-2 flex max-w-6xl items-center gap-2 text-sm text-danger-600">
          <span>{error}</span><button type="button" title="Reload clinic access" aria-label="Reload clinic access" onClick={() => void load()}><RefreshCw className="size-4" /></button>
        </div>}
      </div>
      {pending ? <p role="status" className="p-8 text-sm text-text-secondary">Loading clinic...</p>
        : scope && (scope.activeClinicId || isAdministrative) ? <div key={scope.activeClinicId ?? "organization"}>{children}</div>
        : <p className="p-8 text-sm text-text-secondary">{clinics.length ? "No clinic selected." : "No active clinics assigned. Contact your administrator."}</p>}
    </QueryClientProvider>
  </Context.Provider>;
}

function ClinicSelector() {
  const { clinics, activeClinicId, switchClinic, pending } = useClinic();
  const mutations = useIsMutating();
  return <label className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-text-secondary">
    <span>Active clinic</span>
    <select aria-label="Active clinic" value={activeClinicId ?? ""} disabled={pending || mutations > 0 || clinics.length === 0}
      onChange={event => void switchClinic(event.target.value)}
      className="h-10 w-full min-w-0 max-w-sm rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-primary disabled:opacity-60 sm:w-72">
      <option value="" disabled>Select clinic</option>
      {clinics.map(clinic => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
    </select>
  </label>;
}
