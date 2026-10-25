import { expect, type Page, test } from "@playwright/test";

import { card, ZONE } from "./helpers";

/*
 * Fixtures K/M (corrections with a reason, audit old → new) and F04 manual entry with the overlap check (R09).
 * Real clock; sessions are entered by hand on Thu 22 Oct 2026 (in the past), Africa/Dar_es_Salaam.
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

async function addManual(page: Page, start: string, end: string, title: string) {
  await page.goto("/sessions/new");
  await expect(page.getByRole("heading", { level: 1, name: "Add missed session" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Start", { exact: true }).fill(start);
  await page.getByLabel("End", { exact: true }).fill(end);
  await page.getByLabel(/^Title/).fill(title);
}

async function sessionCount(page: Page) {
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return page.locator('main a[href^="/sessions/view?id="]').count();
}

test("K/M: edit a completed session's start with a reason; history shows old → new; no reason is refused", async ({ page }) => {
  await addManual(page, "2026-10-22T09:00", "2026-10-22T17:00", "Stocktake");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: /Stocktake/ })).toBeVisible();
  await expect(page.getByText("Manual", { exact: true }).first()).toBeVisible();

  // Open Edit times, move the start 30 minutes earlier.
  await page.getByRole("button", { name: "Edit times" }).click();
  const sheet = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Edit times" }) });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Start", { exact: true }).fill("2026-10-22T08:30");
  await expect(sheet.getByText(/Start .*09:00 → .*08:30/)).toBeVisible();

  // No reason → refused with a message; nothing saved.
  await sheet.getByRole("button", { name: "Save correction" }).click();
  await expect(sheet.getByText("Say briefly why you're correcting the times.")).toBeVisible();
  await expect(sheet).toBeVisible();
  // Too short (2 chars) → still refused.
  await sheet.getByLabel("Why are you changing it?").fill("ab");
  await sheet.getByRole("button", { name: "Save correction" }).click();
  await expect(sheet.getByText("Say briefly why you're correcting the times.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  const history = card(page, "History");
  await expect(history.getByText(/^Corrected /)).toHaveCount(0);

  // With a reason → saved, audit history shows old → new and the reason.
  await page.getByRole("button", { name: "Edit times" }).click();
  await sheet.getByLabel("Start", { exact: true }).fill("2026-10-22T08:30");
  await sheet.getByLabel("Why are you changing it?").fill("Forgot to clock in on arrival");
  await sheet.getByRole("button", { name: "Save correction" }).click();
  await expect(sheet).toBeHidden();
  await expect(history.getByText(/^Corrected /)).toHaveCount(1);
  await expect(history.getByText("“Forgot to clock in on arrival”")).toBeVisible();
  await expect(history.getByText(/Start .*09:00 → .*08:30/)).toBeVisible();
  await expect(history.getByText("Net 8h → 8h 30m")).toBeVisible();
  // Original start kept in the creation entry.
  await expect(history.getByText(/Added by hand, starting .*09:00/)).toBeVisible();

  // Totals recompute; day contributions still add up.
  await expect(card(page, "Day contributions").getByText("= 8h 30m")).toBeVisible();

  // Survives a reload (persisted in IndexedDB, not just in memory).
  await page.reload();
  await expect(card(page, "History").getByText("“Forgot to clock in on arrival”")).toBeVisible({ timeout: 15_000 });
});

test("F04/R09: a manual session overlapping an existing one is refused, naming it", async ({ page }) => {
  await addManual(page, "2026-10-22T09:00", "2026-10-22T17:00", "Morning cover");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);

  await addManual(page, "2026-10-22T16:00", "2026-10-22T20:00", "Evening cover");
  const alert = page.getByRole("alert").filter({ hasText: "It overlaps" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("link", { name: /Morning cover, Thu 22 Oct/ })).toBeVisible();
  await expect(alert).toContainText("09:00");
  await expect(alert).toContainText("17:00");
  // The plain "Add session" is gone; only an explicit, confirmed override remains.
  await expect(page.getByRole("button", { name: "Add session" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save anyway (overlap)" })).toBeVisible();
  // Submitting the form with Enter does not save it either.
  await page.getByLabel(/^Title/).press("Enter");
  expect(await sessionCount(page)).toBe(1);
});

// Documents current behaviour (D10: explicit override allowed). PRODUCT.md R09/A10 still say overlaps are refused
// and DB-enforced — see QA_REPORT finding M1. Cancel keeps one session; "Add anyway" saves the overlap.
test("R09 override: 'Save anyway (overlap)' asks to confirm; cancel keeps one, confirm saves both", async ({ page }) => {
  await addManual(page, "2026-10-22T09:00", "2026-10-22T17:00", "Morning cover");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  await addManual(page, "2026-10-22T16:00", "2026-10-22T20:00", "Evening cover");
  await page.getByRole("button", { name: "Save anyway (overlap)" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Add a session that overlaps another?");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole("button", { name: "Save anyway (overlap)" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Add anyway" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  expect(await sessionCount(page)).toBe(2);
});
