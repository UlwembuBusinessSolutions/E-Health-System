import { idbGet, idbPut } from "./db";

// A random AES-256-GCM data key encrypts outbox payloads. That key is stored
// only wrapped (encrypted) by a key derived from the user's password, so a
// stolen device without the password can't read the outbox. The unwrapped key
// lives in memory as a NON-extractable CryptoKey and is gone on reload/logout.
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface VaultRecord {
  userId: string;
  salt: Uint8Array;
  iv: Uint8Array;
  wrappedKey: ArrayBuffer;
  iterations: number;
  createdAt: string;
}

export class VaultLockedError extends Error {
  constructor() {
    super("Offline storage is locked.");
    this.name = "VaultLockedError";
  }
}

let current: { userId: string; key: CryptoKey } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function onVaultChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Web Crypto only exists in secure contexts (https or localhost).
export function isVaultSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!globalThis.crypto?.subtle && !!globalThis.indexedDB;
}

export const isUnlocked = (userId: string) => current?.userId === userId;

export async function vaultExists(userId: string): Promise<boolean> {
  return !!(await idbGet("vault", userId));
}

async function deriveWrappingKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const importDataKey = (raw: BufferSource) =>
  crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

export async function createVault(userId: string, secret: string): Promise<void> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapping = await deriveWrappingKey(secret, salt, ITERATIONS);
  const wrappedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapping, raw);
  const record: VaultRecord = { userId, salt, iv, wrappedKey, iterations: ITERATIONS, createdAt: new Date().toISOString() };
  await idbPut("vault", record);
  current = { userId, key: await importDataKey(raw) };
  raw.fill(0);
  notify();
}

// false = wrong secret (AES-GCM authentication fails) or no vault yet.
export async function unlockVault(userId: string, secret: string): Promise<boolean> {
  const record = await idbGet<VaultRecord>("vault", userId);
  if (!record) return false;
  try {
    const wrapping = await deriveWrappingKey(secret, record.salt, record.iterations);
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv as BufferSource }, wrapping, record.wrappedKey);
    current = { userId, key: await importDataKey(raw) };
    notify();
    return true;
  } catch {
    return false;
  }
}

export function lockVault(): void {
  if (!current) return;
  current = null;
  notify();
}

// recordId is bound in as additional authenticated data, so a ciphertext
// can't be swapped onto a different outbox row undetected.
export async function encryptJson(userId: string, recordId: string, value: unknown) {
  if (!current || current.userId !== userId) throw new VaultLockedError();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(recordId) },
    current.key,
    encoder.encode(JSON.stringify(value)),
  );
  return { iv, ciphertext };
}

export async function decryptJson<T>(userId: string, recordId: string, iv: Uint8Array, ciphertext: ArrayBuffer): Promise<T> {
  if (!current || current.userId !== userId) throw new VaultLockedError();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(recordId) },
    current.key,
    ciphertext,
  );
  return JSON.parse(decoder.decode(plain)) as T;
}