import { expect, test } from "@playwright/test";

import { clockInButton, clockOutButton, openHome, ZONE } from "./helpers";

/*
 * Fixture G: offline launch and use (production build, service worker on). Load once online so the worker
 * installs and precaches the shell, go offline, reload, clock in, move between screens, come back online.
 */
test.use({ timezoneId: ZONE, serviceWorkers: "allow" });

test("G: offline reload serves the shell; clock in and browse offline; back online still one session, 'On this device'", async ({ page, context }) => {
  await openHome(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait for the shell precache (every shell route stored).
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const shell = names.find((n) => n.startsWith("shifty-shell-"));
          if (!shell) return [];
          const keys = await (await caches.open(shell)).keys();
          return keys.map((r) => new URL(r.url).pathname);
        }),
      { timeout: 30_000 },
    )
    .toEqual(expect.arrayContaining(["/", "/sessions", "/sessions/view", "/insights", "/companion", "/settings", "/offline.html"]));

  await context.setOffline(true);
  await page.reload();
  await expect(clockInButton(page)).toBeVisible({ timeout: 15_000 });
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();

  // Navigate offline via the app's own nav, then by a full load.
  await page.getByRole("link", { name: "Sessions" }).first().click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1, { timeout: 15_000 });
  await page.goto("/insights");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.goto("/sessions");
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1, { timeout: 15_000 });
  // Detail page offline (query-string route served from the /sessions/view shell).
  await page.locator('main a[href^="/sessions/view?id="]').first().click();
  await expect(page.getByRole("button", { name: "Edit times" })).toBeVisible({ timeout: 15_000 });

  await context.setOffline(false);
  await page.goto("/sessions");
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Sync: On this device/ })).toBeVisible();
  await page.goto("/");
  await expect(clockOutButton(page)).toBeVisible({ timeout: 15_000 });
});

test("G: a page never visited and not in the shell falls back to the offline page", async ({ page, context }) => {
  await openHome(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () => page.evaluate(async () => (await caches.keys()).some((n) => n.startsWith("shifty-shell-"))), { timeout: 30_000 })
    .toBe(true);
  await page.reload();
  await context.setOffline(true);
  await page.goto("/terms").catch(() => undefined);
  await expect(page.locator("body")).toContainText(/offline/i, { timeout: 15_000 });
});
