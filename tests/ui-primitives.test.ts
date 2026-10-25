import { describe, expect, it } from "vitest";

import { ringGeometry } from "@/components/ui/progress-ring";
import { SESSION_STATUS, SYNC_STATE, TONES } from "@/components/ui/status-pill";
import { MAIN_NAV, titleFor } from "@/lib/nav";
import { ACCENTS, THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

describe("ProgressRing geometry", () => {
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
    expect(SESSION_STATUS.active.tone).toBe("accent");
    expect(SESSION_STATUS.on_break.tone).toBe("celebrate");
    expect(SESSION_STATUS.completed.tone).toBe("success");
  });
});

describe("navigation", () => {
  it("has the five tabs in order, Home first, and titles by prefix", () => {
    expect(MAIN_NAV.map((n) => n.href)).toEqual(["/", "/sessions", "/insights", "/companion", "/settings"]);
    expect(titleFor("/")).toBe("Home");
    expect(titleFor("/sessions/abc")).toBe("Sessions");
    expect(titleFor("/settings/privacy")).toBe("Settings");
    expect(titleFor("/design")).toBe("Design");
  });
});

describe("appearance", () => {
  it("paints the app background as the browser color and applies accent + motion before first paint", () => {
    expect(THEME_COLORS).toEqual({ light: "#fbf8f1", dark: "#0c0a18" });
    expect(THEME_INIT_SCRIPT).toContain("data-accent");
    expect(THEME_INIT_SCRIPT).toContain("data-motion");
    for (const accent of ACCENTS) expect(THEME_INIT_SCRIPT).toContain(accent);
  });
});
