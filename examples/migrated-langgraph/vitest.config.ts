import { defineConfig } from "vitest/config";

// Fast unit loop: excludes *.integration.test.ts. Discovered by @nx/vite as `nx test`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/dist/**", "**/node_modules/**"],
    passWithNoTests: true,
    // The dev-server e2e boots the real `skein` CLI + vite; give it room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
