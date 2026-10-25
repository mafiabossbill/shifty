import { describe, expect, it } from "vitest";

import type { Project } from "@/lib/shifts/profile";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type LocationFix, type ShiftBreak, type ShiftSession, type ShiftState } from "@/lib/shifts/types";
import {
  DEFAULT_QUERY,
  activeFilterCount,
  filterOptions,
  filterRows,
  groupRows,
  lengthOf,
  matchesSearch,
  parseQuery,
  serializeQuery,
  sortRows,
  type SessionQuery,
} from "@/lib/sessions/query";
import { buildRows, displayTitle, placeOf } from "@/lib/sessions/rows";
import { fromWallClockInput } from "@/lib/time/zone";

const DAR = "Africa/Dar_es_Salaam";
const at = (v: string, zone = DAR) => fromWallClockInput(v, zone)!;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function manual(state: ShiftState, start: string, end: string, extra: { breaks?: [string, string][]; title?: string; tags?: string[]; projectId?: string; notes?: string } = {}) {
  const breaks: ShiftBreak[] = (extra.breaks ?? []).map(([s, e]) => ({ id: id(), startedAt: at(s), endedAt: at(e), kind: "rest" }));
  const t = at(end);
  const r = applyEvent(state, {
    id: id(),
    at: t,
    recordedAt: t,
    deviceTimeZone: DAR,
    type: "manual_create",
    sessionId: id(),
    startedAt: at(start),
    endedAt: t,
    breaks,
    goalSeconds: 16 * 3600,
    reportingTimeZone: DAR,
    title: extra.title,
    tags: extra.tags,
    projectId: extra.projectId,
    notes: extra.notes,
  });
  if (!r.ok) throw new Error(r.error.message);
  return { state: r.state, session: r.session! };
}

const fix = (label: string | null, status: LocationFix["status"] = "captured"): LocationFix => ({
  id: id(),
  event: "clock_in",
  status,
  requestedAt: 0,
  capturedAt: status === "captured" ? 1 : null,
  latitude: status === "captured" ? -6.8 : null,
  longitude: status === "captured" ? 39.2 : null,
  accuracyM: status === "captured" ? 12 : null,
  placeLabel: label,
});

const project: Project = { id: "11111111-1111-4111-8111-111111111111", name: "Client work", color: "teal", archived: false, updatedAt: 0 };

function fixture() {
  let state = EMPTY_STATE;
  const a = manual(state, "2026-10-26T18:00", "2026-10-27T10:00", { breaks: [["2026-10-27T02:00", "2026-10-27T02:30"]], tags: ["night"], projectId: project.id });
  state = a.state;
  const b = manual(state, "2026-10-27T13:00", "2026-10-27T17:00", { title: "Inventory count", notes: "Counted the cold room" });
  state = b.state;
  const c = manual(state, "2026-10-28T06:00", "2026-10-28T19:00");
  state = c.state;
  const sessions = Object.values(state.sessions).map((s): ShiftSession => {
    if (s.id === a.session.id) return { ...s, locations: [fix("Office")] };
    if (s.id === b.session.id) return { ...s, locations: [fix(null, "denied")], archivedAt: 1 };
    return { ...s, locations: [fix(null)] };
  });
  const rows = buildRows(sessions, at("2026-10-29T12:00"), [project]);
  const row = (s: { session: ShiftSession }) => rows.find((r) => r.session.id === s.session.id)!;
  return { rows, a: row(a), b: row(b), c: row(c) };
}

const query = (patch: Partial<SessionQuery>): SessionQuery => ({ ...DEFAULT_QUERY, ...patch });

describe("session rows", () => {
  it("computes net and day split for the acceptance shift (Mon 18:00 → Tue 10:00, 30m break)", () => {
    const { a } = fixture();
    expect(a.metrics.netMs).toBe(15.5 * 3_600_000);
    expect(a.days.map((d) => [d.date, d.netMs / 60_000])).toEqual([
      ["2026-10-26", 360],
      ["2026-10-27", 570],
    ]);
    expect(a.anchor).toBe("2026-10-26");
    expect(a.project?.name).toBe("Client work");
  });

  it("never invents a place: label, unlabelled spot, or none", () => {
    const { a, b, c } = fixture();
    expect(a.place).toEqual({ key: "place:Office", label: "Office" });
    expect(b.place).toEqual({ key: "none", label: null });
    expect(c.place).toEqual({ key: "unlabelled", label: "Unlabelled spot" });
    expect(placeOf({ locations: [] }).key).toBe("none");
  });

  it("uses the title, else a smart title from the start hour and place", () => {
    const { a, b, c } = fixture();
    expect(b.title).toBe("Inventory count");
    expect(a.title).toBe("Evening shift at Office");
    expect(c.title).toBe("Morning shift");
    expect(displayTitle({ title: "  ", startedAt: at("2026-10-26T23:00"), reportingTimeZone: DAR }, { key: "none", label: null })).toBe("Night shift");
  });
});

