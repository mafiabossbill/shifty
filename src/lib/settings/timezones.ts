/**
 * Timezone picker data: every IANA zone the runtime knows, grouped by region, searchable by city, region
 * or offset ("dar", "london", "gmt+3", "+5:30"). Pure apart from reading the runtime's zone list.
 */
import { offsetMs } from "@/lib/time/zone";

export interface ZoneOption {
  id: string;
  /** "Dar es Salaam" */
  city: string;
  /** "Africa" (or "Other" for ids without a region, e.g. UTC) */
  region: string;
  /** "GMT+3", "GMT−5:30", "GMT" */
  offset: string;
  offsetMinutes: number;
}

const FALLBACK_ZONES = [
  "Africa/Dar_es_Salaam", "Africa/Nairobi", "Africa/Kampala", "Africa/Lagos", "Africa/Johannesburg", "Africa/Cairo",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "UTC",
];

/** All zone ids from the runtime (plus UTC), or a short fallback list on old engines. */
export function runtimeZones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    const list = intl.supportedValuesOf?.("timeZone");
    if (list && list.length > 0) return list.includes("UTC") ? [...list] : [...list, "UTC"];
  } catch {
    // older engine: fall through
  }
  return [...FALLBACK_ZONES];
}

/** "GMT+3", "GMT−5:30", "GMT" (U+2212 minus, like a clock app). */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return "GMT";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export function zoneOption(id: string, now: number): ZoneOption {
  const slash = id.indexOf("/");
  const region = slash > 0 ? id.slice(0, slash) : "Other";
  const city = (slash > 0 ? id.slice(id.lastIndexOf("/") + 1) : id).replace(/_/g, " ");
  let offsetMinutes = 0;
  try {
    offsetMinutes = Math.round(offsetMs(now, id) / 60_000);
  } catch {
    offsetMinutes = 0;
  }
  return { id, city, region, offset: offsetLabel(offsetMinutes), offsetMinutes };
}

export function zoneOptions(ids: readonly string[], now: number): ZoneOption[] {
  return ids.map((id) => zoneOption(id, now)).sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city));
}

/** A readable name for a zone: "Dar es Salaam · Africa · GMT+3". */
export function zoneDisplay(id: string, now: number): string {
  const z = zoneOption(id, now);
  return z.region === "Other" ? `${z.city} · ${z.offset}` : `${z.city} · ${z.region} · ${z.offset}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[_/]/g, " ").replace(/−/g, "-").replace(/\s+/g, " ").trim();

/** Offset queries: "gmt+3", "utc-5", "+5:30", "-3". Returns minutes or null when the query isn't one. */
export function parseOffsetQuery(query: string): number | null {
  const m = /^(?:gmt|utc)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/.exec(norm(query));
  if (!m) return /^(gmt|utc)$/.test(norm(query)) ? 0 : null;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/**
 * Filters zones by the query. Exact city starts rank first, then any word match, then region matches.
 * An offset query returns every zone at that offset. Empty query returns everything.
 */
export function searchZones(options: readonly ZoneOption[], query: string): ZoneOption[] {
  const q = norm(query);
  if (!q) return [...options];
  const offset = parseOffsetQuery(q);
  if (offset !== null) return options.filter((o) => o.offsetMinutes === offset);
  const scored: { o: ZoneOption; score: number }[] = [];
  for (const o of options) {
    const city = norm(o.city);
    const id = norm(o.id);
    let score = -1;
    if (city.startsWith(q)) score = 0;
    else if (city.split(" ").some((w) => w.startsWith(q))) score = 1;
    else if (id.includes(q)) score = 2;
    if (score >= 0) scored.push({ o, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.o.city.localeCompare(b.o.city)).map((s) => s.o);
}

/** Groups (already filtered) options by region, regions in alphabetical order, "Other" last. */
export function groupZones(options: readonly ZoneOption[]): { region: string; zones: ZoneOption[] }[] {
  const map = new Map<string, ZoneOption[]>();
  for (const o of options) map.set(o.region, [...(map.get(o.region) ?? []), o]);
  return [...map.entries()]
    .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
    .map(([region, zones]) => ({ region, zones }));
}
