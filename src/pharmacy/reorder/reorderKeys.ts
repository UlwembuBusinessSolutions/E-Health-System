export const reorderKeys = {
  suppliers: (facilityId: string) => ["pharmacy", "reorder", "suppliers", facilityId] as const,
  sheet: (facilityId: string, supplierId: string) => ["pharmacy", "reorder", "sheet", facilityId, supplierId] as const,
};
