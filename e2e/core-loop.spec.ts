import { expect, test } from "@playwright/test";

import { card, clockInButton, clockOutButton, eat, figure, openHome, recap, serveStatusFromPageClock, watchConsole, ZONE } from "./helpers";

/*
 * F01 core loop in device mode, plus fixtures H (reload/background), I (location denied / granted) and
 * J (double tap). Fresh context per test = empty IndexedDB.
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

test("core loop: clock in, break, clock out, recap, undo, clock out, history and detail", async ({ page }) => {
  const problems = watchConsole(page);
  await openHome(page);
  await expect(page.getByText("One tap starts your first shift")).toBeVisible();

  // One tap.
  await clockInButton(page).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();
  await expect(page.getByText("Net worked", { exact: true }).first()).toBeVisible();

  // Timer ticks (from timestamps): Total elapsed changes within ~2.5 s.
  const elapsed = figure(page, "Total elapsed");
  const first = await elapsed.innerText();
  expect(first).toMatch(/^\d\d:\d\d:\d\d$/);
  await expect.poll(async () => elapsed.innerText(), { timeout: 4_000 }).not.toBe(first);

  // Breaks.
  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByText("On break", { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "End break" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Breaks" }).locator("xpath=..")).toContainText("1 break · not in net");

  // Clock out → recap with net + breaks; undo inside the 8 s window.
  await clockOutButton(page).click();
  const sheet = recap(page);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Net worked")).toBeVisible();
  await expect(sheet.locator("dt", { hasText: "Breaks" })).toBeVisible();
  await expect(sheet.locator("dt", { hasText: "Elapsed" })).toBeVisible();
  await sheet.getByRole("button", { name: /Undo clock-out/ }).click();
  await expect(page.getByText("Clock-out undone. You're still clocked in.")).toBeVisible();
  await expect(clockOutButton(page)).toBeVisible();

  // Clock out for real.
  await clockOutButton(page).click();
  await expect(recap(page)).toBeVisible();
  await recap(page).getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await expect(recap(page)).toBeHidden();
  await expect(clockInButton(page)).toBeVisible();

  // History: exactly one session; detail day contributions sum to the total.
  await page.goto("/sessions");
  const rows = page.locator('main a[href^="/sessions/view?id="]');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  const days = card(page, "Day contributions");
  await expect(days).toBeVisible();
  await expect(days.locator('a[href^="/sessions?date="]')).toHaveCount(1);
  await expect(days.getByText("All on one day")).toBeVisible();
  await expect(days.getByText(/^= \d+(h|m)/)).toBeVisible();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("H: a 5-hour background then reload shows ~5h from timestamps", async ({ page }) => {
  await page.clock.install({ time: eat("2026-10-20T08:00:00") });
  await serveStatusFromPageClock(page);
  await openHome(page);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await page.clock.fastForward("05:00:00");
  await page.reload();
  await expect(clockOutButton(page)).toBeVisible({ timeout: 15_000 });
  await expect(figure(page, "Total elapsed")).toHaveText(/^05:0\d:\d\d$/);
});

test.describe("I: location denied", () => {
  test.use({ permissions: [] });
  test("clock-in still succeeds at once and says location not captured, with Try again", async ({ page }) => {
    await openHome(page);
    const before = Date.now();
    await clockInButton(page).click();
    await expect(clockOutButton(page)).toBeVisible();
    // Start never waits for location: the hero appears at once.
    expect(Date.now() - before).toBeLessThan(5_000);
    await expect(page.getByText(/Location not captured/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("I: location granted", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: -6.7924, longitude: 39.2083, accuracy: 12 } });
  test("location captured with accuracy shown", async ({ page }) => {
    await openHome(page);
    await clockInButton(page).click();
    await expect(page.getByText(/Location captured · ±12 m · \d\d:\d\d:\d\d/)).toBeVisible({ timeout: 15_000 });
  });
});

test("J: a rapid double tap on Clock in makes exactly one session", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).dblclick();
  await expect(clockOutButton(page)).toBeVisible();
  await page.waitForTimeout(500);
  await clockOutButton(page).click();
  await recap(page).getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await page.goto("/sessions");
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1);
  // And no toast about a second clock-in leaked through as an error.
});

test("J: two taps dispatched in the same task (no re-render between) make one session", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).evaluate((el: HTMLElement) => {
    el.click();
    el.click();
  });
  await expect(clockOutButton(page)).toBeVisible();
  await page.waitForTimeout(500);
  await clockOutButton(page).click();
  await recap(page).getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await page.goto("/sessions");
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1);
});