describe("list query", () => {
  it("round-trips through the URL and drops defaults", () => {
    const q = query({ q: "night", from: "2026-10-01", length: "12-16", origin: "manual", archived: true, sort: "longest", tag: "night", place: "place:Office" });
    const parsed = parseQuery(new URLSearchParams(serializeQuery(q).slice(1)));
    expect(parsed).toEqual(q);
    expect(serializeQuery(DEFAULT_QUERY)).toBe("");
  });

  it("ignores malformed values instead of failing", () => {
    const parsed = parseQuery(new URLSearchParams("from=2026-02-30&sort=random&length=99&ids=a,,b,<x>&date=nope"));
    expect(parsed.from).toBeNull();
    expect(parsed.sort).toBe("newest");
    expect(parsed.length).toBeNull();
    expect(parsed.ids).toEqual(["a", "b"]);
    expect(parsed.date).toBeNull();
  });

  it("hides archived sessions unless asked, and counts the active filters", () => {
    const { rows, b } = fixture();
    expect(filterRows(rows, DEFAULT_QUERY)).toHaveLength(2);
    expect(filterRows(rows, query({ archived: true })).map((r) => r.session.id)).toContain(b.session.id);
    expect(activeFilterCount(query({ archived: true, from: "2026-10-01", to: "2026-10-31", tag: "x" }))).toBe(3);
  });

  it("searches title, notes, tags, place and project; every word must match", () => {
    const { rows, a, b } = fixture();
    expect(matchesSearch(b, "cold room")).toBe(true);
    expect(matchesSearch(a, "#night office")).toBe(true);
    expect(matchesSearch(a, "client")).toBe(true);
    expect(matchesSearch(a, "night kitchen")).toBe(false);
    expect(filterRows(rows, query({ q: "inventory", archived: true })).map((r) => r.session.id)).toEqual([b.session.id]);
  });

  it("filters by date range (touching), project, tag, place, length and origin", () => {
    const { rows, a, c } = fixture();
    const ids = (q: Partial<SessionQuery>) => filterRows(rows, query(q)).map((r) => r.session.id);
    expect(ids({ from: "2026-10-27", to: "2026-10-27" })).toEqual([a.session.id]); // touches Tue via its second day
    expect(ids({ project: project.id })).toEqual([a.session.id]);
    expect(ids({ project: "none" })).toEqual([c.session.id]);
    expect(ids({ tag: "night" })).toEqual([a.session.id]);
    expect(ids({ place: "unlabelled" })).toEqual([c.session.id]);
    expect(ids({ length: "12-16" }).sort()).toEqual([a.session.id, c.session.id].sort());
    expect(ids({ origin: "timer" })).toEqual([]);
    expect(lengthOf(8 * 3_600_000 - 1)).toBe("lt8");
    expect(lengthOf(16 * 3_600_000)).toBe("16plus");
  });

  it("drill-downs: ids shows exactly those (archived too); date shows sessions that put time on it", () => {
    const { rows, a, b } = fixture();
    expect(filterRows(rows, query({ ids: [b.session.id], length: "16plus" })).map((r) => r.session.id)).toEqual([b.session.id]);
    expect(
      filterRows(rows, query({ date: "2026-10-27" }))
        .map((r) => r.session.id)
        .sort(),
    ).toEqual([a.session.id, b.session.id].sort());
  });

  it("sorts and groups by start date; length sorts are one flat group", () => {
    const { rows, a, b, c } = fixture();
    const newest = sortRows(rows, "newest");
    expect(newest.map((r) => r.session.id)).toEqual([c.session.id, b.session.id, a.session.id]);
    expect(sortRows(rows, "longest")[0].session.id).toBe(a.session.id);
    expect(sortRows(rows, "shortest")[0].session.id).toBe(b.session.id);
    const groups = groupRows(newest, "newest", "2026-10-28");
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["Mon 26 Oct", 1],
    ]);
    expect(groupRows(sortRows(rows, "longest"), "longest", "2026-10-28")).toHaveLength(1);
  });

  it("offers filter options from the data", () => {
    const { rows } = fixture();
    const o = filterOptions(rows);
    expect(o.tags).toEqual(["night"]);
    expect(o.places.map((p) => p.label)).toEqual(["Office", "Unlabelled spot", "Not captured"]);
  });
});
