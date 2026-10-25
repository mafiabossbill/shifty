import { expect, test } from "@playwright/test";

/*
 * Smoke checks that need no account: run against local, preview or production.
 *   E2E_BASE_URL=https://<deployment> npm run test:e2e
 * Signed-in journeys go in their own specs and skip unless E2E_EMAIL / E2E_PASSWORD are set.
 */

test("health answers ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe("ok");
});

/** Device mode (no Supabase configured) vs a deployment with sync configured. */
async function syncConfigured(request: import("@playwright/test").APIRequestContext): Promise<boolean> {
  const res = await request.get("/api/sync/status");
  return res.ok() ? Boolean((await res.json()).data?.configured) : false;
}

// D04: the tracking pages are a public static shell that reads this browser's IndexedDB, in every mode.
test("tracking pages are public (D04 device shell)", async ({ page }) => {
  for (const path of ["/", "/sessions", "/sessions/new", "/sessions/trash", "/sessions/view", "/insights", "/companion", "/settings", "/settings/data", "/settings/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    expect(new URL(page.url()).pathname, path).toBe(path);
  }
});

test("/dashboard (the template's old home) lands on Home, or on sign in when sync is configured", async ({ page, request }) => {
  const configured = await syncConfigured(request);
  await page.goto("/dashboard");
  if (configured) await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  else await expect(page).toHaveURL(/\/$/);
});

test("signed-out pages outside the device shell redirect to sign in, keeping where they were going (sync configured only)", async ({ page, request }) => {
  test.skip(!(await syncConfigured(request)), "Device mode: no Supabase configured, so the proxy passes every page through (D04/D09).");
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sync APIs refuse without a session: 503 in device mode, 401 when configured", async ({ request }) => {
  const configured = await syncConfigured(request);
  const res = await request.get("/api/sync/state");
  expect(res.status()).toBe(configured ? 401 : 503);
  expect(typeof (await res.json()).error).toBe("string");
  const post = await request.post("/api/sync/events", { data: {} });
  expect(post.status()).toBe(configured ? 401 : 503);
});

test("legal pages are public", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/cookies", "/data-deletion"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("manifest and service worker are served signed out", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.start_url).toBe("/");
  expect(body.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("sign-in page fits the screen and inputs never trigger iOS zoom", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const width = page.viewportSize()?.width ?? 1280;
  if (width < 768) {
    const sizes = await page.locator("input:not([type=hidden])").evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  }
});
