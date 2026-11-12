import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkDesign, formatReport } from "../scripts/design-check";
import { SCREENS, galleryRoutes } from "@/lib/design-gallery";
import { ELEVATIONS, TYPE_SCALE, cn } from "@/lib/utils";

/** Every signed-in route: folders under src/app/(app) that hold a page, route groups removed. */
function appRoutes(dir = path.join(process.cwd(), "src/app/(app)"), prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) routes.push(...appRoutes(full, /^\(.*\)$/.test(name) ? prefix : `${prefix}/${name}`));
    else if (name === "page.tsx" && prefix) routes.push(prefix);
  }
  return routes;
}

const pageFile = (route: string) => path.join(process.cwd(), "src/app", route, "page.tsx");

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
    expect(missing, `Add these screens to src/lib/design-gallery.ts (a gallery page, or an exemption with its reason): ${missing.join(", ")}`).toEqual([]);
    const stale = Object.keys(SCREENS).filter((route) => !existsSync(pageFile(`(app)${route}`)));
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
});
