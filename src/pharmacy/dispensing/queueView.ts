import type { Prescription } from "@/shared/api/pharmacy";

export interface QueueFilters {
  query: string;
  status: string;
  stock: string;
  order: string;
}

export function filterQueue(queue: Prescription[], filters: QueueFilters): Prescription[] {
  const query = filters.query.trim().toLowerCase();
  return queue.filter((p) => {
    if (query && ![p.serialNumber, p.patientName, p.patientMpi, p.prescriberName ?? ""]
      .some((value) => value.toLowerCase().includes(query))) return false;
    const partial = p.status === "PARTIALLY_DISPENSED" || p.items.some((i) => i.dispensedQuantity > 0);
    if (filters.status === "PENDING" && partial) return false;
    if (filters.status === "PARTIAL" && !partial) return false;
    const remaining = p.items.filter((i) => i.remainingQuantity > 0);
    if (filters.stock === "UNMAPPED" && !remaining.some((i) => i.mappingStatus !== "CONFIRMED")) return false;
    if (filters.stock === "SHORT" && !remaining.some((i) => i.mappingStatus === "CONFIRMED" && i.availableQuantity < i.remainingQuantity)) return false;
    if (filters.stock === "READY" && !(remaining.length > 0 && remaining.every((i) =>
      i.mappingStatus === "CONFIRMED" && i.availableQuantity >= i.remainingQuantity))) return false;
    return true;
  }).sort((a, b) => {
    const difference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return filters.order === "NEWEST" ? -difference : difference;
  });
}

export function paginateQueue<T>(items: T[], requestedPage: number, size: number) {
  const page = Math.max(0, Math.min(requestedPage, Math.ceil(items.length / size) - 1));
  return { page, items: items.slice(page * size, (page + 1) * size), hasMore: (page + 1) * size < items.length };
}
