import { describe, expect, it } from "vitest";

import { deltaSentence, modeExplanation, rangeLabel, sessionsHref, spanLabel, clockLabel } from "@/lib/insights/labels";
import { DEFAULT_PARAMS, MAX_CUSTOM_DAYS, parseParams, resolveRange, stepParams, toQuery, withRangeKind } from "@/lib/insights/params";
import { daysBetween } from "@/lib/time/zone";

const q = (s: string) => new URLSearchParams(s);
const TODAY = "2026-10-28";

describe("insights URL state", () => {
  it("defaults and junk", () => {
    expect(parseParams(q(""))).toEqual(DEFAULT_PARAMS);
    expect(parseParams(q("range=decade&mode=x&heat=12&date=2026-02-30&session=<script>"))).toEqual(DEFAULT_PARAMS);
    expect(toQuery(DEFAULT_PARAMS)).toBe("");
  });

  it("round-trips", () => {
    const p = parseParams(q("range=custom&from=2026-09-01&to=2026-10-15&mode=start&heat=30"));
    expect(p).toMatchObject({ range: "custom", from: "2026-09-01", to: "2026-10-15", mode: "start", heat: 30 });
    expect(parseParams(q(toQuery(p)))).toEqual(p);
  });

  it("custom ranges are ordered and capped", () => {
    expect(resolveRange(parseParams(q("range=custom&from=2026-10-10&to=2026-10-01")), TODAY, 1)).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    const huge = resolveRange(parseParams(q("range=custom&from=2000-01-01&to=2026-10-01")), TODAY, 1);
    expect(daysBetween(huge.from, huge.to) + 1).toBe(MAX_CUSTOM_DAYS);
    expect(resolveRange(parseParams(q("range=custom")), TODAY, 1)).toEqual({ from: "2026-09-29", to: TODAY });
  });

  it("prev/next across month and year boundaries; back to now drops the date", () => {
    const week = { ...DEFAULT_PARAMS };
    const r = resolveRange(week, TODAY, 1);
    const prev = stepParams(week, r, -1, TODAY, 1);
    expect(resolveRange(prev, TODAY, 1)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(stepParams(prev, resolveRange(prev, TODAY, 1), 1, TODAY, 1).date).toBeNull();
    const month = { ...DEFAULT_PARAMS, range: "month" as const, date: "2026-01-10" };
    const dec = stepParams(month, resolveRange(month, TODAY, 1), -1, TODAY, 1);
    expect(resolveRange(dec, TODAY, 1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    const year = { ...DEFAULT_PARAMS, range: "year" as const };
    expect(resolveRange(stepParams(year, resolveRange(year, TODAY, 1), -1, TODAY, 1), TODAY, 1)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    const custom = { ...DEFAULT_PARAMS, range: "custom" as const, from: "2026-10-01", to: "2026-10-10" };
    expect(stepParams(custom, resolveRange(custom, TODAY, 1), 1, TODAY, 1)).toMatchObject({ from: "2026-10-11", to: "2026-10-20" });
  });

  it("switching kind keeps the period in view", () => {
    const p = { ...DEFAULT_PARAMS, date: "2026-09-01" };
    const r = resolveRange(p, TODAY, 1);
    expect(resolveRange(withRangeKind(p, "month", r, TODAY), TODAY, 1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(withRangeKind(p, "custom", r, TODAY)).toMatchObject({ from: r.from, to: r.to });
    expect(withRangeKind(DEFAULT_PARAMS, "month", resolveRange(DEFAULT_PARAMS, TODAY, 1), TODAY).date).toBeNull();
  });
});

describe("insights copy", () => {
  it("range labels", () => {
    expect(rangeLabel({ from: TODAY, to: TODAY }, "today", TODAY)).toBe("Today");
    expect(rangeLabel({ from: "2026-10-26", to: "2026-11-01" }, "week", TODAY)).toBe("26 Oct – 1 Nov");
    expect(rangeLabel({ from: "2026-10-19", to: "2026-10-25" }, "week", TODAY)).toBe("19–25 Oct");
    expect(rangeLabel({ from: "2026-10-01", to: "2026-10-31" }, "month", TODAY)).toBe("October 2026");
    expect(rangeLabel({ from: "2025-01-01", to: "2025-12-31" }, "year", TODAY)).toBe("2025");
    expect(spanLabel("2025-12-29", "2026-01-04", "2026")).toBe("29 Dec 2025 – 4 Jan 2026");
  });

  it("mode explanation, neutral deltas, links, clock labels", () => {
    expect(modeExplanation("calendar")).toBe("A shift from Mon 18:00 to Tue 10:00 counts 6h on Monday and 10h on Tuesday.");
    expect(modeExplanation("start", "12h")).toContain("all 16h on Monday");
    expect(deltaSentence(4.5 * 3_600_000, "the same days last month")).toBe("4h 30m more than the same days last month");
    expect(deltaSentence(-30 * 60_000, "x")).toBe("30m less than x");
    expect(deltaSentence(0, "x")).toBe("The same as x");
    expect(sessionsHref([])).toBeNull();
    expect(sessionsHref(["a"])).toBe("/sessions/view?id=a");
    expect(sessionsHref(["a", "b"])).toBe("/sessions?ids=a,b");
    const many = Array.from({ length: 501 }, (_, i) => `id${i}`);
    expect(sessionsHref(many, { from: "2024-01-01", to: "2026-10-28" })).toBe("/sessions?from=2024-01-01&to=2026-10-28");
    expect(clockLabel(18 * 60)).toBe("18:00");
    expect(clockLabel(18 * 60 + 15, "12h")).toBe("6:15pm");
    expect(clockLabel(0, "12h")).toBe("12am");
  });
});
