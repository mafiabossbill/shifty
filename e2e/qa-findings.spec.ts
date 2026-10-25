import { expect, type Page, test } from "@playwright/test";

import { clockInButton, clockOutButton, eat, openHome, recap, serveStatusFromPageClock, ZONE } from "./helpers";

/*
 * Bugs found by QA (factory/QA_REPORT.md), kept as tests that state the CORRECT behaviour and are marked
 * `test.fail()` so the suite stays green while the bug is open. When a fix lands, Playwright reports
 * "expected to fail but passed": remove the `test.fail()` line and the test becomes a regression guard.
 * QA_SHOW_BUGS=1 runs them as normal tests to see each failure message.
 */
test.use({ timezoneId: ZONE, serviceWorkers: "block" });

function minutesOf(text: string): number {
  const h = /(\d+)h/.exec(text);
  const m = /(\d+)m/.exec(text);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

async function crossMidnightWithSeconds(page: Page) {
  await page.clock.install({ time: eat("2026-10-19T18:00:00") });
  await serveStatusFromPageClock(page);
  await openHome(page);
  await page.clock.pauseAt(eat("2026-10-19T18:00:30"));
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await page.clock.pauseAt(eat("2026-10-20T01:12:30"));
}

// QA-M2: the recap's per-day line floors each day separately, so "Mon 5h 59m · Tue 1h 12m" sits under a
// "7h 12m" total. The session detail apportions minutes (DayContributions) and adds up; the recap doesn't.
test("QA-M2: recap per-day split adds up to the net shown", async ({ page }) => {
  test.fail(!process.env.QA_SHOW_BUGS, "QA-M2 open: recap day split uses floored minutes per day (src/lib/home/view-model.ts daySplitLine)");
  await crossMidnightWithSeconds(page);
  await clockOutButton(page).click();
  const sheet = recap(page);
  await expect(sheet).toBeVisible();
  const net = await sheet.getByText("Net worked", { exact: true }).locator("xpath=following-sibling::*[1]").innerText();
  const split = (await sheet.locator("p", { hasText: " · Tue " }).innerText()).replace(/^Per day:\s*/, "");
  const parts = split.split(" · ").map((p) => minutesOf(p.replace(/^\w{3} /, "")));
  expect(net).toBe("7h 12m");
  expect(parts.reduce((a, b) => a + b, 0), `${split} vs ${net}`).toBe(minutesOf(net));
});

// QA-M2 (same root cause) in the active hero's "Crossed midnight · 5h 59m on Mon, 1h 12m today" line.
test("QA-M2: active hero midnight line adds up to the net readout", async ({ page }) => {
  test.fail(!process.env.QA_SHOW_BUGS, "QA-M2 open: crossedMidnightLine floors each day separately");
  await crossMidnightWithSeconds(page);
  await page.clock.runFor(1_000);
  const line = await page.locator("p", { hasText: "Crossed midnight" }).innerText();
  const mins = [...line.matchAll(/(\d+h(?: \d+m)?|\d+m) (?:on|today)/g)].map((m) => minutesOf(m[1]));
  expect(mins.length).toBe(2);
  // Net readout at 01:12:31 is 07:12 (hh:mm).
  expect(mins[0] + mins[1], line).toBe(7 * 60 + 12);
});

// QA-M3: each tab keeps its own in-memory copy and never re-reads IndexedDB, so a second open tab (or the
// installed PWA next to a browser tab) still shows "Clock in" after the other clocked in, accepts a parallel
// clock-in, and only after a reload does that work turn into "Needs attention".
test("QA-M3: a second open tab shows the running session once it comes to the front", async ({ page, context }) => {
  const other = await context.newPage();
  await openHome(page);
  await openHome(other);
  await clockInButton(page).click();
  await expect(clockOutButton(page)).toBeVisible();
  await other.bringToFront();
  await other.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(clockOutButton(other)).toBeVisible({ timeout: 5_000 });
});

// QA-L1: the "session not on this device" empty state has no h1 (every other screen has exactly one).
test("QA-L1: the missing-session page has one h1", async ({ page }) => {
  test.fail(!process.env.QA_SHOW_BUGS, "QA-L1 open: EmptyState title is not a heading level 1");
  await page.goto("/sessions/view?id=00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("This session isn't on this device.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

// QA-L2: Buttons rendered through a Radix trigger (`DropdownMenuTrigger asChild`, `DialogTrigger asChild`) get
// data-slot="…-trigger" instead of "button", so the 44px touch hit area in globals.css doesn't apply:
// "More actions" on session detail is 40×40 on phones; "Share week"/"Share recap" are 40px tall.
test("QA-L2: More actions on session detail has a 44px touch hit area on phones", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "touch targets are a phone check");
  test.fail(!process.env.QA_SHOW_BUGS, "QA-L2 open: trigger data-slot overrides the Button's data-slot=button");
  await page.goto("/sessions/new");
  await page.getByLabel("Start", { exact: true }).fill("2026-10-22T09:00");
  await page.getByLabel("End", { exact: true }).fill("2026-10-22T17:00");
  await page.getByRole("button", { name: "Add session" }).click();
  await expect(page).toHaveURL(/\/sessions\/view\?id=/);
  const more = page.getByRole("button", { name: "More actions" });
  await expect(more).toBeVisible();
  const box = (await more.boundingBox())!;
  // A tap 1px above the visible button, still inside a 44px target centred on it.
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest("button")?.getAttribute("aria-label") ?? el?.tagName ?? null;
    },
    { x: box.x + box.width / 2, y: box.y - 1 },
  );
  expect(hit).toBe("More actions");
});

// QA-L3: the rhythm card says "Best 1 days".
test("QA-L3: the rhythm card pluralises 'day'", async ({ page }) => {
  test.fail(!process.env.QA_SHOW_BUGS, "QA-L3 open: src/components/home/side-cards.tsx 'Best {r.best} days'");
  await crossMidnightWithSeconds(page);
  await clockOutButton(page).click();
  await recap(page).getByRole("button", { name: /^(Done|Save and close)$/ }).click();
  await expect(page.getByText(/^Best \d+ days?$/)).toBeVisible();
  await expect(page.getByText("Best 1 days")).toHaveCount(0);
});
