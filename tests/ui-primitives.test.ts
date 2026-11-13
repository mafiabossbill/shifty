import { describe, expect, it } from "vitest";

import { barGeometry } from "@/components/ui/progress-bar";
import { ringGeometry } from "@/components/ui/progress-ring";
import { SESSION_STATUS, SYNC_STATE, TONES } from "@/components/ui/status-pill";
import { MAIN_NAV, titleFor } from "@/lib/nav";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

describe("ProgressBar geometry", () => {
  it("fills toward the goal and never goes negative or past the end", () => {
    expect(barGeometry({ value: 0.5 }).goalPercent).toBeCloseTo(50);
    expect(barGeometry({ value: 1.4 }).goalPercent).toBeCloseTo(100);
    expect(barGeometry({ value: -1 }).goalPercent).toBe(0);
    expect(barGeometry({ value: Number.NaN }).goalPercent).toBe(0);
  });

  it("draws overage as its own part on the same bar, and only once the goal is reached", () => {
    const g = barGeometry({ value: 1, overage: 0.25 });
    expect(g.goalPercent).toBeCloseTo(80);
    expect(g.overPercent).toBeCloseTo(20);
    expect(g.goalPercent + g.overPercent).toBeCloseTo(100);
    // Capped at one more goal's worth for drawing.
    expect(barGeometry({ value: 1, overage: 3 }).overPercent).toBeCloseTo(50);
    expect(barGeometry({ value: 0.9, overage: 0.25 }).overPercent).toBe(0);
  });
});

describe("ProgressRing geometry (retired, kept until Home and session detail are converted)", () => {
  it("caps the goal arc at 100% and never goes negative", () => {
    expect(ringGeometry({ value: 1.4, size: 200 }).offset).toBeCloseTo(0);
    expect(ringGeometry({ value: -1, size: 200 }).progress).toBe(0);
    expect(ringGeometry({ value: Number.NaN, size: 200 }).progress).toBe(0);
    const half = ringGeometry({ value: 0.5, size: 200 });
    expect(half.offset).toBeCloseTo(half.circumference / 2);
  });

  it("draws overage as a separate inner arc, capped for drawing", () => {
    const g = ringGeometry({ value: 1, overage: 0.25, size: 200 });
    expect(g.innerRadius).toBeLessThan(g.radius - g.stroke / 2);
    expect(g.innerOffset).toBeCloseTo(g.innerCircumference * 0.75);
    expect(ringGeometry({ value: 1, overage: 3, size: 200 }).over).toBe(1);
  });
});

describe("tone map", () => {
  it("maps every session and sync state to a known tone", () => {
    for (const s of Object.values(SESSION_STATUS)) expect(TONES[s.tone]).toBeDefined();
    for (const s of Object.values(SYNC_STATE)) expect(TONES[s.tone]).toBeDefined();
  });

  it("uses the status colours for what they mean: in progress, waiting, done", () => {
    expect(SESSION_STATUS.active.tone).toBe("info");
    expect(SESSION_STATUS.on_break.tone).toBe("warning");
    expect(SESSION_STATUS.completed.tone).toBe("success");
    expect(SYNC_STATE.needs_attention.tone).toBe("warning");
    expect(Object.keys(TONES).sort()).toEqual(["danger", "info", "neutral", "success", "warning"]);
  });
});

describe("navigation", () => {
  it("has the five tabs in order, Home first, and titles by prefix", () => {
    expect(MAIN_NAV.map((n) => n.href)).toEqual(["/", "/sessions", "/insights", "/companion", "/settings"]);
    expect(titleFor("/")).toBe("Home");
    expect(titleFor("/sessions/abc")).toBe("Sessions");
    expect(titleFor("/settings/privacy")).toBe("Settings");
  });
});

describe("appearance", () => {
  it("paints the app background as the browser colour and applies theme and motion before first paint", () => {
    expect(THEME_COLORS).toEqual({ light: "#ffffff", dark: "#0c0e15" });
    expect(THEME_INIT_SCRIPT).toContain("data-motion");
    expect(THEME_INIT_SCRIPT).toContain(THEME_COLORS.dark);
    // One action colour (R-D5): no accent reaches the page.
    expect(THEME_INIT_SCRIPT).not.toContain("data-accent");
  });
});
