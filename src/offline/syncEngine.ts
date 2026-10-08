import { listEntries, removeEntry, updateEntry } from "./outbox";
import { syncPatients, type SyncResult } from "@/shared/api/offlineSync";

const BATCH_SIZE = 25; // backend MAX_BATCH_SIZE is 50

export interface SyncSummary {
  synced: { name: string; mpiNumber: string | null }[];
  conflicts: number;
  rejected: number;
  retryLater: number;
}

// Throws on transport/auth failure (ApiError 401/403, or a network TypeError)
// so the caller can react; per-record outcomes never throw. Records are sent
// oldest first so two offline captures of the same person conflict
// deterministically. includeConflicts replays CONFLICT rows too (idempotent on
// the server) — that's how a locally-held conflict notices an admin resolved
// it and clears itself (server answers RESOLVED).
export async function runSync(userId: string, includeConflicts: boolean): Promise<SyncSummary> {
  const all = await listEntries(userId, true);
  const todo = all.filter(
    (e) => e.data && (e.status === "PENDING" || (includeConflicts && e.status === "CONFLICT")),
  );
  const summary: SyncSummary = { synced: [], conflicts: 0, rejected: 0, retryLater: 0 };

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const results = await syncPatients(
      batch.map((e) => ({ clientRecordId: e.clientRecordId, capturedAt: e.capturedAt, data: e.data! })),
    );
    const byId = new Map<string, SyncResult>(results.map((r) => [r.clientRecordId, r]));

    for (const entry of batch) {
      const result = byId.get(entry.clientRecordId);
      if (!result) continue;
      switch (result.status) {
        case "SYNCED":
          await removeEntry(entry.clientRecordId);
          summary.synced.push({
            name: `${entry.data!.firstName} ${entry.data!.lastName}`,
            mpiNumber: result.mpiNumber,
          });
          break;
        case "RESOLVED":
          await removeEntry(entry.clientRecordId);
          break;
        case "CONFLICT":
          if (entry.status !== "CONFLICT") summary.conflicts += 1;
          await updateEntry(entry.clientRecordId, { status: "CONFLICT", lastMessage: result.message });
          break;
        case "REJECTED":
          summary.rejected += 1;
          await updateEntry(entry.clientRecordId, { status: "REJECTED", lastMessage: result.message });
          break;
        case "RETRY_LATER":
          summary.retryLater += 1;
          await updateEntry(entry.clientRecordId, { incrementAttempts: true, lastMessage: result.message });
          break;
      }
    }
  }
  return summary;
}