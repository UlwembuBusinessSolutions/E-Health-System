import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganizationModules, toggleOrganizationModule, type ModulePhase } from "@/shared/api/organization";
import { ApiError } from "@/shared/api/client";
import { Switch } from "@/shared/components/Switch";

// Mirrors platform/OrganizationDetailPage.tsx's own module-toggle grid
// (PHASE_ORDER/PHASE_LABELS, the same phase-grouped layout, the same
// Switch component) — that one lets a platform operator toggle an
// arbitrary org's modules; this one is the ORG_ADMIN self-service
// equivalent, always the caller's own org (no {id} path param).
const PHASE_ORDER: ModulePhase[] = ["FOUNDATION", "MVP0", "PHASE_2", "PHASE_3", "PHASE_4"];
const PHASE_LABELS: Record<ModulePhase, string> = {
  FOUNDATION: "Foundation",
  MVP0: "MVP0",
  PHASE_2: "Phase 2",
  PHASE_3: "Phase 3",
  PHASE_4: "Phase 4",
};

export function ModulesSettingsSection() {
  const queryClient = useQueryClient();
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  const modulesQuery = useQuery({ queryKey: ["organization", "modules"], queryFn: getOrganizationModules });
  const modules = modulesQuery.data ?? [];
  const enabledCount = modules.filter((m) => m.enabled).length;

  const toggleModule = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) => toggleOrganizationModule(code, enabled),
    onMutate: ({ code }) => {
      setModuleError(null);
      setTogglingCode(code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "modules"] });
    },
    onError: (error) => {
      setModuleError(error instanceof ApiError ? error.message : "Couldn't update that module. Try again.");
    },
    onSettled: () => setTogglingCode(null),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card">
      <div className="border-b border-border-subtle px-5 py-4 sm:px-6">
        <p className="text-[13px] text-text-secondary">
          {enabledCount} of {modules.length || 20} enabled
        </p>
      </div>

      {moduleError && (
        <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600 sm:px-6">
          {moduleError}
        </div>
      )}

      {modulesQuery.isLoading ? (
        <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary sm:px-6">Loading modules…</p>
      ) : modulesQuery.isError ? (
        <div className="flex flex-col items-start gap-3 px-5 py-8 text-[13.5px] text-text-secondary sm:px-6">
          <p>Modules could not be loaded. Please try again.</p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {PHASE_ORDER.map((phase) => {
            const phaseModules = modules.filter((m) => m.phase === phase);
            if (phaseModules.length === 0) return null;
            return (
              <div key={phase} className="px-5 py-4 sm:px-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {PHASE_LABELS[phase]}
                </p>
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {phaseModules.map((mod) => (
                    <div key={mod.code} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                          {mod.code}
                        </span>
                        <span className="truncate text-[13px] text-text-primary">{mod.displayName}</span>
                      </div>
                      {mod.foundation ? (
                        <span className="shrink-0 text-[11px] font-medium text-text-secondary">Always on</span>
                      ) : (
                        <Switch
                          checked={mod.enabled}
                          disabled={togglingCode === mod.code}
                          onChange={(enabled) => toggleModule.mutate({ code: mod.code, enabled })}
                          label={`${mod.enabled ? "Disable" : "Enable"} ${mod.displayName}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
