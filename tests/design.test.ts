import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import tailwindColors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";

import { checkDesign, formatReport } from "../scripts/design-check";
import { PUBLIC_PAGES, SCREENS, SYSTEM_PAGES, galleryRoutes, photographedRoutes } from "@/lib/design-gallery";
import { ELEVATIONS, TYPE_SCALE, cn } from "@/lib/utils";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

function sourceFiles(dir = "src", out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir)).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(rel);
  }
  return out;
}

/** Every signed-in route: folders under src/app/(app) that hold a page, route groups removed. Home is "/". */
function appRoutes(dir = path.join(ROOT, "src/app/(app)"), prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) routes.push(...appRoutes(full, /^\(.*\)$/.test(name) ? prefix : `${prefix}/${name}`));
    else if (name === "page.tsx") routes.push(prefix || "/");
  }
  return routes;
}

const pageFile = (route: string) => path.join(ROOT, "src/app", route, "page.tsx");

describe("design system", () => {
  it("has no design-check errors (run `npm run design:check` for the list)", () => {
    const report = checkDesign();
    const errors = report.findings.filter((f) => f.level === "error");
    expect(errors, formatReport({ ...report, findings: errors })).toEqual([]);
  });

  it("keeps a size or a shadow from the system when a colour is merged after it", () => {
    for (const step of TYPE_SCALE) expect(cn(`text-${step}`, "text-muted-foreground")).toBe(`text-${step} text-muted-foreground`);
    for (const level of ELEVATIONS) expect(cn(`shadow-${level}`, "shadow-none")).toBe("shadow-none");
    expect(cn("text-caption", "text-body")).toBe("text-body");
  });
});

describe("design gallery", () => {
  it("shows every signed-in screen with sample data, or says why not", () => {
    const missing = appRoutes().filter((route) => !(route in SCREENS));
    expect(missing, `Add these screens to their area's file in src/lib/design-gallery/ (a gallery page, or an exemption with its reason): ${missing.join(", ")}`).toEqual([]);
    const stale = Object.keys(SCREENS).filter((route) => !existsSync(pageFile(`(app)${route === "/" ? "" : route}`)));
    expect(stale, `These entries have no screen any more: ${stale.join(", ")}`).toEqual([]);
  });

  it("has a page for every state it lists", () => {
    const absent = galleryRoutes().filter((route) => !existsSync(pageFile(route)));
    expect(absent, `No page at: ${absent.join(", ")}`).toEqual([]);
    for (const entry of Object.values(SCREENS)) {
      if ("exempt" in entry) expect(entry.exempt.length, "an exemption needs a real reason").toBeGreaterThan(20);
      else expect(entry.states[0]).toBe("default");
    }
  });

  it("photographs the system page first, then the screens, then the public pages", () => {
    expect(SYSTEM_PAGES[0]).toBe("/design");
    expect(photographedRoutes().slice(-PUBLIC_PAGES.length)).toEqual([...PUBLIC_PAGES]);
    for (const route of galleryRoutes()) expect(route.startsWith("/design"), route).toBe(true);
  });

  it("keeps the old design page out of the signed-in area", () => {
    expect(existsSync(path.join(ROOT, "src/app/(app)/design"))).toBe(false);
    expect(read("src/app/design/layout.tsx")).toMatch(/NODE_ENV === "production"\) notFound\(\)/);
  });
});

/*
 * The redesign (factory/REDESIGN.md). A file that has not been converted yet says so in its first
 * lines: `// design-ok-file: awaiting redesign lane R<n> (<area>)`. The lane that owns the file
 * removes the marker when it converts it; from then on the two tests below hold the file to the system.
 */
const AWAITING = /design-ok-file: awaiting redesign lane (R\d)/;

/** Who owns what (factory/REDESIGN.md § Ownership). First match wins. */
const OWNERS: Array<[RegExp, string]> = [
  [/^src\/(components\/(home|session|sync)\/|app\/\(app\)\/(page\.tsx|dashboard\/)|lib\/home\/)/, "R1"],
  [/^src\/(components\/sessions\/|app\/\(app\)\/sessions\/|lib\/sessions\/)/, "R2"],
  [/^src\/(components\/insights\/|app\/\(app\)\/insights\/|lib\/insights\/)/, "R3"],
  [/^src\/(components\/(companion|mochi)\/|app\/\(app\)\/companion\/|lib\/companion\/)/, "R4"],
  [/^src\/(components\/(settings|account|pwa|workspaces)\/|app\/\(app\)\/settings\/|lib\/settings\/)/, "R5"],
];
const ownerOf = (file: string) => OWNERS.find(([pattern]) => pattern.test(file))?.[1] ?? "R0";

/**
 * Names the redesign retired, and what replaces each (the full list with notes:
 * factory/handoffs/redesign-r0.md § Renames). Tailwind draws nothing for a class it does not
 * know, so a leftover would fail silently on screen; this makes it fail here instead.
 */
