/** HTTP transport for the sync contract (browser). The store depends on the interface, tests on a fake. */
import type { ProfilePutRequest, PushResponse, StateResponse, StatusResponse } from "./contract";
import type { ShiftEvent } from "@/lib/shifts/types";

export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface SyncTransport {
  status(): Promise<StatusResponse["data"]>;
  pull(): Promise<StateResponse["data"]>;
  push(events: ShiftEvent[]): Promise<PushResponse["data"]>;
  putProfile(body: ProfilePutRequest): Promise<{ serverTime: number }>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok || !body || body.data === undefined) {
    throw new SyncHttpError(response.status, body?.error ?? `Sync failed (HTTP ${response.status}).`);
  }
  return body.data;
}

export const httpTransport: SyncTransport = {
  status: () => call("/api/sync/status"),
  pull: () => call("/api/sync/state"),
  push: (events) => call("/api/sync/events", { method: "POST", body: JSON.stringify({ events }) }),
  putProfile: (body) => call("/api/sync/profile", { method: "PUT", body: JSON.stringify(body) }),
};
