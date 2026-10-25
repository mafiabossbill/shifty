/**
 * Sync status wording: the top-bar pill, the sheet's explanation and the "needs attention" sentences.
 * Pure; tested in tests/home-sync-view.test.ts.
 */
import { formatTime, weekdayShort, formatInstant, type ClockFormat } from "@/lib/format";
import type { StoredEvent } from "@/lib/store/persistence";
import type { SyncView } from "@/lib/store/store";
import type { ShiftEvent, ShiftSession } from "@/lib/shifts/types";
import { localDateOf } from "@/lib/time/zone";
import type { SyncPillState } from "@/components/ui/status-pill";

export interface SyncPill {
  state: SyncPillState;
  label: string;
}

/** The one pill in the top bar. Problems first, then where the data lives, then progress. */
export function syncPill(sync: Pick<SyncView, "mode" | "phase" | "pending" | "attention">): SyncPill {
  if (sync.attention.length > 0 || sync.mode === "foreign_data") return { state: "needs_attention", label: "Needs attention" };
  switch (sync.mode) {
    case "device":
    case "unconfigured":
      return { state: "local", label: "On this device" };
    case "signed_out":
      return { state: "local", label: "Sign in to sync" };
    case "attach_pending":
      return { state: "local", label: "Ready to upload" };
    case "account":
    default:
      break;
  }
  if (sync.phase === "offline") return { state: "local", label: "Offline · saved here" };
  if (sync.phase === "syncing") return { state: "syncing", label: "Syncing" };
  if (sync.pending > 0) return { state: "local", label: `Local · ${sync.pending}` };
  if (sync.phase === "error") return { state: "local", label: "Sync paused" };
  return { state: "synced", label: "Synced" };
}

export interface SyncExplanation {
  title: string;
  body: string;
  /** Show "Sync now". */
  canSync: boolean;
}

export function syncExplanation(sync: Pick<SyncView, "mode" | "phase" | "pending" | "attention" | "message" | "email">): SyncExplanation {
  const n = sync.pending;
  const sessionsWord = `${n} ${n === 1 ? "change" : "changes"}`;
  switch (sync.mode) {
    case "device":
      return {
        title: "Saved on this device",
        body: "Everything you record is kept in this browser on this device. Sign in to keep a copy in your account and use SHIFTY on other devices.",
        canSync: false,
      };
    case "unconfigured":
      return {
        title: "Saved on this device",
        body: "Everything you record is kept in this browser on this device. Account sync isn't set up on this deployment yet, so nothing leaves this device.",
        canSync: false,
      };
    case "signed_out":
      return {
        title: "Sign in to sync",
        body: sync.message ?? "Sign in again to sync. Your changes are safe on this device.",
        canSync: false,
      };
    case "attach_pending":
      return {
        title: "Ready to upload",
        body: `You're signed in${sync.email ? ` as ${sync.email}` : ""}. The sessions saved on this device haven't been uploaded to your account yet.`,
        canSync: false,
      };
    case "foreign_data":
      return {
        title: "This device holds someone else's data",
        body: `You're signed in${sync.email ? ` as ${sync.email}` : ""}, but the sessions on this device belong to another account. Nothing is synced until you choose what to do in Account settings.`,
        canSync: false,
      };
    case "account":
    default:
      break;
  }
  if (sync.phase === "offline")
    return {
      title: "Offline",
      body: sync.message ?? "You're offline. Everything is saved on this device and will sync when you're back.",
      canSync: true,
    };
  if (sync.phase === "syncing")
    return {
      title: "Syncing",
      body: "Sending your changes to your account.",
      canSync: false,
    };
  if (sync.phase === "error")
    return {
      title: "Sync paused",
      body: `${sync.message ?? "The server didn't accept the last sync."} SHIFTY will try again shortly.`,
      canSync: true,
    };
  if (n > 0)
    return {
      title: "Waiting to sync",
      body: `${sessionsWord} saved on this device will be sent to your account in a moment.`,
      canSync: true,
    };
  return {
    title: "Synced",
    body: `Everything is saved in your account${sync.email ? ` (${sync.email})` : ""}.`,
    canSync: true,
  };
}

const EVENT_LABEL: Record<ShiftEvent["type"], string> = {
  clock_in: "Clock-in",
  clock_out: "Clock-out",
  break_start: "Break start",
  break_end: "Break end",
  location: "Location",
  location_delete: "Location deletion",
  annotate: "Details change",
  correct: "Time correction",
  manual_create: "Manual session",
  rezone: "Timezone change",
  import_session: "Imported session",
  delete: "Move to trash",
  restore: "Restore from trash",
  purge: "Permanent delete",
};

export function eventLabel(type: ShiftEvent["type"]): string {
  return EVENT_LABEL[type] ?? "Change";
}

/** The zone the event should be read in: the session's, else the event's own reporting zone, else its device zone. */
function zoneOf(event: ShiftEvent, session: ShiftSession | undefined): string {
  if (session) return session.reportingTimeZone;
  if ("reportingTimeZone" in event && typeof event.reportingTimeZone === "string") return event.reportingTimeZone;
  return event.deviceTimeZone;
}

/** The instant a refused event is about (the start for a manual session). */
function eventInstant(event: ShiftEvent): number {
  return event.type === "manual_create" ? event.startedAt : event.at;
}

export interface AttentionItem {
  id: string;
  sentence: string;
  evidence: { label: string; value: string }[];
  /** Discarding it drops the whole session that only exists on this device. */
  dropsSession: boolean;
}

/** "Clock-in on Mon 18:00 wasn't accepted: A session is already running." + evidence. */
export function describeAttention(stored: StoredEvent, sessions: Record<string, ShiftSession>, clock: ClockFormat = "24h"): AttentionItem {
  const { event } = stored;
  const session = sessions[event.sessionId];
  const zone = zoneOf(event, session);
  const at = eventInstant(event);
  const when = `${weekdayShort(localDateOf(at, zone))} ${formatTime(at, zone, clock)}`;
  const reason = stored.error?.message?.trim() || "The server refused it.";
  const sentence = `${eventLabel(event.type)} on ${when} wasn't accepted: ${reason.endsWith(".") ? reason : `${reason}.`}`;
  const evidence = [
    { label: "Event", value: event.type },
    { label: "Time", value: `${formatInstant(at, zone, clock)} (${zone})` },
    { label: "Recorded", value: formatInstant(event.recordedAt, zone, clock) },
    { label: "Error", value: stored.error?.code ?? "unknown" },
    { label: "Attempts", value: String(stored.attempts) },
  ];
  return {
    id: event.id,
    sentence,
    evidence,
    dropsSession: event.type === "clock_in" || event.type === "manual_create",
  };
}

/** What Discard does, said plainly before the person confirms. */
export function discardConsequence(item: Pick<AttentionItem, "dropsSession">): string {
  return item.dropsSession
    ? "This removes the session it created, and everything recorded for it on this device. It can't be undone."
    : "This change is removed from this device. Your account keeps its own version. It can't be undone.";
}

/** "Last synced 18:02" / "Last synced Mon 18:02" / "Never synced". */
export function lastSyncedLine(lastSyncedAt: number | null, now: number, zone: string, clock: ClockFormat = "24h"): string {
  if (lastSyncedAt === null) return "Never synced";
  const sameDay = localDateOf(lastSyncedAt, zone) === localDateOf(now, zone);
  return `Last synced ${sameDay ? "" : `${weekdayShort(localDateOf(lastSyncedAt, zone))} `}${formatTime(lastSyncedAt, zone, clock)}`;
}
