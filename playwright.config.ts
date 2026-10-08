import { defineConfig } from "@playwright/test";

const port = 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    // The phone a tutor owns: 360 wide, touch, no hover.
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
    locale: "en-IN",
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone", use: { browserName: "chromium" } }],
  // Against a deployed URL (E2E_BASE_URL) there is nothing to start locally.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/serve-out.mjs",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(port) },
      },
});
