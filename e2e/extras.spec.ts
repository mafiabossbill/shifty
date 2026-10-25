import { expect, test } from "@playwright/test";

import { clockInButton, clockOutButton, eat, openHome, recap, serveStatusFromPageClock, ZONE } from "./helpers";

/*
 * Secondary checks: keyboard-only core loop, the goal is a goal (overage shown neutrally, rest prompt, no auto
 * clock-out with the safety limit off), the active ribbon on other pages, and trash → restore (F08).
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

test("keyboard only: Clock in and Clock out with Tab/Enter, recap closes with Escape", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(clockOutButton(page)).toBeVisible();
  await clockOutButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(recap(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(recap(page)).toBeHidden();
  await expect(clockInButton(page)).toBeVisible();
});

test("goal, not a limit: past 16h the hero shows overage neutrally, a rest prompt appears, and nothing clocks out", async ({ page }) => {
  await page.clock.install({ time: eat("2026-10-20T06:00:00") });
  await serveStatusFromPageClock(page);
  await openHome(page);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await page.clock.fastForward("17:00:00");
  await page.reload();
  await expect(clockOutButton(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Goal 16h · \+1h(?: \dm)? past it/)).toBeVisible();
  await expect(page.getByText(/hours — that's a long one|You've reached your goal/).first()).toBeVisible();
  // Safety limit is off by default: still running after 21h.
  await page.clock.fastForward("04:00:00");
  await page.reload();
  await expect(clockOutButton(page)).toBeVisible({ timeout: 15_000 });
});

test("active ribbon follows to other pages and links home", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await page.goto("/insights");
  const ribbon = page.getByRole("link", { name: /Open Home$/ });
  await expect(ribbon).toBeVisible({ timeout: 15_000 });
  await ribbon.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(clockOutButton(page)).toBeVisible();
});

test("F08: move to trash, it leaves the list, restore brings it back", async ({ page }) => {
  await page.goto("/sessions/new");
  await page.getByLabel("Start", { exact: true }).fill("2026-10-22T09:00");
  await page.getByLabel("End", { exact: true }).fill("2026-10-22T17:00");
  await page.getByLabel(/^Title/).fill("Trash me");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(0);
  await page.goto("/sessions/trash");
  await expect(page.getByText("Trash me")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Restore/ }).first().click();
  await page.goto("/sessions");
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1, { timeout: 15_000 });
});
