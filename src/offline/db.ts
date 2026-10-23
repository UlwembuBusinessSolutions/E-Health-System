// Minimal promise wrapper over IndexedDB — no dependency. Two stores:
// "vault" (one row per user: the password-wrapped data key) and "outbox"
// (one row per offline-captured registration, payload encrypted).
const DB_NAME = "ulwembu-offline";
const DB_VERSION = 1;

export type StoreName = "vault" | "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("vault")) db.createObjectStore("vault", { keyPath: "userId" });
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "clientRecordId" });
          outbox.createIndex("byUser", "userId");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = op(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbPut = (store: StoreName, value: unknown) =>
  run(store, "readwrite", (s) => s.put(value)).then(() => undefined);
export const idbDelete = (store: StoreName, key: string) =>
  run(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
export const idbOutboxByUser = <T>(userId: string) =>
  run<T[]>("outbox", "readonly", (s) => s.index("byUser").getAll(userId));