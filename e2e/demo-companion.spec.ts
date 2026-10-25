import { expect, type Page, test } from "@playwright/test";

import { clockInButton, clockOutButton, openHome, recap, ZONE } from "./helpers";

test.use({ timezoneId: ZONE, serviceWorkers: "block" });

/** Events stored in the real device database (0 when it doesn't exist yet). */
async function storedEventCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((d) => d.name);
    if (!names.includes("shifty")) return 0;
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open("shifty");
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("events")) {
          db.close();
          return resolve(0);
        }
        const count = db.transaction("events").objectStore("events").count();
        count.onsuccess = () => {
          resolve(count.result);
          db.close();
        };
        count.onerror = () => reject(count.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test("demo: banner + sample data; actions in demo never reach IndexedDB; Exit demo returns to the empty device", async ({ page }) => {
  await openHome(page, "/?demo=1");
  const banner = page.getByRole("status").filter({ hasText: "Demo data" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("nothing is saved");

  await page.getByRole("link", { name: "Sessions" }).first().click();
  await expect(page).toHaveURL(/\/sessions/);
  await expect(page.locator('main a[href^="/sessions/view?id="]').first()).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('main a[href^="/sessions/view?id="]').count()).toBeGreaterThan(5);
  await expect(banner).toBeVisible();

  // Do something in demo: clock in (or out, if the demo has a running shift).
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^(Clock in|Clock out)$/ }).first()).toBeVisible({ timeout: 15_000 });
  if (await clockInButton(page).isVisible()) await clockInButton(page).click();
  else await clockOutButton(page).click();
  expect(await storedEventCount(page)).toBe(0);

  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page.getByText("One tap starts your first shift")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Demo data" })).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(0);
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(0);
});

test("companion: XP and level after a session; an unlocked item equipped persists across reload", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await clockOutButton(page).click();
  const sheet = recap(page);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /^\+\d+ XP$/ })).toBeVisible();
  await expect(sheet.getByText("New: First Clock-In")).toBeVisible();
  await sheet.getByRole("button", { name: /^(Done|Save and close)$/ }).click();

  await page.goto("/companion");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Level", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/XP in total/)).toBeVisible();
  await expect(page.getByText(/^[1-9]\d*$/).first()).toBeVisible();

  // First Clock-In unlocks the Party hat.
  const hat = page.getByRole("button", { name: /Party hat/ });
  await expect(hat).toHaveAttribute("aria-pressed", "false");
  await hat.click();
  await expect(hat).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: /Party hat/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
});
