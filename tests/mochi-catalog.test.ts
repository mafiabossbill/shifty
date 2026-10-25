import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_CODES,
  CATALOG,
  DRAWABLE_KEYS,
  MAX_LEVEL,
  isUnlocked,
  nextUnlocks,
  unlockedKeys,
  type CatalogKind,
} from "@/components/mochi/catalog";
import { moodFor, type MoodInput } from "@/components/mochi/mood";
import { MOODS, PALETTES, PALETTE_KEYS } from "@/components/mochi/parts";

const HOUR = 3_600_000;
const KINDS: CatalogKind[] = ["palette", "hat", "accessory", "background", "decor"];

describe("mochi catalog", () => {
  it("has unique keys", () => {
    const keys = CATALOG.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches what Mochi and the habitat can draw, both ways", () => {
    for (const kind of KINDS) {
      const inCatalog = CATALOG.filter((item) => item.kind === kind).map((item) => item.key).sort();
      expect(inCatalog, kind).toEqual([...DRAWABLE_KEYS[kind]].sort());
    }
    for (const key of PALETTE_KEYS) expect(PALETTES[key].body).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("unlocks the starting set at level 1 and nothing else without achievements", () => {
    const level1 = unlockedKeys(1, []);
    const defaults = CATALOG.filter((item) => "default" in item.unlock).map((item) => item.key);
    expect([...level1].sort()).toEqual([...defaults].sort());
    expect(level1.has("lilac")).toBe(true);
    expect(level1.has("dusk")).toBe(true);
    expect(isUnlocked("none", 1, [])).toBe(true);
    expect(isUnlocked("not-a-thing", 30, [...ACHIEVEMENT_CODES])).toBe(false);
  });

  it("gives achievement items only with their code, whatever the level", () => {
    const achievementItems = CATALOG.filter((item) => "achievement" in item.unlock);
    expect(achievementItems.length).toBeGreaterThan(0);
    for (const item of achievementItems) {
      const code = "achievement" in item.unlock ? item.unlock.achievement : "";
      expect(isUnlocked(item.key, MAX_LEVEL, []), item.key).toBe(false);
      expect(unlockedKeys(MAX_LEVEL, []).has(item.key)).toBe(false);
      expect(isUnlocked(item.key, 1, [code]), item.key).toBe(true);
      expect(unlockedKeys(1, [code]).has(item.key)).toBe(true);
    }
  });

  it("uses only the agreed achievement codes, each exactly once", () => {
    const codes = CATALOG.flatMap((item) => ("achievement" in item.unlock ? [item.unlock.achievement] : []));
    expect([...codes].sort()).toEqual([...ACHIEVEMENT_CODES].sort());
  });

  it("is monotonic in level and keeps levels within 2..30", () => {
    let previous = unlockedKeys(1, []);
    for (let level = 2; level <= MAX_LEVEL + 5; level += 1) {
      const current = unlockedKeys(level, []);
      for (const key of previous) expect(current.has(key), `${key} at ${level}`).toBe(true);
      previous = current;
    }
    for (const item of CATALOG) {
      if ("level" in item.unlock) {
        expect(item.unlock.level).toBeGreaterThanOrEqual(2);
        expect(item.unlock.level).toBeLessThanOrEqual(MAX_LEVEL);
      }
    }
  });

  it("gives something new at least every 2 levels early on", () => {
    for (let level = 1; level < 24; level += 2) {
      const gained = unlockedKeys(level + 2, []).size - unlockedKeys(level, []).size;
      expect(gained, `levels ${level + 1}-${level + 2}`).toBeGreaterThan(0);
    }
    expect(unlockedKeys(MAX_LEVEL, []).has("crown")).toBe(true);
    expect(unlockedKeys(MAX_LEVEL - 1, []).has("crown")).toBe(false);
  });

  it("lists the next level unlocks in order", () => {
    const next = nextUnlocks(1, 3);
    expect(next.map((item) => item.key)).toEqual(["peach", "beanie", "plant"]);
    expect(nextUnlocks(MAX_LEVEL, 5)).toEqual([]);
    expect(nextUnlocks(5, 0)).toEqual([]);
    const levels = nextUnlocks(0, 100).map((item) => ("level" in item.unlock ? item.unlock.level : -1));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels.every((level) => level > 0)).toBe(true);
  });
});

describe("mochi mood", () => {
  const base: MoodInput = { status: "idle", localHour: 10, netMs: 0, goalMs: 16 * HOUR, recentlyCelebrated: false };

  it("only returns known moods and short lines", () => {
    const statuses: MoodInput["status"][] = ["idle", "active", "on_break", "just_finished"];
    for (const status of statuses) {
      for (let hour = 0; hour < 24; hour += 1) {
        for (const netMs of [0, 4 * HOUR, 13 * HOUR, 17 * HOUR]) {
          for (const recentlyCelebrated of [false, true]) {
            const result = moodFor({ ...base, status, localHour: hour, netMs, recentlyCelebrated });
            expect(MOODS).toContain(result.mood);
            expect(result.line.length).toBeLessThanOrEqual(70);
          }
        }
      }
    }
  });

  it("never praises long hours: past the goal it suggests rest", () => {
    const active = moodFor({ ...base, status: "active", netMs: 17 * HOUR });
    expect(["sleepy", "resting"]).toContain(active.mood);
    expect(active.line).toBe("That's a long one. A break or rest would feel good.");
    // Even with a celebration pending, a long session gets the rest message.
    expect(moodFor({ ...base, status: "active", netMs: 17 * HOUR, recentlyCelebrated: true }).mood).toBe("sleepy");
    const finished = moodFor({ ...base, status: "just_finished", netMs: 18 * HOUR, recentlyCelebrated: true });
    expect(finished.mood).toBe("resting");
    for (const result of [active, finished]) expect(result.line).not.toMatch(/great|amazing|awesome|proud|well done/i);
  });

  it("is focused during a normal session and sleepy late at night", () => {
    expect(moodFor({ ...base, status: "active", netMs: 2 * HOUR }).mood).toBe("focused");
    expect(moodFor({ ...base, status: "active", netMs: 2 * HOUR, localHour: 2 }).mood).toBe("sleepy");
    expect(moodFor({ ...base, status: "active", netMs: 13 * HOUR }).mood).toBe("sleepy");
  });

  it("rests on breaks, celebrates unlocks and greets by time of day", () => {
    expect(moodFor({ ...base, status: "on_break" }).mood).toBe("resting");
    expect(moodFor({ ...base, status: "active", netMs: 60_000, recentlyCelebrated: true }).mood).toBe("celebrating");
    expect(moodFor({ ...base, status: "just_finished", netMs: 8 * HOUR }).mood).toBe("proud");
    expect(moodFor({ ...base, localHour: 8 }).mood).toBe("happy");
    expect(moodFor({ ...base, localHour: 14 }).mood).toBe("curious");
    expect(moodFor({ ...base, localHour: 23 }).mood).toBe("sleepy");
  });

  it("handles no goal and odd hours", () => {
    expect(moodFor({ ...base, status: "active", goalMs: 0, netMs: 5 * HOUR }).mood).toBe("focused");
    expect(moodFor({ ...base, status: "active", goalMs: 0, netMs: 13 * HOUR }).mood).toBe("sleepy");
    expect(moodFor({ ...base, localHour: 32 }).mood).toBe("happy");
    expect(moodFor({ ...base, localHour: -1 }).mood).toBe("sleepy");
  });
});
