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

test("signed-out pages redirect to sign in, keeping where they were going", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const width = page.viewportSize()?.width ?? 1280;
  if (width < 768) {
    const sizes = await page.locator("input:not([type=hidden])").evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  }
});
