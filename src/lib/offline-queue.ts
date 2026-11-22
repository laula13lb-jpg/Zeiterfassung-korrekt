/**
 * Warteschlange für Offline-Stempelungen am Terminal (IndexedDB im Browser des Tablets).
 * Einträge werden nach erfolgreicher Übertragung sofort gelöscht.
 */
export interface QueuedStamp {
  clientId: string;
  employeeId: string;
  name: string;
  pin: string;
  type: "KOMMEN" | "PAUSE_START" | "PAUSE_ENDE" | "GEHEN";
  /** Zeitpunkt (ms seit 1970, mit Serverzeit-Abgleich) */
  at: number;
}

const DB = "bludau-terminal";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const enqueue = (s: QueuedStamp) => tx("readwrite", (st) => st.put(s));
export const dequeue = (clientId: string) => tx("readwrite", (st) => st.delete(clientId));
export const listQueue = async () => ((await tx("readonly", (st) => st.getAll())) as QueuedStamp[]).sort((a, b) => a.at - b.at);