const HUES = "success|celebrate|danger|info|warning";
const RETIRED: Array<[RegExp, string]> = [
  [/(?<![\w-])type-(?:hero|stat|display|title|eyebrow)(?![\w-])/g, "the type scale: text-display (a key number), text-heading, text-title + font-semibold, text-caption (no capital-letter labels)"],
  [/(?<![\w-])font-display(?![\w-])/g, "nothing: one typeface (font-sans is the default)"],
  [/(?<![\w-])text-2xs(?![\w-])/g, "text-caption (text-micro only in the phone tab bar)"],
  [/(?<![\w-])tabular(?![\w-])/g, "tabular-nums"],
  [/(?<![\w-])rounded-(?:card|control)(?![\w-])/g, "rounded-lg (a box) or rounded-md (a control)"],
  [/(?<![\w-])shadow-(?:card|primary|nav)(?![\w-])/g, "no shadow (boxes sit flat); shadow-raised only on a control"],
  [/(?<![\w-])focus-ring(?![\w-])/g, "nothing: every focusable element gets the ring from globals.css"],
  [/(?<![\w-])animate-live(?![\w-])/g, "nothing: a status does not pulse"],
  [
    new RegExp(`(?<![\\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|accent|caret)-(?:raised|track|glow|border-strong|brand(?:-soft|-strong)?|(?:${HUES})(?:-soft|-ink|-foreground)?)(?![\\w-])`, "g"),
    "semantic tokens (bg-muted, border-control, text-foreground) or a status scale (bg-red-50 text-red-700, bg-amber-50 text-amber-800, bg-emerald-50 text-emerald-700, bg-blue-50 text-blue-700)",
  ],
  [new RegExp(`var\\(--(?:glow|brand|raised|track|border-strong|elev-|r-card|r-control|type-|font-outfit|font-display|(?:${HUES})\\b)`, "g"), "a token that exists in globals.css"],
  [/components\/ui\/progress-ring/g, "ProgressBar from @/components/ui/progress-bar"],
];

describe("redesign markers", () => {
  const files = sourceFiles();
  const head = (file: string) => read(file).split("\n").slice(0, 12).join("\n");

  it("marks an unconverted file with the lane that owns it, and never one of the foundation's own", () => {
    const wrong: string[] = [];
    for (const file of files) {
      const lane = AWAITING.exec(head(file))?.[1];
      if (lane && lane !== ownerOf(file)) wrong.push(`${file}: marked ${lane}, owned by ${ownerOf(file)}`);
    }
    expect(wrong).toEqual([]);
  });

  it("uses no retired name in a converted file", () => {
    const leftovers: string[] = [];
    for (const file of files) {
      if (AWAITING.test(head(file))) continue;
      const lines = read(file).split("\n");
      lines.forEach((line, index) => {
        for (const [pattern, instead] of RETIRED) {
          for (const match of line.matchAll(pattern)) leftovers.push(`${file}:${index + 1}  ${match[0]}  →  ${instead}`);
        }
      });
    }
    expect(leftovers, leftovers.join("\n")).toEqual([]);
  });
});

/* ---- Contrast (WCAG 2.1 AA), computed from the tokens themselves ---- */

/** Relative luminance of `oklch(L C H)` or `#rrggbb`. */
function luminance(color: string): number {
  const channel = (c: number) => Math.min(1, Math.max(0, c));
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  // Tailwind writes lightness as a percentage and a grey's hue as "none".
  const ok = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+|none)/.exec(color.trim());
  if (!ok) throw new Error(`Cannot read the colour "${color}"`);
  const [L, C, H] = [ok[2] ? Number(ok[1]) / 100 : Number(ok[1]), Number(ok[3]), ok[4] === "none" ? 0 : (Number(ok[4]) * Math.PI) / 180];
  const [a, b] = [C * Math.cos(H), C * Math.sin(H)];
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(one: string, other: string): number {
  const [hi, lo] = [luminance(one), luminance(other)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The custom properties of the first block that opens with `opener`, e.g. ":root {". */
function tokens(css: string, opener: string, from = 0): Record<string, string> {
  const start = css.indexOf(opener, from);
  if (start < 0) throw new Error(`No block "${opener}" in globals.css`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe("contrast", () => {
  const css = read("src/app/globals.css");
  const phone = css.indexOf("@media (max-width: 767px) {\n  :root {\n    --text-caption");
  const themes: Record<"light" | "dark", Record<string, string>> = {
    light: { ...tokens(css, ":root {"), phoneMuted: tokens(css, ":root {", phone)["muted-foreground"] },
    dark: { ...tokens(css, ".dark {"), phoneMuted: tokens(css, ".dark {", phone)["muted-foreground"] },
  };
  const WHITE = "#ffffff";

  it("finds the phone step-up of the tokens", () => {
    expect(phone).toBeGreaterThan(0);
    expect(themes.light.phoneMuted).not.toBe(themes.light["muted-foreground"]);
  });

  it.each(Object.entries(themes))("%s: text, field edges and the focus ring meet AA", (_name, t) => {
    expect(contrast(t.foreground, t.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(t["card-foreground"], t.card)).toBeGreaterThanOrEqual(7);
    for (const surface of [t.background, t.card, t.muted, t.accent]) {
      expect(contrast(t["muted-foreground"], surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.phoneMuted, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t["sidebar-foreground"], t.sidebar)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["primary-foreground"], t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(WHITE, t["destructive-strong"])).toBeGreaterThanOrEqual(4.5);
    // Edges that carry meaning (a field, a switch that is off) and the focus ring: 3:1 against the surface.
    for (const surface of [t.background, t.card]) {
      expect(contrast(t.control, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.ring, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.destructive, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("status pills: ink on its tint meets AA in both themes", () => {
    const palette = tailwindColors as unknown as Record<string, Record<string, string>>;
    const dark = themes.dark;
    const pairs: Array<[string, string, string]> = [
      ["neutral", "600", "100"],
      ["blue", "700", "50"],
      ["amber", "800", "50"],
      ["red", "700", "50"],
      ["emerald", "700", "50"],
    ];
    for (const [hue, ink, tint] of pairs) {
      expect(contrast(palette[hue][ink], palette[hue][tint]), `${hue} light`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark[`color-${hue}-${ink}`], dark[`color-${hue}-${tint}`]), `${hue} dark`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
