import { expect, type Locator, type Page } from "@playwright/test";

/*
 * Shared helpers for the SHIFTY device-mode journeys (QA lane). Every journey runs in a fresh browser
 * context, so IndexedDB starts empty. Nothing here talks to Supabase: the app is built and served with
 * no Supabase env (device mode), and /api/sync/status answers `configured: false`.
 */

export const ZONE = "Africa/Dar_es_Salaam";

/** An instant from a wall-clock time in Dar es Salaam (UTC+3, no DST). */
export function eat(wall: string): number {
  return Date.parse(`${wall}+03:00`);
}

/**
 * The store corrects the device clock by the server's clock (`/api/sync/status` → serverTime). When a test
 * fakes the browser clock, the real server would "correct" it back to today, so answer the status call from
 * the page's own (fake) clock. Same shape as the real device-mode answer.
 */
export async function serveStatusFromPageClock(page: Page) {
  await page.route("**/api/sync/status", async (route) => {
    let serverTime: number | null = null;
    try {
      serverTime = await page.evaluate(() => Date.now());
    } catch {
      serverTime = null;
    }
    if (serverTime === null) return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { configured: false, signedIn: false, userId: null, email: null, serverTime } }),
    });
  });
}

/** Collects console errors, page errors and React hydration warnings for a page. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") problems.push(`console.error: ${text}`);
    else if (/hydrat/i.test(text)) problems.push(`${msg.type()}: ${text}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

/** Home is interactive: the store opened IndexedDB and the hero rendered. */
export async function openHome(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("button", { name: /^(Clock in|Clock out)$/ }).first()).toBeVisible({ timeout: 15_000 });
}

export function clockInButton(page: Page): Locator {
  return page.getByRole("button", { name: "Clock in", exact: true });
}

export function clockOutButton(page: Page): Locator {
  return page.getByRole("main").getByRole("button", { name: "Clock out", exact: true });
}

/** The value under a figure label in the active hero ("Total elapsed", "Breaks"). */
export function figure(page: Page, label: string): Locator {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

/** A `[data-slot=card]` whose heading is `title`. */
export function card(page: Page, title: string | RegExp): Locator {
  return page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title }) });
}

/** The recap sheet that opens after Clock out. */
export function recap(page: Page): Locator {
  return page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Shift logged" }) });
}

/** Sessions stored in this browser's IndexedDB (counts clock-in events of sessions not purged). */
export async function deviceDatabases(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    if (!("databases" in indexedDB)) return ["(indexedDB.databases unsupported)"];
    const dbs = await indexedDB.databases();
    return dbs.map((d) => d.name ?? "");
  });
}

export async function noPageSideScroll(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector("main");
    return {
      doc: doc.scrollWidth - window.innerWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
}
