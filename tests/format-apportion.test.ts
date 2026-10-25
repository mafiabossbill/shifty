import { describe, expect, it } from "vitest";

import { apportionMinutes, formatDuration, formatDurationParts } from "@/lib/format";
import { durationsByRow } from "@/lib/insights/labels";

const M = 60_000;
const H = 60 * M;

describe("apportioned durations (QA-M2: parts add up to the total shown)", () => {
  it("Mon 18:00:30 → Tue 01:12:30: days sum to 7h 12m", () => {
    const parts = [5 * H + 59.5 * M, 1 * H + 12.5 * M];
    expect(formatDuration(parts[0] + parts[1])).toBe("7h 12m");
    expect(parts.map((p) => formatDuration(p))).toEqual(["5h 59m", "1h 12m"]); // the bug: 7h 11m
    expect(formatDurationParts(parts)).toEqual(["5h 59m", "1h 13m"]);
  });

  it("always sums to the floored total, each part within a minute of its true value", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 500; n++) {
      const parts = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => Math.floor(rand() * 10 * H));
      const minutes = apportionMinutes(parts);
      expect(minutes.reduce((s, m) => s + m, 0)).toBe(Math.floor(parts.reduce((s, p) => s + p, 0) / M));
      minutes.forEach((m, i) => expect(m - Math.floor(parts[i] / M)).toBeGreaterThanOrEqual(0));
      minutes.forEach((m, i) => expect(m - Math.floor(parts[i] / M)).toBeLessThanOrEqual(1));
    }
  });

  it("keeps exact parts and zeros as they are; ignores negatives", () => {
    expect(apportionMinutes([6 * H, 9.5 * H])).toEqual([360, 570]);
    expect(apportionMinutes([0, 0])).toEqual([0, 0]);
    expect(apportionMinutes([-M, 2 * M])).toEqual([0, 2]);
    expect(apportionMinutes([])).toEqual([]);
  });

  it("earlier parts don't move while the last one grows (a running shift)", () => {
    const mon = 5 * H + 59.5 * M;
    for (let s = 0; s < 180; s++) expect(apportionMinutes([mon, H + s * 1000])[0]).toBe(359);
  });

  it("durationsByRow keys an Insights table's cells so its rows add up to its Total", () => {
    const rows = [
      { date: "2026-10-19", netMs: 5 * H + 59.5 * M },
      { date: "2026-10-20", netMs: H + 12.5 * M },
      { date: "2026-10-21", netMs: 0 },
    ];
    const text = durationsByRow(rows, (r) => r.date, (r) => r.netMs);
    expect([...text.values()]).toEqual(["5h 59m", "1h 13m", "0m"]);
    expect(text.get("2026-10-20")).toBe("1h 13m");
  });
});
