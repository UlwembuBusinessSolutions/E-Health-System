import { useQuery } from "@tanstack/react-query";
import {
  getOrganizationModules,
  type ModuleEntitlement,
} from "@/shared/api/organization";

export function useModuleEntitlements() {
  const query = useQuery<ModuleEntitlement[]>({
    queryKey: ["organization", "modules"],
    queryFn: getOrganizationModules,
    staleTime: 5 * 60 * 1000,
  });

  const modules = query.data ?? [];

  const enabledModules = new Set(
    modules
      .filter((module) => module.enabled)
      .map((module) => module.code),
  );

  const hasModule = (moduleCode: string): boolean => {
    // Foundation modules are always enabled by the backend.
    // Keeping this fallback here also means the UI remains usable if
    // the entitlement response is temporarily unavailable after login.
    const module = modules.find((item) => item.code === moduleCode);

    if (module?.foundation) {
      return true;
    }

    return enabledModules.has(moduleCode);
  };

  return {
    ...query,
    modules,
    hasModule,
  };
}