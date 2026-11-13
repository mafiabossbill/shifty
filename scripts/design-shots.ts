/**
 * Photographs the design gallery, so every screen is looked at before it is called done.
 *
 *   npm run design:shots                                   start the app, photograph every gallery page, stop it
 *   npm run design:shots -- --url http://localhost:3000    use an app that is already running (development mode)
 *   npm run design:shots -- --only /design/screens/home    one page and its states
 *
 * Writes factory/screens/<page>-<width>-<theme>.png at phone (375) and desktop (1280) width, light
 * and dark. The folder is not committed. Open the images and review them against
 * docs/factory/checklists/design-review.md: a screen nobody looked at is not finished.
 * E2E_CHROMIUM_PATH points at a preinstalled Chromium (cloud sessions: /opt/pw-browsers/chromium).
 *
 * The app is started with no backend (device mode), the way the gallery is meant to be seen: no
 * Supabase settings are passed, so nothing is read from or written to a database.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { photographedRoutes } from "../src/lib/design-gallery";

const WIDTHS = [375, 1280] as const;
const THEMES = ["light", "dark"] as const;

function option(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
}

async function waitFor(url: string, seconds: number): Promise<void> {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The app did not answer at ${url} within ${seconds}s. Is it a production build? The gallery exists in development only.`);
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("npm run design:shots [-- --url <running dev app>] [-- --only <gallery path>] [-- --port 4319]\nPhotographs every design gallery page into factory/screens/ (375 and 1280 wide, light and dark).");
    return;
  }
  const only = option("--only");
  const routes = photographedRoutes().filter((route) => !only || route === only || route.startsWith(`${only}/`));
  if (routes.length === 0) throw new Error(`No gallery page matches ${only}. Pages are listed in src/lib/design-gallery/.`);

  let server: ChildProcess | undefined;
  let base = option("--url")?.replace(/\/$/, "");
  if (!base) {
    const port = option("--port") ?? "4319";
    base = `http://localhost:${port}`;
    // Device mode: the gallery needs no backend, so the Supabase settings are withheld even if the shell has them.
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" };
    server = spawn("npx", ["next", "dev", "-p", port], { env, stdio: "ignore", detached: true });
  }
  const out = path.join(process.cwd(), "factory", "screens");
  mkdirSync(out, { recursive: true });
  const executablePath = process.env.E2E_CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    await waitFor(`${base}/design`, 180);
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, colorScheme: theme, deviceScaleFactor: 1 });
        const page = await context.newPage();
        for (const route of routes) {
          await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
          await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
          // Gallery screens load their sample data in the browser: wait until the page says it is ready.
          await page.waitForFunction(() => !document.querySelector("[data-gallery-pending]"), undefined, { timeout: 30_000 });
          await page.waitForTimeout(350); // overlays finish their 300ms entrance
          const name = route.replace(/^\/design\/?/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "system";
          const file = path.join(out, `${name}-${width}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: true });
          console.log(path.relative(process.cwd(), file));
        }
        await context.close();
      }
    }
    console.log(`\n${routes.length * WIDTHS.length * THEMES.length} screenshots in factory/screens/. Open them and review against docs/factory/checklists/design-review.md.`);
  } finally {
    await browser.close();
    if (server?.pid) {
      try {
        process.kill(-server.pid);
      } catch {
        // already gone
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
