import type { CountStatus } from "@/shared/api/pharmacyCounts";

// One place for query keys so every mutation invalidates exactly what it changed.
export const countKeys = {
  all: ["pharmacy", "counts"] as const,
  setup: (facilityId: string) => ["pharmacy", "counts", "setup", facilityId] as const,
  list: (facilityId: string, status: CountStatus) => ["pharmacy", "counts", "list", facilityId, status] as const,
  detail: (countId: string, revealSystem: boolean) => ["pharmacy", "counts", "detail", countId, revealSystem] as const,
  detailOf: (countId: string) => ["pharmacy", "counts", "detail", countId] as const,
};
