/**
 * Demo history for `?demo=1`: ten weeks of believable shifts, generated through the real reducer so every
 * number in the demo is computed exactly like real data. Lives only in memory; it is never stored or synced.
 */
import { applyEvent } from "@/lib/shifts/reducer";
import { defaultCompanion, defaultSettings, type ProfileState } from "@/lib/shifts/profile";
import { EMPTY_STATE, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";
import { addDays, instantFromWallClock, localDateOf, parseLocalDate, weekdayOf } from "@/lib/time/zone";

const H = 3_600_000;
const M = 60_000;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idFactory(seed: number) {
  const r = rng(seed);
  return () => {
    const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
}

export const DEMO_PROJECTS = [
  { name: "Site operations", color: "lilac" },
  { name: "Client work", color: "teal" },
  { name: "Admin", color: "peach" },
] as const;

const PLACES = [
  { label: "Office", latitude: -6.7924, longitude: 39.2083 },
  { label: "Site A", latitude: -6.8161, longitude: 39.2803 },
];

export interface DemoData {
  events: ShiftEvent[];
  state: ShiftState;
  profile: ProfileState;
}

export function buildDemo(now: number, zone: string, weeks = 10): DemoData {
  const r = rng(20261026);
  const newId = idFactory(7);
  const at = (date: string, hour: number, minute: number) => {
    const { year, month, day } = parseLocalDate(date);
    return instantFromWallClock({ year, month, day, hour, minute }, zone);
  };
  const projects = DEMO_PROJECTS.map((p) => ({ id: newId(), name: p.name, color: p.color, archived: false, updatedAt: now }));
  const places = PLACES.map((p) => ({ id: newId(), ...p, radiusM: 250, updatedAt: now }));
  const events: ShiftEvent[] = [];
  let state = EMPTY_STATE;
  const push = (e: ShiftEvent) => {
    const result = applyEvent(state, e);
    if (result.ok) {
      state = result.state;
      events.push(e);
    }
  };
  const base = (t: number) => ({ id: newId(), at: t, recordedAt: t, deviceTimeZone: zone });

  const today = localDateOf(now, zone);
  let lastEnd = 0;
  for (let d = addDays(today, -weeks * 7); d < today; d = addDays(d, 1)) {
    const dow = weekdayOf(d);
    if (dow === 0 || r() < 0.12) continue; // Sundays and a few days off
    const evening = r() < 0.7;
    const startHour = evening ? 16 + Math.floor(r() * 4) : 6 + Math.floor(r() * 3);
    const start = Math.max(at(d, startHour, Math.floor(r() * 4) * 15), lastEnd + 2 * H);
    const lengthMs = (evening ? 12 + r() * 5 : 7 + r() * 4) * H;
    const end = start + Math.round(lengthMs / M) * M;
    if (end > now - H) break;
    const sessionId = newId();
    const project = projects[Math.floor(r() * projects.length)];
    const place = places[Math.floor(r() * places.length)];
    push({ ...base(start), type: "clock_in", sessionId, goalSeconds: 16 * 3600, reportingTimeZone: zone, projectId: project.id, tags: r() < 0.3 ? ["night"] : [] });
    if (r() < 0.85) {
      push({
        ...base(start + 20_000),
        type: "location",
        sessionId,
        fix: { id: newId(), event: "clock_in", status: "captured", requestedAt: start, capturedAt: start + 9_000, latitude: place.latitude + (r() - 0.5) / 500, longitude: place.longitude + (r() - 0.5) / 500, accuracyM: 8 + Math.floor(r() * 40), placeLabel: place.label },
      });
    } else {
      push({ ...base(start + 15_000), type: "location", sessionId, fix: { id: newId(), event: "clock_in", status: "denied", requestedAt: start, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null } });
    }
    const breaks = lengthMs > 9 * H ? 2 : 1;
    for (let b = 0; b < breaks; b++) {
      const bStart = start + Math.round(((b + 1) / (breaks + 1)) * lengthMs + (r() - 0.5) * H);
      const bLen = (15 + Math.floor(r() * 4) * 10) * M;
      const breakId = newId();
      push({ ...base(bStart), type: "break_start", sessionId, breakId, kind: b === 0 && breaks > 1 ? "meal" : "rest" });
      push({ ...base(bStart + bLen), type: "break_end", sessionId, breakId });
    }
    push({ ...base(end), type: "clock_out", sessionId });
    if (r() < 0.25) push({ ...base(end + M), type: "annotate", sessionId, changes: { mood: 3 + Math.floor(r() * 3), energy: 2 + Math.floor(r() * 4) } });
    lastEnd = end;
  }
  // One correction with its audit trail, so the history view has something real to show.
  const corrected = Object.values(state.sessions)[3];
  if (corrected) {
    push({ ...base(corrected.endedAt! + 10 * M), type: "correct", sessionId: corrected.id, expectedRevision: corrected.revision, reason: "Forgot to clock in when I arrived", startedAt: corrected.startedAt - 20 * M });
  }

  const settings = { ...defaultSettings(zone, now), displayName: "Bill" };
  return {
    events,
    state,
    profile: { settings, projects, places, activities: [{ id: "demo-review", type: "week_review", key: addDays(today, -7), at: now - 6 * 86_400_000 }], companion: defaultCompanion(now), ledger: [], achievements: [] },
  };
}

/** `?demo=1` turns demo on for the tab; `?demo=0` turns it off. */
export function demoRequested(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1") window.sessionStorage.setItem("shifty-demo", "1");
    if (param === "0") window.sessionStorage.removeItem("shifty-demo");
    return window.sessionStorage.getItem("shifty-demo") === "1";
  } catch {
    return false;
  }
}

export function exitDemo() {
  try {
    window.sessionStorage.removeItem("shifty-demo");
  } catch {
    // storage blocked: the reload below still drops the in-memory demo
  }
  window.location.assign(window.location.pathname);
}

