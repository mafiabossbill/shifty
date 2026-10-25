import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadMigrations } from "../scripts/migrations";

describe("migrations", () => {
  const migrations = loadMigrations();

  it("have unique, well-formed versions", () => {
    expect(migrations.length).toBeGreaterThan(0);
    expect(new Set(migrations.map((m) => m.version)).size).toBe(migrations.length);
  });

  it("refuse a duplicate version instead of silently skipping it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "migrations-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "0080_one.sql"), "select 1;");
    writeFileSync(path.join(dir, "0080_two.sql"), "select 2;");
    expect(() => loadMigrations(dir)).toThrow(/Duplicate migration version 0080/);
  });

  it("enable row-level security on every table they create", () => {
    const all = migrations.map((m) => m.body).join("\n");
    const tables = [...all.matchAll(/create table (?:if not exists )?(?!private\.)(\w+)\s*\(/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(all, `${table} has no RLS`).toMatch(new RegExp(`alter table ${table}\\s+enable row level security`, "i"));
    }
  });

  it("give every org-scoped table an organization_id foreign key and timestamps", () => {
    const all = migrations.map((m) => m.body).join("\n");
    for (const [, table, body] of all.matchAll(/create table (?!private\.)(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (!/organization_id/.test(body)) continue;
      expect(body, `${table}.organization_id`).toMatch(/organization_id\s+uuid not null references organizations/);
      expect(body, `${table}.created_at`).toMatch(/created_at\s+timestamptz not null default now\(\)/);
    }
  });

  describe("SHIFTY tables (database-engineer range 0100–0199)", () => {
    const SHIFT_TABLES = [
      "shift_sessions", "shift_breaks", "location_snapshots", "session_revisions", "shift_events", "work_projects",
      "saved_places", "user_settings", "companion_states", "reward_ledger_entries", "user_achievements", "activities",
    ];
    const APPEND_ONLY = ["shift_events", "reward_ledger_entries", "session_revisions", "user_achievements"];
    const all = migrations.map((m) => m.body).join("\n");
    // The LAST definition of each policy name wins (later migrations drop and recreate).
    const latest = new Map<string, { name: string; table: string; command: string; body: string }>();
    for (const m of all.matchAll(/create policy (\w+) on (\w+) for (select|insert|update|delete|all)\b([\s\S]*?);/gi)) {
      latest.set(m[1], { name: m[1], table: m[2], command: m[3].toLowerCase(), body: m[4] });
    }
    const policies = [...latest.values()];

    it("are created inside the range, each with an owner FK to profiles", () => {
      for (const table of SHIFT_TABLES) {
        const home = migrations.find((m) => new RegExp(`create table ${table}\\s*\\(`).test(m.body));
        expect(home, `${table} is created`).toBeDefined();
        expect(Number(home!.version), `${table} version`).toBeGreaterThanOrEqual(100);
        expect(Number(home!.version), `${table} version`).toBeLessThan(200);
        const body = home!.body.match(new RegExp(`create table ${table}\\s*\\(([\\s\\S]*?)\\n\\);`))![1];
        expect(body, `${table}.user_id`).toMatch(/user_id\s+uuid (?:not null|primary key) references profiles \(id\) on delete cascade/);
      }
    });

    it("only ever show a person their own rows (admins included); writing needs shift:track", () => {
      for (const table of SHIFT_TABLES) {
        const own = policies.filter((p) => p.table === table);
        expect(own.length, `${table} has policies`).toBeGreaterThan(0);
        for (const p of own) {
          expect(p.body, p.name).toMatch(/user_id = \(select auth\.uid\(\)\)/);
          expect(p.command, p.name).not.toBe("all");
          if (p.command === "insert" || p.command === "update") {
            expect(p.body, p.name).toMatch(/has_capability\(organization_id, 'shift:track'\)/);
          } else {
            // Reading and deleting one's own data never depends on role or membership (security review M2).
            expect(p.body.trim(), p.name).toBe("to authenticated\n  using (user_id = (select auth.uid()))");
          }
        }
      }
    });

    it("keep the event log, ledger, revisions and achievements append-only", () => {
      for (const table of APPEND_ONLY) {
        const commands = policies.filter((p) => p.table === table).map((p) => p.command).sort();
        expect(commands, table).toEqual(["insert", "select"]);
      }
    });

    it("never feed audit_logs (admins can read it; tracking is private)", () => {
      for (const table of SHIFT_TABLES) {
        expect(all, table).not.toMatch(new RegExp(`on ${table}\\s+for each row execute function private\\.audit_row_change`, "i"));
      }
    });

    it("tombstone a deleted session's events and accept imported sessions", () => {
      expect(all).toMatch(/create trigger shift_sessions_tombstone_events after delete on shift_sessions/);
      const types = [...all.matchAll(/add constraint shift_events_type_check check \(type in \(([\s\S]*?)\)\)/g)].at(-1)?.[1] ?? "";
      expect(types).toContain("'import_session'");
    });

    it("run the commit and load RPCs as the caller, so RLS applies", () => {
      for (const fn of ["commit_shift_event", "load_shift_state", "load_shift_session", "delete_location_fixes", "load_profile_state", "export_my_shift_data"]) {
        const def = all.match(new RegExp(`create or replace function ${fn}\\s*\\(([\\s\\S]*?)\\$\\$`));
        expect(def, `${fn} exists`).not.toBeNull();
        expect(def![1], fn).not.toMatch(/security definer/i);
      }
    });

    it("enforce one running session per person with a partial unique index", () => {
      expect(all).toMatch(/create unique index shift_sessions_one_active_idx on shift_sessions \(user_id\) where ended_at is null and deleted_at is null/);
    });
  });
});
