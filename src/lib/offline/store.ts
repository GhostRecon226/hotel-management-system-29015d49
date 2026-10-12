// A tiny IndexedDB key-value store for offline mode. Everything is wrapped so a blocked or full store never breaks the app.
const DB = "zikora-offline";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).finally(() => db.close());
  } catch {
    return undefined;
  }
}

export const kvGet = <T>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
export const kvSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const kvClear = () => run("readwrite", (s) => s.clear());
