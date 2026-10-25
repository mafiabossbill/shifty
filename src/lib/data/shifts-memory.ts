import type { RepoResult } from "@/lib/api";
import { validateTimes } from "@/lib/shifts/reducer";
import type { Activity, Companion, EarnedAchievement, LedgerEntry, Place, Project, Settings } from "@/lib/shifts/profile";
import type { ShiftSession } from "@/lib/shifts/types";
import type { ProfileDocument } from "@/lib/sync/contract";
import type { ProfilePut } from "@/lib/validation";

import { lwwAccepts, type CommitInput, type CommitOutcome, type ShiftRepository } from "./shifts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * In-memory twin of the Supabase repository for route tests. It enforces what the database enforces, so
 * tests exercise real behaviour: event ids commit once (duplicate), the stored revision must equal the
 * expected one (revision_conflict, as SQLSTATE 40001), one running session per person (unique_violation,
 * as the partial unique index) and session chronology (as the CHECK / exclusion constraints).
 */
export class InMemoryShiftRepository implements ShiftRepository {
  readonly sessions = new Map<string, ShiftSession>();
  readonly events = new Map<string, { sessionId: string; flags: string[] }>();
  settings: Settings | null = null;
  companion: Companion | null = null;
  readonly projects = new Map<string, Project>();
  readonly places = new Map<string, Place>();
  readonly activities = new Map<string, Activity>();
  readonly ledger = new Map<string, LedgerEntry>();
  readonly achievements = new Map<string, EarnedAchievement>();
  commits = 0;
  /** Runs once before each of the next commits: lets a test simulate another device committing in between. */
  readonly beforeCommit: (() => void)[] = [];
  /** Makes the next commits fail like an unknown database error / a refused privilege. */
  failNext: CommitOutcome[] = [];

  constructor(sessions: ShiftSession[] = []) {
    for (const s of sessions) this.sessions.set(s.id, clone(s));
  }

  async loadSessions(): Promise<ShiftSession[]> {
    return [...this.sessions.values()].map(clone);
  }

  async committedEventIds(ids: readonly string[]): Promise<Set<string>> {
    return new Set(ids.filter((id) => this.events.has(id)));
  }

  async commit(input: CommitInput): Promise<CommitOutcome> {
    this.beforeCommit.shift()?.();
    const forced = this.failNext.shift();
    if (forced) return forced;
    if (this.events.has(input.event.id)) return { status: "duplicate" };
    const stored = this.sessions.get(input.sessionId);
    if ((stored?.revision ?? 0) !== input.expectedRevision) return { status: "revision_conflict" };

    const next = input.session;
    if (next) {
      if (next.id !== input.sessionId) return { status: "error", code: "session_id_mismatch" };
      const running = next.endedAt === null && next.deletedAt === null;
      const other = [...this.sessions.values()].find((s) => s.id !== next.id && s.endedAt === null && s.deletedAt === null);
      if (running && other) return { status: "unique_violation" };
      if (validateTimes(next)) return { status: "chronology", message: "These times aren't in order." };
      const flags = [...new Set([...next.flags, ...input.flags])];
      this.sessions.set(next.id, clone({ ...next, flags }));
    } else {
      // Purge: the session goes, its event ids stay so a replay can't resurrect it.
      this.sessions.delete(input.sessionId);
    }
    this.events.set(input.event.id, { sessionId: input.sessionId, flags: [...input.flags] });
    this.commits += 1;
    return { status: "applied", revision: next?.revision ?? 0 };
  }

  async loadProfile(): Promise<ProfileDocument> {
    return clone({
      settings: this.settings,
      companion: this.companion,
      projects: [...this.projects.values()],
      places: [...this.places.values()],
      activities: [...this.activities.values()],
      ledger: [...this.ledger.values()],
      achievements: [...this.achievements.values()],
    });
  }

  async saveProfile(put: ProfilePut): Promise<RepoResult<{ ok: true }>> {
    if (put.settings && lwwAccepts(put.settings.updatedAt, this.settings?.updatedAt)) this.settings = clone(put.settings);
    if (put.companion && lwwAccepts(put.companion.updatedAt, this.companion?.updatedAt)) this.companion = clone(put.companion);
    for (const p of put.projects ?? []) if (lwwAccepts(p.updatedAt, this.projects.get(p.id)?.updatedAt)) this.projects.set(p.id, clone(p));
    for (const p of put.places ?? []) if (lwwAccepts(p.updatedAt, this.places.get(p.id)?.updatedAt)) this.places.set(p.id, clone(p));
    for (const a of put.activities ?? []) if (!this.activities.has(a.id)) this.activities.set(a.id, clone(a));
    for (const l of put.ledger ?? []) if (!this.ledger.has(l.key)) this.ledger.set(l.key, clone(l));
    for (const a of put.achievements ?? []) if (!this.achievements.has(a.code)) this.achievements.set(a.code, clone(a));
    return { ok: true, value: { ok: true } };
  }

  async countEvents(): Promise<number> {
    return this.events.size;
  }
}
