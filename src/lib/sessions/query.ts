/**
 * The Sessions list query: everything lives in the URL (search, filters, sort, drill-downs), so a view can
 * be shared, bookmarked and reached from Insights. Pure: parse → filter → sort → group.
 *
 *   ?q=           search title, notes, tags, place, project (every word must match)
 *   ?from= &to=   sessions that touch these local dates (YYYY-MM-DD)
 *   ?project=     project id, or `none`
 *   ?tag=  ?place= (place key: `place:<label>` · `unlabelled` · `none`)
 *   ?length=      lt8 · 8-12 · 12-16 · 16plus (net hours)
 *   ?origin=      manual · timer
 *   ?archived=1   include archived sessions
 *   ?sort=        newest (default) · oldest · longest · shortest
 *   ?ids=a,b,c    drill-down: exactly these sessions (other filters ignored)
 *   ?date=        drill-down: sessions that put time on this local date (archived included)
 */
import { relativeDay } from "@/lib/format";
import { isLocalDate, type LocalDate } from "@/lib/time/zone";

import type { SessionRow } from "./rows";

export const SORTS = ["newest", "oldest", "longest", "shortest"] as const;
export type SortKey = (typeof SORTS)[number];
export const LENGTHS = ["lt8", "8-12", "12-16", "16plus"] as const;
export type LengthKey = (typeof LENGTHS)[number];
export type OriginKey = "manual" | "timer";

export const SORT_LABELS: Record<SortKey, string> = { newest: "Newest first", oldest: "Oldest first", longest: "Longest first", shortest: "Shortest first" };
export const LENGTH_LABELS: Record<LengthKey, string> = { lt8: "Under 8h", "8-12": "8–12h", "12-16": "12–16h", "16plus": "16h+" };

export interface SessionQuery {
  q: string;
  from: LocalDate | null;
  to: LocalDate | null;
  project: string | null;
  tag: string | null;
  place: string | null;
  length: LengthKey | null;
  origin: OriginKey | null;
  archived: boolean;
  sort: SortKey;
  ids: string[] | null;
  date: LocalDate | null;
}

export const DEFAULT_QUERY: SessionQuery = {
  q: "",
  from: null,
  to: null,
  project: null,
  tag: null,
  place: null,
  length: null,
  origin: null,
  archived: false,
  sort: "newest",
  ids: null,
  date: null,
};

interface ParamsLike {
  get(name: string): string | null;
}

const MAX_IDS = 500;

function oneOf<T extends string>(value: string | null, options: readonly T[]): T | null {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : null;
}

const text = (value: string | null, max = 120) => (value ?? "").trim().slice(0, max) || null;

/** Lenient: unknown or malformed values are ignored, never an error page. */
export function parseQuery(params: ParamsLike): SessionQuery {
  const date = (key: string) => {
    const v = params.get(key);
    return isLocalDate(v) ? v : null;
  };
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-zA-Z-]{1,64}$/.test(s));
  return {
    q: (params.get("q") ?? "").slice(0, 120),
    from: date("from"),
    to: date("to"),
    project: text(params.get("project"), 64),
    tag: text(params.get("tag"), 32)?.toLowerCase() ?? null,
    place: text(params.get("place"), 80),
    length: oneOf(params.get("length"), LENGTHS),
    origin: oneOf(params.get("origin"), ["manual", "timer"] as const),
    archived: params.get("archived") === "1",
    sort: oneOf(params.get("sort"), SORTS) ?? "newest",
    ids: ids.length ? [...new Set(ids)].slice(0, MAX_IDS) : null,
    date: date("date"),
  };
}

