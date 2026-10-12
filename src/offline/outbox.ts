import { generateUUID } from "@/utils/uuid";
import { idbDelete, idbGet, idbOutboxByUser, idbPut } from "./db";
import { decryptJson, encryptJson } from "./vault";
import type { RegisterPatientPayload } from "@/shared/api/patients";

// PENDING  - waiting to sync
// CONFLICT - server parked it (ID number already exists); stays until an admin resolves it
// REJECTED - server says the data is invalid; needs correcting and resending
export type OutboxStatus = "PENDING" | "CONFLICT" | "REJECTED";

// Only non-PII metadata is stored in the clear. Everything identifying is in the ciphertext.
interface StoredRecord {
  clientRecordId: string;
  userId: string;
  tenantSlug: string;
  status: OutboxStatus;
  capturedAt: string;
  createdAt: string;
  attempts: number;
  lastMessage: string | null;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

export interface OutboxEntry {
  clientRecordId: string;
  status: OutboxStatus;
  capturedAt: string;
  attempts: number;
  lastMessage: string | null;
  // Present only while the vault is unlocked.
  data?: RegisterPatientPayload;
}

// Passing an existing id (correct-and-resend of a REJECTED record) overwrites
// that row and resets it to PENDING; the backend accepts a resubmit under the
// same clientRecordId only for REJECTED records.
export async function enqueue(
  userId: string,
  tenantSlug: string,
  data: RegisterPatientPayload,
  clientRecordId: string = generateUUID(),
): Promise<string> {
  const { iv, ciphertext } = await encryptJson(userId, clientRecordId, data);
  const now = new Date().toISOString();
  const record: StoredRecord = {
    clientRecordId, userId, tenantSlug, status: "PENDING", capturedAt: now, createdAt: now,
    attempts: 0, lastMessage: null, iv, ciphertext,
  };
  await idbPut("outbox", record);
  return clientRecordId;
}

export async function listEntries(userId: string, unlocked: boolean): Promise<OutboxEntry[]> {
  const records = await idbOutboxByUser<StoredRecord>(userId);
  records.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return Promise.all(
    records.map(async (r) => {
      const entry: OutboxEntry = {
        clientRecordId: r.clientRecordId, status: r.status, capturedAt: r.capturedAt,
        attempts: r.attempts, lastMessage: r.lastMessage,
      };
      if (unlocked) {
        try {
          entry.data = await decryptJson<RegisterPatientPayload>(userId, r.clientRecordId, r.iv, r.ciphertext);
        } catch {
          /* unreadable (e.g. written under a previous key) — shown without details */
        }
      }
      return entry;
    }),
  );
}

export async function updateEntry(
  clientRecordId: string,
  patch: { status?: OutboxStatus; lastMessage?: string | null; incrementAttempts?: boolean },
): Promise<void> {
  const record = await idbGet<StoredRecord>("outbox", clientRecordId);
  if (!record) return;
  if (patch.status) record.status = patch.status;
  if (patch.lastMessage !== undefined) record.lastMessage = patch.lastMessage;
  if (patch.incrementAttempts) record.attempts += 1;
  await idbPut("outbox", record);
}

export const removeEntry = (clientRecordId: string) => idbDelete("outbox", clientRecordId);