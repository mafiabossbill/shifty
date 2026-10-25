import { mkdir, writeFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { noPageSideScroll, watchConsole, ZONE } from "./helpers";

/*
 * Visual + accessibility sweep: every main route, empty device and demo data, light and dark, at the project's
 * width (desktop 1280 / 375 / 430). Strict: no page-level sideways scroll, no console errors or hydration
 * warnings, exactly one h1, every button/link has an accessible name, primary controls ≥ 44px on phones.
 * Every smaller touch target is listed in test-results/sweep-<project>.json; screenshots go to screenshots/.
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

const APP_ROUTES = [
  "/",
  "/sessions",
  "/sessions/new",
  "/sessions/trash",
  // "/sessions/view?id=<missing>" is checked in qa-findings.spec.ts (tracked: no h1 on that empty state).
  "/insights",
  "/insights?range=month",
  "/companion",
  "/companion?tab=room",
  "/companion?tab=achievements",
  "/companion?tab=xp",
  "/settings",
  "/settings/sessions",
  "/settings/appearance",
  "/settings/pay",
  "/settings/places",
  "/settings/privacy",
  "/settings/data",
  "/settings/account",
  "/settings/device",
];
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/privacy", "/terms", "/cookies", "/data-deletion"];

interface Report {
  route: string;
  theme: string;
  data: string;
  overflow: { doc: number; main: number };
  h1: string[];
  unnamed: string[];
  smallTargets: string[];
  smallPrimary: string[];
  problems: string[];
}

const reports: Report[] = [];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[aria-hidden=true],[inert]");
    };
    const describe = (el: Element) => {
      const t = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.getAttribute("href") ? `[href=${el.getAttribute("href")}]` : ""} "${t}"`;
    };
    const nameOf = (el: Element): string => {
      const label = el.getAttribute("aria-label");
      if (label?.trim()) return label.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text;
      }
      const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
      if (text) return text;
      const img = el.querySelector("img[alt]");
      if (img?.getAttribute("alt")?.trim()) return img.getAttribute("alt")!.trim();
      const svgTitle = el.querySelector("svg title");
      if (svgTitle?.textContent?.trim()) return svgTitle.textContent.trim();
      if (el.getAttribute("title")?.trim()) return el.getAttribute("title")!.trim();
      const labels = (el as HTMLButtonElement).labels;
      if (labels?.length) return [...labels].map((l) => l.textContent ?? "").join(" ").trim();
      return "";
    };
    const h1 = [...document.querySelectorAll("h1")].filter(visible).map((h) => h.textContent?.trim() ?? "");
    const controls = [...document.querySelectorAll('a[href], button, [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="link"]')].filter(visible);
    const unnamed = controls.filter((el) => !nameOf(el)).map(describe);
    const coarse = matchMedia("(pointer: coarse)").matches;
    const smallTargets: string[] = [];
    const smallPrimary: string[] = [];
    for (const el of controls) {
      // The skip link is visually hidden until focused.
      if (el.getAttribute("href") === "#main") continue;
      // Inline links inside running text are exempt (WCAG 2.5.8 "inline").
      if (el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p,li,span")) continue;
      const r = el.getBoundingClientRect();
      const extended = coarse && el.matches('[data-slot="button"],[data-touch-target]');
      const w = extended ? Math.max(44, r.width) : r.width;
      const h = extended ? Math.max(44, r.height) : r.height;
      if (w < 43.5 || h < 43.5) {
        const entry = `${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`;
        smallTargets.push(entry);
        const primary = el.closest("nav") !== null || /^(Clock in|Clock out|Start break|End break|Add session|Save|Save correction|Edit times)$/.test(nameOf(el));
        if (primary) smallPrimary.push(entry);
      }
    }
    return { h1, unnamed, smallTargets, smallPrimary, coarse };
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const data of ["empty", "demo"] as const) {
    test(`sweep: app routes, ${data} data, ${theme}`, async ({ page }, info) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: theme });
      const problems = watchConsole(page);
      if (data === "demo") {
        await page.goto("/?demo=1");
        await settle(page);
      }
      const routes = [...APP_ROUTES];
      if (data === "demo") {
        await page.goto("/sessions");
        await settle(page);
        const href = await page.locator('main a[href^="/sessions/view?id="]').first().getAttribute("href");
        if (href) routes.push(href);
      }
      const failures: string[] = [];
      await mkdir("screenshots", { recursive: true });
      for (const route of routes) {
        problems.length = 0;
        await page.goto(route);
        await settle(page);
        const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
        if (isDark !== (theme === "dark")) failures.push(`${route}: theme class does not follow prefers-color-scheme ${theme}`);
        const overflow = await noPageSideScroll(page);
        const a = await audit(page);
        const label = route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?=&]/g, "_").slice(0, 60);
        await page.screenshot({ path: `screenshots/${info.project.name}-${theme}-${data}-${label}.png` });
        reports.push({ route, theme, data, overflow, h1: a.h1, unnamed: a.unnamed, smallTargets: a.smallTargets, smallPrimary: a.smallPrimary, problems: [...problems] });
        if (overflow.doc > 0) failures.push(`${route}: page scrolls sideways by ${overflow.doc}px`);
        if (overflow.main > 0) failures.push(`${route}: <main> scrolls sideways by ${overflow.main}px`);
        if (a.h1.length !== 1) failures.push(`${route}: ${a.h1.length} visible h1 (${a.h1.join(" | ")})`);
        if (a.unnamed.length) failures.push(`${route}: controls without a name: ${a.unnamed.join("; ")}`);
        if (a.coarse && a.smallPrimary.length) failures.push(`${route}: primary controls under 44px: ${a.smallPrimary.join("; ")}`);
        if (problems.length) failures.push(`${route}: ${problems.join(" / ")}`);
        if ((page.viewportSize()?.width ?? 1280) < 768) {
          const small = await page
            .locator("input:not([type=hidden]):not([type=file]):visible, textarea:visible, select:visible")
            .evaluateAll((els) => els.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.id || el.getAttribute("name") || el.tagName));
          if (small.length) failures.push(`${route}: inputs under 16px (iOS zoom): ${small.join(", ")}`);
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
}

test("sweep: public pages, light and dark", async ({ page }) => {
  const problems = watchConsole(page);
  const failures: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const route of PUBLIC_ROUTES) {
      problems.length = 0;
      await page.goto(route);
      await settle(page);
      const overflow = await noPageSideScroll(page);
      const a = await audit(page);
      reports.push({ route, theme, data: "public", overflow, h1: a.h1, unnamed: a.unnamed, smallTargets: a.smallTargets, smallPrimary: a.smallPrimary, problems: [...problems] });
      if (overflow.doc > 0) failures.push(`${route} ${theme}: page scrolls sideways by ${overflow.doc}px`);
      if (a.h1.length !== 1) failures.push(`${route} ${theme}: ${a.h1.length} visible h1`);
      if (a.unnamed.length) failures.push(`${route} ${theme}: controls without a name: ${a.unnamed.join("; ")}`);
      if (problems.length) failures.push(`${route} ${theme}: ${problems.join(" / ")}`);
      const sizes = await page.locator("input:not([type=hidden])").evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      if ((page.viewportSize()?.width ?? 1280) < 768 && sizes.length && Math.min(...sizes) < 16) failures.push(`${route}: input font under 16px`);
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

test.afterAll(async ({}, info) => {
  await mkdir("test-results", { recursive: true });
  await writeFile(`test-results/sweep-${info.project.name}-${process.pid}.json`, JSON.stringify(reports, null, 2));
});
