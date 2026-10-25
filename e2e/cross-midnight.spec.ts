import { expect, type Page, test } from "@playwright/test";

import { card, clockInButton, clockOutButton, eat, openHome, recap, serveStatusFromPageClock, ZONE } from "./helpers";

/*
 * Acceptance anchors A and B (BRIEF / PRODUCT.md), driven through the real UI with Playwright's fake clock.
 *   A: Mon 18:00 → Tue 10:00 = one session, 16h, Mon 6h + Tue 10h.
 *   B: same with a Tue 02:00–02:30 break = 15h 30m net, Mon 6h + Tue 9h 30m.
 * Monday = 19 Oct 2026, Africa/Dar_es_Salaam (UTC+3).
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

async function shift(page: Page, withBreak: boolean) {
  await page.clock.install({ time: eat("2026-10-19T17:59:30") });
  await serveStatusFromPageClock(page);
  await openHome(page);
  await page.clock.pauseAt(eat("2026-10-19T18:00:00"));
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  if (withBreak) {
    await page.clock.pauseAt(eat("2026-10-20T02:00:00"));
    await page.getByRole("button", { name: "Start break" }).click();
    await expect(page.getByRole("button", { name: "End break" })).toBeVisible();
    await page.clock.pauseAt(eat("2026-10-20T02:30:00"));
    await page.getByRole("button", { name: "End break" }).click();
    await expect(page.getByRole("button", { name: "Start break" })).toBeVisible();
  }
  await page.clock.pauseAt(eat("2026-10-20T10:00:00"));
  await clockOutButton(page).click();
  const sheet = recap(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

test("A: Mon 18:00 → Tue 10:00 is one 16h session, Mon 6h + Tue 10h", async ({ page }) => {
  const sheet = await shift(page, false);
  await expect(sheet.getByText("Net worked", { exact: true }).locator("xpath=..")).toContainText("16h");
  await expect(sheet.locator("dt", { hasText: "Elapsed" }).locator("xpath=..")).toContainText("16h");
  await expect(sheet.getByText("Mon 6h · Tue 10h")).toBeVisible();
  await sheet.getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await page.clock.resume();

  await page.goto("/sessions");
  const rows = page.locator('main a[href^="/sessions/view?id="]');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  const days = card(page, "Day contributions");
  await expect(days.getByRole("link", { name: /^Monday 19 October: 6 hours net\./ })).toBeVisible();
  await expect(days.getByRole("link", { name: /^Tuesday 20 October: 10 hours net\./ })).toBeVisible();
  await expect(days.getByText("= 16h")).toBeVisible();
});

test("B: with a Tue 02:00–02:30 break: 15h 30m net, Mon 6h + Tue 9h 30m everywhere", async ({ page }) => {
  const sheet = await shift(page, true);
  await expect(sheet.getByText("Net worked", { exact: true }).locator("xpath=..")).toContainText("15h 30m");
  await expect(sheet.locator("dt", { hasText: "Elapsed" }).locator("xpath=..")).toContainText("16h");
  await expect(sheet.getByText("Mon 6h · Tue 9h 30m")).toBeVisible();
  await expect(sheet.locator("dt", { hasText: "Breaks" }).locator("xpath=..")).toContainText("30m");
  await expect(sheet.locator("dt", { hasText: /^Days$/ }).locator("xpath=..")).toContainText("2");
  await sheet.getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await page.clock.resume();

  // One session in history; the detail splits Mon 6h + Tue 9h 30m and sums to 15h 30m.
  await page.goto("/sessions");
  const rows = page.locator('main a[href^="/sessions/view?id="]');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  const days = card(page, "Day contributions");
  await expect(days.locator('a[href^="/sessions?date="]')).toHaveCount(2);
  await expect(days.getByRole("link", { name: /^Monday 19 October: 6 hours net\./ })).toBeVisible();
  await expect(days.getByRole("link", { name: /^Tuesday 20 October: 9 hours 30 minutes net, 30 minutes break\./ })).toBeVisible();
  await expect(days.getByText("= 15h 30m")).toBeVisible();

  // Drill-down from the Tuesday row: /sessions?date=2026-10-20 shows the session with its Tuesday share.
  await days.getByRole("link", { name: /^Tuesday 20 October/ }).click();
  await expect(page).toHaveURL(/\/sessions\?date=2026-10-20/);
  const dayRows = page.locator('main a[href^="/sessions/view?id="]');
  await expect(dayRows).toHaveCount(1);
  await expect(dayRows.first()).toContainText("9h 30m");
  await expect(dayRows.first()).toContainText("of 15h 30m");

  // Insights week, calendar mode: Mon 6h, Tue 9h 30m.
  await page.goto("/insights?range=week&date=2026-10-20");
  const bars = card(page, "Net per day");
  await expect(bars).toBeVisible({ timeout: 15_000 });
  await bars.getByRole("button", { name: "Show Net per day as a table" }).click();
  await expect(bars.getByRole("row", { name: /Mon 19 Oct\s+6h\b/ })).toBeVisible();
  await expect(bars.getByRole("row", { name: /Tue 20 Oct\s+9h 30m/ })).toBeVisible();

  // Start-date mode: all 15h 30m on Monday.
  await page.goto("/insights?range=week&date=2026-10-20&mode=start");
  const barsStart = card(page, "Net per day");
  await expect(barsStart).toBeVisible({ timeout: 15_000 });
  await barsStart.getByRole("button", { name: "Show Net per day as a table" }).click();
  await expect(barsStart.getByRole("row", { name: /Mon 19 Oct\s+15h 30m/ })).toBeVisible();
  await expect(barsStart.getByRole("row", { name: /Tue 20 Oct\s+0m/ })).toBeVisible();
});
