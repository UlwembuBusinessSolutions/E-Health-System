// One place for query keys so recording an entry or closing a day refreshes exactly what changed.
export const registerKeys = {
  all: ["pharmacy", "register"] as const,
  products: (facilityId: string) => ["pharmacy", "register", "products", facilityId] as const,
  book: (facilityId: string, productId: string) => ["pharmacy", "register", "book", facilityId, productId] as const,
  dayClose: (facilityId: string, productId: string, date: string) =>
    ["pharmacy", "register", "day-close", facilityId, productId, date] as const,
  witnesses: (facilityId: string) => ["pharmacy", "register", "witnesses", facilityId] as const,
};
