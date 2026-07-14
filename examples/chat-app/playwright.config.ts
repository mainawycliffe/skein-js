import { defineConfig, devices } from "@playwright/test";

// Browser e2e for the chat UI. It drives a live Gemini model, so it only makes sense with a key:
// when GOOGLE_API_KEY is unset we start no servers and the single spec self-skips, keeping keyless
// CI green. With a key, Playwright boots both the skein-js backend (:2024) and the Next.js UI (:3005).
const hasKey = Boolean(process.env["GOOGLE_API_KEY"]);

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3005",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: hasKey
    ? [
        {
          command: "pnpm dev",
          url: "http://127.0.0.1:2024/assistants/research",
          timeout: 120_000,
          reuseExistingServer: !process.env["CI"],
        },
        {
          command: "pnpm dev:ui",
          url: "http://localhost:3005",
          timeout: 120_000,
          reuseExistingServer: !process.env["CI"],
        },
      ]
    : undefined,
});
