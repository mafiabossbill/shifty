import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { card, clockInButton, clockOutButton, openHome, recap, ZONE } from "./helpers";

/*
 * F07 data and privacy in device mode: JSON + CSV exports (UTC instants, reporting timezone, allocations),
 * CSV formula neutralisation, and R10 "delete all location points" removing coordinates everywhere.
 */
test.use({
  timezoneId: ZONE,
  serviceWorkers: "block",
  permissions: ["geolocation"],
  geolocation: { latitude: -6.7924, longitude: 39.2083, accuracy: 12 },
});

async function download(page: Page, button: string) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button }).click()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, "utf8") };
}

async function sessionWithLocation(page: Page) {
  await openHome(page);
  await clockInButton(page).click();
  await expect(page.getByText(/Location captured · ±12 m/)).toBeVisible({ timeout: 15_000 });
  await clockOutButton(page).click();
  await recap(page).getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await expect(recap(page)).toBeHidden();
}

test("exports: JSON backup and CSVs carry UTC ISO instants, the reporting timezone and allocations", async ({ page }) => {
  await sessionWithLocation(page);
  // A title that would run as a formula in Excel.
  await page.goto("/sessions/new");
  await page.getByLabel("Start", { exact: true }).fill("2026-10-22T09:00");
  await page.getByLabel("End", { exact: true }).fill("2026-10-22T17:00");
  await page.getByLabel(/^Title/).fill('=HYPERLINK("http://evil.example","x")');
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);

  await page.goto("/settings/data");
  await expect(page.getByRole("heading", { level: 1, name: "Your data" })).toBeVisible({ timeout: 15_000 });

  const json = await download(page, "JSON backup");
  expect(json.name).toMatch(/\.json$/);
  const backup = JSON.parse(json.text);
  const text = JSON.stringify(backup);
  expect(text).toMatch(/"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z"/);
  expect(text).toContain(`"${ZONE}"`);
  expect(text).toContain("-6.7924");

  const sessions = await download(page, "Sessions CSV");
  expect(sessions.name).toMatch(/\.csv$/);
  const lines = sessions.text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  expect(lines[0]).toContain("started_at_utc");
  expect(lines[0]).toContain("reporting_time_zone");
  expect(lines.length).toBe(3);
  expect(sessions.text).toMatch(/,2026-10-22T06:00:00\.000Z,2026-10-22T14:00:00\.000Z,Africa\/Dar_es_Salaam,/);
  // Formula neutralised: the dangerous title never starts a cell with "=".
  expect(sessions.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  expect(sessions.text).toContain(`"'=HYPERLINK(`);

  const allocations = await download(page, "Day allocations CSV");
  const alines = allocations.text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  expect(alines[0]).toBe("date,session_id,session_anchor_date,reporting_time_zone,net_ms,break_ms,elapsed_ms,net_minutes");
  expect(allocations.text).toMatch(/2026-10-22,[0-9a-f-]+,2026-10-22,Africa\/Dar_es_Salaam,28800000,0,28800000,480/);

  // "Leave out precise location" redacts coordinates from the backup.
  await page.getByRole("switch", { name: /Leave out precise location/ }).click();
  const redacted = await download(page, "JSON backup");
  expect(redacted.text).not.toContain("-6.7924");
  expect(redacted.text).not.toContain("39.2083");
});

test("R10: deleting all location points removes coordinates from the session detail and exports", async ({ page }) => {
  await sessionWithLocation(page);

  // The session detail shows the point (coordinates on request).
  await page.goto("/sessions");
  await page.locator('main a[href^="/sessions/view?id="]').first().click();
  const location = card(page, "Location");
  await expect(location).toContainText("±12 m");
  await location.getByRole("button", { name: "Show coordinates" }).click();
  await expect(location).toContainText("-6.792400");
  const detailUrl = page.url();

  await page.goto("/settings/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Delete all", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete all points" }).click();
  await expect(page.getByText("No location points are stored.")).toBeVisible();

  await page.goto(detailUrl);
  const after = card(page, "Location");
  await expect(after).toBeVisible({ timeout: 15_000 });
  await expect(after).not.toContainText("-6.79");
  await expect(after).not.toContainText("±12 m");
  await expect(after.getByRole("button", { name: "Show coordinates" })).toHaveCount(0);

  await page.goto("/settings/data");
  const json = await download(page, "JSON backup");
  expect(json.text).not.toContain("-6.7924");
  expect(json.text).not.toContain("39.2083");
});
