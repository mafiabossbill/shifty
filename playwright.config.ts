import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks against a running app (local, preview or production):
 *   E2E_BASE_URL=https://preview-url npm run test:e2e
 * Specs that need an account skip themselves unless E2E_EMAIL / E2E_PASSWORD are set.
 * E2E_CHROMIUM_PATH points at a preinstalled Chromium (cloud sessions: /opt/pw-browsers/chromium).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: "phone-430", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true } },
  ],
});
