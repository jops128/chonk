import type { Character, Snapshot } from '../shared/character';

export type Pending = { data: Character; expectedRevision: number; writeId: string };
export type LocalRecord = { token: string; snapshot: Snapshot | null; pending: Pending | null; undo: Character | null };
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('chonk-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readLocal(token: string): Promise<LocalRecord | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('records').objectStore('records').get(token);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeLocal(record: LocalRecord): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite');
    transaction.objectStore('records').put(record, record.token);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
