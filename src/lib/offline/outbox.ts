/**
 * Offline outbox for products whose blueprint says `pwa.offline: "offline-queue"`. Opt-in: nothing
 * in the template uses it until a feature does. Rules (docs/PWA_STANDARD.md, offline-queue exception):
 * - every queued write carries a client-generated `client_id`; the server treats a repeat as a replay
 *   (POST /api/projects shows the contract: 201 first time, 200 with the original row after);
 * - items flush oldest first when the device is back online; transport failures, 408, 429 and 5xx retry
 *   with exponential backoff; 409 is a conflict to show the person; other 4xx are permanent failures;
 * - the outbox is per user and cleared on sign-out (`store.clear()`), so no private data outlives a session.
 */
export type OutboxMethod = "POST" | "PATCH" | "DELETE";

export interface OutboxItem {
  /** = the body's client_id, so the same write is never queued twice. */
  id: string;
  url: string;
  method: OutboxMethod;
  body: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
}

export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface FlushResult {
  sent: string[];
  conflicts: { id: string; message: string }[];
  failed: { id: string; message: string }[];
  waiting: number;
}

const MAX_BACKOFF_MS = 5 * 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));
}

export async function enqueue(
  store: OutboxStore,
  write: { url: string; method: OutboxMethod; body: Record<string, unknown> },
  now = new Date(),
): Promise<OutboxItem> {
  const clientId = typeof write.body.client_id === "string" ? write.body.client_id : crypto.randomUUID();
  const item: OutboxItem = {
    id: clientId,
    url: write.url,
    method: write.method,
    body: { ...write.body, client_id: clientId },
    createdAt: now.toISOString(),
    attempts: 0,
    nextAttemptAt: now.toISOString(),
  };
  await store.put(item);
  return item;
}

const RETRYABLE = new Set([408, 425, 429]);

/** Sends due items in order. Safe to call often (app open, `online` event, a Sync button). */
export async function flush(store: OutboxStore, { fetchImpl = fetch, now = new Date() } = {}): Promise<FlushResult> {
  const result: FlushResult = { sent: [], conflicts: [], failed: [], waiting: 0 };
  const items = (await store.all()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const item of items) {
    if (item.nextAttemptAt > now.toISOString()) {
      result.waiting++;
      continue;
    }
    let status = 0;
    let message = "";
    try {
      const response = await fetchImpl(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(item.body),
      });
      status = response.status;
      if (!response.ok) message = ((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${status}`;
    } catch (error) {
      message = (error as Error).message || "Network error";
    }
    if (status >= 200 && status < 300) {
      await store.remove(item.id);
      result.sent.push(item.id);
    } else if (status === 409) {
      await store.remove(item.id);
      result.conflicts.push({ id: item.id, message });
    } else if (status >= 400 && status < 500 && !RETRYABLE.has(status)) {
      await store.remove(item.id);
      result.failed.push({ id: item.id, message });
    } else {
      const attempts = item.attempts + 1;
      await store.put({ ...item, attempts, lastError: message, nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)).toISOString() });
      result.waiting++;
    }
  }
  return result;
}

/** Test and server-side double. */
export class MemoryOutboxStore implements OutboxStore {
  private items = new Map<string, OutboxItem>();
  async all() {
    return [...this.items.values()];
  }
  async put(item: OutboxItem) {
    this.items.set(item.id, item);
  }
  async remove(id: string) {
    this.items.delete(id);
  }
  async clear() {
    this.items.clear();
  }
}

/** Browser store: one IndexedDB database per signed-in user (pass the user id), cleared on sign-out. */
export class IndexedDbOutboxStore implements OutboxStore {
  constructor(private readonly userId: string) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`outbox:${this.userId}`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("items", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction("items", mode).objectStore("items"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  }

  all() {
    return this.run<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  }
  async put(item: OutboxItem) {
    await this.run("readwrite", (s) => s.put(item));
  }
  async remove(id: string) {
    await this.run("readwrite", (s) => s.delete(id));
  }
  async clear() {
    await this.run("readwrite", (s) => s.clear());
  }
}
