import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { card, clockInButton, clockOutButton, eat, openHome, recap, serveStatusFromPageClock, ZONE } from "./helpers";

/*
 * Edge probes beyond the brief's list: undo expiry (A08), reload during a break, a manual end in the future,
 * import with a dry run (F07), DST in Europe/London (fixture F through the UI), two tabs (R01 on one device).
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

test("A08: the undo grace ends after 8 s; the end time stays the tap time", async ({ page }) => {
  await page.clock.install({ time: eat("2026-10-21T08:59:30") });
  await serveStatusFromPageClock(page);
  await openHome(page);
  await page.clock.pauseAt(eat("2026-10-21T09:00:00"));
  await clockInButton(page).click();
  await page.clock.pauseAt(eat("2026-10-21T10:00:00"));
  await clockOutButton(page).click();
  const sheet = recap(page);
  await expect(sheet.getByRole("button", { name: /Undo clock-out/ })).toBeVisible();
  await page.clock.runFor(9_000);
  await expect(sheet.getByRole("button", { name: /Undo clock-out/ })).toHaveCount(0);
  await expect(sheet.getByText("Net worked", { exact: true }).locator("xpath=..")).toContainText("1h");
  await expect(sheet).toContainText("09:00 → 10:00");
});

test("reload during a break: still on break, timers from timestamps", async ({ page }) => {
  await openHome(page);
  await clockInButton(page).click();
  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByRole("button", { name: "End break" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "End break" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("On break", { exact: true }).first()).toBeVisible();
});

test("manual entry: an end in the future is refused with a clear message", async ({ page }) => {
  await page.goto("/sessions/new");
  await page.getByLabel("Start", { exact: true }).fill("2030-01-01T09:00");
  await page.getByLabel("End", { exact: true }).fill("2030-01-01T17:00");
  await expect(page.getByText("A missed session must have ended already. Use Clock in for one that's still going.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add session" })).toBeDisabled();
});

test("F07 import: a JSON backup from one device previews (dry run) and adds its sessions to a fresh device", async ({ page, browser }) => {
  await page.goto("/sessions/new");
  await page.getByLabel("Start", { exact: true }).fill("2026-10-22T09:00");
  await page.getByLabel("End", { exact: true }).fill("2026-10-22T17:00");
  await page.getByLabel(/^Title/).fill("Imported shift");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  await page.goto("/settings/data");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "JSON backup" }).click()]);
  const backupPath = await file.path();
  expect((await readFile(backupPath, "utf8")).length).toBeGreaterThan(100);

  const fresh = await browser.newContext({ timezoneId: ZONE, serviceWorkers: "block" });
  const other = await fresh.newPage();
  await other.goto(new URL("/settings/data", page.url()).toString());
  await expect(other.getByRole("heading", { level: 1, name: "Your data" })).toBeVisible({ timeout: 15_000 });
  await other.locator("#import-file").setInputFiles(backupPath);
  const preview = other.getByRole("region", { name: "Import preview" });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(/1 session/);
  // Dry run: nothing added before confirming.
  await other.goto(new URL("/sessions", page.url()).toString());
  await expect(other.getByRole("heading", { level: 1 })).toBeVisible();
  await other.waitForTimeout(500);
  await expect(other.locator('main a[href^="/sessions/view?id="]')).toHaveCount(0);
  await other.goto(new URL("/settings/data", page.url()).toString());
  await other.locator("#import-file").setInputFiles(backupPath);
  await other.getByRole("region", { name: "Import preview" }).getByRole("button", { name: /^(Import|Add)/ }).click();
  await expect(other.getByText(/Added 1 session/).first()).toBeVisible();
  await other.goto(new URL("/sessions", page.url()).toString());
  await expect(other.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1, { timeout: 15_000 });
  await expect(other.getByText("Imported shift")).toBeVisible();
  // Importing the same file again skips it (never duplicated, never overwritten).
  await other.goto(new URL("/settings/data", page.url()).toString());
  await other.locator("#import-file").setInputFiles(backupPath);
  await expect(other.getByRole("region", { name: "Import preview" })).toContainText(/already|skip|nothing/i);
  await fresh.close();
});

test.describe("F (DST) through the UI: Europe/London, clocks go back 25 Oct 2026", () => {
  test.use({ timezoneId: "Europe/London" });
  test("Sat 20:00 → Sun 10:00 is 15h elapsed: Sat 4h + Sun 11h", async ({ page }) => {
    await page.clock.install({ time: Date.parse("2026-10-24T18:59:30Z") }); // 19:59:30 BST
    await serveStatusFromPageClock(page);
    await openHome(page);
    await page.clock.pauseAt(Date.parse("2026-10-24T19:00:00Z")); // Sat 20:00 BST
    await clockInButton(page).click();
    await expect(clockOutButton(page)).toBeVisible();
    await page.clock.pauseAt(Date.parse("2026-10-25T10:00:00Z")); // Sun 10:00 GMT
    await clockOutButton(page).click();
    const sheet = recap(page);
    await expect(sheet.getByText("Net worked", { exact: true }).locator("xpath=..")).toContainText("15h");
    await expect(sheet.getByText("Sat 4h · Sun 11h")).toBeVisible();
    await sheet.getByRole("button", { name: /^(Done|Save and close)$/ }).click();
    await page.clock.resume();
    await page.goto("/sessions");
    await page.locator('main a[href^="/sessions/view?id="]').first().click();
    await expect(card(page, "Day contributions").getByText("= 15h")).toBeVisible();
  });
});

test("R01 on one device: a second tab that was already open cannot start a second running session", async ({ page, context }) => {
  const other = await context.newPage();
  await openHome(page);
  await openHome(other);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();

  // The other tab comes to the front (focus + visibilitychange) and the person taps Clock in there.
  await other.bringToFront();
  await other.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await other.waitForTimeout(500);
  if (await clockInButton(other).isVisible()) await clockInButton(other).click().catch(() => undefined);
  await other.waitForTimeout(500);

  // Whatever each tab showed, after a reload the device holds exactly one session and it is running.
  await page.reload();
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('main a[href^="/sessions/view?id="]')).toHaveCount(1);
});
