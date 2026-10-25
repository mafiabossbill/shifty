import { describe, expect, it } from "vitest";

import { CATALOG, unlockedKeys } from "@/components/mochi/catalog";
import { ACHIEVEMENTS } from "@/lib/rewards";
import { achievementRows, equippedLook, itemsOf, parseSeen, timeOfDayFor, toggleDecor, unlockHint, unseenAchievements, MAX_DECOR } from "@/lib/settings/companion";
import { ledgerLine, signedXp, xpLog } from "@/lib/settings/ledger";
import { defaultCompanion, type LedgerEntry } from "@/lib/shifts/profile";

const DAR = "Africa/Dar_es_Salaam";
const name = (code: string) => ACHIEVEMENTS.find((a) => a.code === code)?.name;
const SID = "00000000-0000-4000-8000-000000000001";

describe("xp log wording", () => {
  const at = Date.UTC(2026, 9, 26, 9); // Mon 26 Oct, 12:00 in Dar
  const rows: LedgerEntry[] = [
    { key: `complete:${SID}#1`, rule: "session_completed", xp: 20, sourceSessionId: SID, at },
    { key: `break:${SID}#1`, rule: "healthy_break", xp: 10, sourceSessionId: SID, at },
    { key: "achievement:night_owl#1", rule: "achievement", xp: 30, sourceSessionId: SID, at: at + 1 },
    { key: `complete:${SID}#2`, rule: "reversal", xp: -20, sourceSessionId: SID, at: at + 86_400_000 },
    { key: "rest:2026-10-25#2", rule: "reversal", xp: -5, sourceSessionId: null, at: at + 2 * 86_400_000 },
    { key: "review:2026-10-26#1", rule: "weekly_review", xp: 15, sourceSessionId: null, at: at - 1 },
    { key: "future:thing#1", rule: "whatever", xp: 3, sourceSessionId: null, at: at - 2 },
  ];
  it("says what happened in plain words", () => {
    expect(ledgerLine(rows[0], name).text).toBe("Completed a session");
    expect(ledgerLine(rows[2], name).text).toBe("Earned Night Owl");
    expect(ledgerLine(rows[3], name)).toEqual({ text: "Adjusted after an edit", adjustment: true });
    expect(ledgerLine(rows[4], name)).toEqual({ text: "Adjusted after a change", adjustment: true });
    expect(ledgerLine(rows[5], name).text).toBe("Reviewed your week");
    expect(ledgerLine(rows[6], name).text).toBe("XP");
  });
  it("signs amounts with a real minus", () => {
    expect(signedXp(20)).toBe("+20");
    expect(signedXp(-20)).toBe("−20");
  });
  it("lists newest first with dates in the zone", () => {
    const log = xpLog(rows, DAR, "2026-10-30", name);
    expect(log[0]).toMatchObject({ amount: "−5", dateLabel: "Wed 28 Oct" });
    expect(log.at(-1)?.text).toBe("XP");
    const first = log.find((r) => r.key === `complete:${SID}#1`)!;
    expect(`${first.amount} ${first.text} · ${first.dateLabel}`).toBe("+20 Completed a session · Mon 26 Oct");
  });
  it("adds the year for other years", () => {
    expect(xpLog([rows[0]], DAR, "2027-01-02", name)[0].dateLabel).toBe("Mon 26 Oct 2026");
  });
});

describe("companion view models", () => {
  it("maps the local hour to the habitat's time of day", () => {
    expect(timeOfDayFor(7)).toBe("day");
    expect(timeOfDayFor(18)).toBe("evening");
    expect(timeOfDayFor(23)).toBe("night");
    expect(timeOfDayFor(3)).toBe("night");
  });
  it("words unlock hints", () => {
    const lamp = CATALOG.find((i) => i.key === "lamp")!;
    const cap = CATALOG.find((i) => i.key === "night-cap")!;
    const lilac = CATALOG.find((i) => i.key === "lilac")!;
    expect(unlockHint(lamp, name)).toBe("Level 7");
    expect(unlockHint(cap, name)).toBe("Earn Night Owl");
    expect(unlockHint(lilac, name)).toBeNull();
  });
  it("orders items unlocked first, then by level, achievement items last", () => {
    const unlocked = unlockedKeys(3, ["first_clock_in"]);
    const hats = itemsOf("hat", unlocked, (k) => k === "beanie", name);
    expect(hats.slice(0, 2).map((h) => h.item.key).sort()).toEqual(["beanie", "party-hat"]);
    expect(hats.find((h) => h.item.key === "beanie")?.equipped).toBe(true);
    expect(hats.at(-1)?.unlocked).toBe(false);
    const locked = hats.filter((h) => !h.unlocked).map((h) => h.item.key);
    expect(locked.indexOf("headphones")).toBeLessThan(locked.indexOf("night-cap"));
  });
  it("falls back to defaults for items not unlocked here", () => {
    const c = { ...defaultCompanion(), palette: "midnight", hat: "crown", background: "library", decor: ["plant", "rug", "lamp"] };
    const look = equippedLook(c, unlockedKeys(4, []));
    expect(look).toEqual({ palette: "lilac", hat: "none", accessory: "none", background: "dusk", decor: ["plant", "rug"] });
  });
  it("keeps the room to six decor items", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(MAX_DECOR).toBe(6);
    expect(toggleDecor(six, "g")).toBeNull();
    expect(toggleDecor(six, "a")).toEqual(["b", "c", "d", "e", "f"]);
    expect(toggleDecor(["a"], "b")).toEqual(["a", "b"]);
  });
  it("lists all ten achievements with dates, sources and rewards", () => {
    const rows = achievementRows(ACHIEVEMENTS, [{ code: "night_owl", earnedAt: 5, sourceSessionId: SID }]);
    expect(rows).toHaveLength(10);
    const owl = rows.find((r) => r.code === "night_owl")!;
    expect(owl).toMatchObject({ earned: true, earnedAt: 5, sourceSessionId: SID });
    expect(owl.reward?.key).toBe("night-cap");
    expect(rows.filter((r) => r.earned)).toHaveLength(1);
    expect(rows.every((r) => r.hint.length > 0)).toBe(true);
  });
  it("finds achievements not yet celebrated, newest first, and parses storage defensively", () => {
    const earned = [{ code: "a", earnedAt: 1 }, { code: "b", earnedAt: 3 }, { code: "c", earnedAt: 2 }];
    expect(unseenAchievements(earned, new Set(["a"]))).toEqual(["b", "c"]);
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen("not json")).toEqual(new Set());
    expect(parseSeen('["a", 3, "b"]')).toEqual(new Set(["a", "b"]));
  });
});
