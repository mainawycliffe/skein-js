import { defineConfig } from "vitest/config";

// Fast unit loop, discovered by @nx/vite as `nx test`. `research-agent.test.ts` is hermetic (no key
// or network); `server.test.ts` drives a live Gemini model and self-skips unless GOOGLE_API_KEY is
// set. The Playwright browser suite lives under e2e/ and runs via `pnpm test:e2e`, not vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "lib/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/dist/**", "**/node_modules/**", "e2e/**"],
    passWithNoTests: true,
  },
});
