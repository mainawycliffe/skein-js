import { defineConfig } from "vitest/config";

// Fast unit loop: excludes *.integration.test.ts (those need Docker — see docs/testing.md).
// Discovered by @nx/vite as `nx test`. The live-Gemini suite in server.test.ts self-skips
// unless GOOGLE_API_KEY is set.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/dist/**", "**/node_modules/**"],
    passWithNoTests: true,
  },
});
