/**
 * Durable device storage for the event log and caches. IndexedDB in the browser (survives reloads, app
 * kills and reboots); an in-memory twin for tests. Every write is awaited before the UI reports it.
 */
import type { ProfileState } from "@/lib/shifts/profile";
import type { ShiftError, ShiftEvent, ShiftSession } from "@/lib/shifts/types";

/** local = only on this device · syncing = sent, awaiting the answer · rejected = needs attention. */
export type EventSyncStatus = "local" | "syncing" | "rejected";

export interface StoredEvent {
  event: ShiftEvent;
  /** Order of recording on this device. */
  seq: number;
  status: EventSyncStatus;
  /** Not sent before this instant (the clock-out undo window). */
  holdUntil: number | null;
  error: ShiftError | { code: "forbidden" | "server"; message: string; conflictingSessionId?: string } | null;
  attempts: number;
}

export interface Meta {
  /** "device" = never attached to an account; otherwise the account's user id. */
  owner: string;
  serverOffsetMs: number;
  lastSyncedAt: number | null;
  profileDirty: boolean;
  /** Reminder ids already shown/dismissed, per session (`<sessionId>:<hours>`). */
  dismissedNudges: string[];
}

export const DEFAULT_META: Meta = { owner: "device", serverOffsetMs: 0, lastSyncedAt: null, profileDirty: false, dismissedNudges: [] };

export interface Snapshot {
  events: StoredEvent[];
  base: ShiftSession[];
  profile: ProfileState | null;
  meta: Meta;
}

export interface Persistence {
  load(): Promise<Snapshot>;
  putEvent(event: StoredEvent): Promise<void>;
  putEvents(events: StoredEvent[]): Promise<void>;
  deleteEvents(ids: string[]): Promise<void>;
  putBase(sessions: ShiftSession[]): Promise<void>;
  putProfile(profile: ProfileState): Promise<void>;
  putMeta(meta: Meta): Promise<void>;
  clear(): Promise<void>;
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryPersistence implements Persistence {
  events = new Map<string, StoredEvent>();
  base: ShiftSession[] = [];
  profile: ProfileState | null = null;
  meta: Meta = { ...DEFAULT_META };

  async load(): Promise<Snapshot> {
    return clone({ events: [...this.events.values()], base: this.base, profile: this.profile, meta: this.meta });
  }
  async putEvent(e: StoredEvent) {
    this.events.set(e.event.id, clone(e));
  }
  async putEvents(es: StoredEvent[]) {
    for (const e of es) this.events.set(e.event.id, clone(e));
  }
  async deleteEvents(ids: string[]) {
    for (const id of ids) this.events.delete(id);
  }
  async putBase(sessions: ShiftSession[]) {
    this.base = clone(sessions);
  }
  async putProfile(profile: ProfileState) {
    this.profile = clone(profile);
  }
  async putMeta(meta: Meta) {
    this.meta = clone(meta);
  }
  async clear() {
    this.events.clear();
    this.base = [];
    this.profile = null;
    this.meta = { ...DEFAULT_META };
  }
}

const DB_NAME = "shifty";
const DB_VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Storage transaction aborted"));
  });
}

/** Browser store: `events` (keyed by event id) and `kv` (base, profile, meta). */
export class IndexedDbPersistence implements Persistence {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("events")) db.createObjectStore("events", { keyPath: "event.id" });
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Close SHIFTY in other tabs and reload."));
    });
    return this.db;
  }

  async load(): Promise<Snapshot> {
    const db = await this.open();
    const tx = db.transaction(["events", "kv"], "readonly");
    const events = request(tx.objectStore("events").getAll() as IDBRequest<StoredEvent[]>);
    const kv = tx.objectStore("kv");
    const base = request(kv.get("base") as IDBRequest<ShiftSession[] | undefined>);
    const profile = request(kv.get("profile") as IDBRequest<ProfileState | undefined>);
    const meta = request(kv.get("meta") as IDBRequest<Meta | undefined>);
    return { events: await events, base: (await base) ?? [], profile: (await profile) ?? null, meta: { ...DEFAULT_META, ...((await meta) ?? {}) } };
  }

  private async write(stores: string[], action: (tx: IDBTransaction) => void) {
    const db = await this.open();
    const tx = db.transaction(stores, "readwrite");
    action(tx);
    await done(tx);
  }

  putEvent(e: StoredEvent) {
    return this.write(["events"], (tx) => tx.objectStore("events").put(e));
  }
  putEvents(es: StoredEvent[]) {
    return this.write(["events"], (tx) => es.forEach((e) => tx.objectStore("events").put(e)));
  }
  deleteEvents(ids: string[]) {
    return this.write(["events"], (tx) => ids.forEach((id) => tx.objectStore("events").delete(id)));
  }
  putBase(sessions: ShiftSession[]) {
    return this.write(["kv"], (tx) => tx.objectStore("kv").put(sessions, "base"));
  }
  putProfile(profile: ProfileState) {
    return this.write(["kv"], (tx) => tx.objectStore("kv").put(profile, "profile"));
  }
  putMeta(meta: Meta) {
    return this.write(["kv"], (tx) => tx.objectStore("kv").put(meta, "meta"));
  }
  clear() {
    return this.write(["events", "kv"], (tx) => {
      tx.objectStore("events").clear();
      tx.objectStore("kv").clear();
    });
  }
}

/** Ask the browser not to evict our data under storage pressure (best effort; Safari may still). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