/** Only non-default values, in a stable order. Returns "" or "?a=b&…". */
export function serializeQuery(query: SessionQuery): string {
  const p = new URLSearchParams();
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.ids?.length) p.set("ids", query.ids.join(","));
  if (query.date) p.set("date", query.date);
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  if (query.project) p.set("project", query.project);
  if (query.tag) p.set("tag", query.tag);
  if (query.place) p.set("place", query.place);
  if (query.length) p.set("length", query.length);
  if (query.origin) p.set("origin", query.origin);
  if (query.archived) p.set("archived", "1");
  if (query.sort !== "newest") p.set("sort", query.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Count of the filters in the Filters sheet (search, sort and drill-downs excluded). */
export function activeFilterCount(query: SessionQuery): number {
  return [query.from || query.to, query.project, query.tag, query.place, query.length, query.origin, query.archived].filter(Boolean).length;
}

export function clearFilters(query: SessionQuery): SessionQuery {
  return { ...DEFAULT_QUERY, sort: query.sort };
}

export function lengthOf(netMs: number): LengthKey {
  const h = netMs / 3_600_000;
  if (h < 8) return "lt8";
  if (h < 12) return "8-12";
  if (h < 16) return "12-16";
  return "16plus";
}

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function searchText(row: SessionRow): string {
  const s = row.session;
  return normalize([row.title, s.title, s.notes, s.tags.join(" "), row.place.label ?? "", row.project?.name ?? ""].join(" \u0000 "));
}

/** Every word must appear somewhere ("#night office" works too). */
export function matchesSearch(row: SessionRow, q: string): boolean {
  const words = normalize(q)
    .split(/\s+/)
    .map((w) => w.replace(/^#/, ""))
    .filter(Boolean);
  if (words.length === 0) return true;
  const hay = searchText(row);
  return words.every((w) => hay.includes(w));
}

export function touchesRange(row: SessionRow, from: LocalDate | null, to: LocalDate | null): boolean {
  if (!from && !to) return true;
  return row.days.some((d) => (!from || d.date >= from) && (!to || d.date <= to));
}

export function filterRows(rows: readonly SessionRow[], query: SessionQuery): SessionRow[] {
  if (query.ids) {
    const wanted = new Set(query.ids);
    return rows.filter((r) => wanted.has(r.session.id));
  }
  return rows.filter((r) => {
    const s = r.session;
    if (query.date) {
      if (!r.days.some((d) => d.date === query.date)) return false;
    } else if (!query.archived && s.archivedAt !== null) return false;
    if (!touchesRange(r, query.from, query.to)) return false;
    if (query.project && (query.project === "none" ? s.projectId !== null : s.projectId !== query.project)) return false;
    if (query.tag && !s.tags.includes(query.tag)) return false;
    if (query.place && r.place.key !== query.place) return false;
    if (query.length && lengthOf(r.metrics.netMs) !== query.length) return false;
    if (query.origin && s.origin !== query.origin) return false;
    return matchesSearch(r, query.q);
  });
}

export function sortRows(rows: readonly SessionRow[], sort: SortKey): SessionRow[] {
  const byStart = (a: SessionRow, b: SessionRow) => a.session.startedAt - b.session.startedAt || a.session.id.localeCompare(b.session.id);
  const out = [...rows];
  switch (sort) {
    case "newest":
      return out.sort((a, b) => byStart(b, a));
    case "oldest":
      return out.sort(byStart);
    case "longest":
      return out.sort((a, b) => b.metrics.netMs - a.metrics.netMs || byStart(b, a));
    case "shortest":
      return out.sort((a, b) => a.metrics.netMs - b.metrics.netMs || byStart(b, a));
  }
}

export interface RowGroup {
  /** Anchor date, or "all" for an ungrouped (length-sorted) list. */
  key: string;
  label: string | null;
  rows: SessionRow[];
  netMs: number;
}

/** Date sorts group by anchor (start) date in each session's own zone; length sorts are one flat group. */
export function groupRows(rows: readonly SessionRow[], sort: SortKey, today: LocalDate): RowGroup[] {
  if (sort === "longest" || sort === "shortest") {
    return rows.length ? [{ key: "all", label: null, rows: [...rows], netMs: rows.reduce((s, r) => s + r.metrics.netMs, 0) }] : [];
  }
  const groups: RowGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.key === row.anchor) {
      last.rows.push(row);
      last.netMs += row.metrics.netMs;
    } else {
      groups.push({ key: row.anchor, label: relativeDay(row.anchor, today), rows: [row], netMs: row.metrics.netMs });
    }
  }
  return groups;
}

/** Distinct options for the filter sheet, from the sessions that exist. */
export function filterOptions(rows: readonly SessionRow[]) {
  const tags = new Map<string, number>();
  const places = new Map<string, { key: string; label: string; count: number }>();
  for (const r of rows) {
    for (const t of r.session.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    const key = r.place.key;
    const label = r.place.label ?? "Not captured";
    const p = places.get(key) ?? { key, label, count: 0 };
    p.count++;
    places.set(key, p);
  }
  return {
    tags: [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t),
    places: [...places.values()].sort((a, b) => Number(a.key === "none") - Number(b.key === "none") || b.count - a.count),
  };
}
