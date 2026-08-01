import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // auth.ts refuses to start without this, and generates a throwaway secret in development.
      // Pinning it keeps session assertions reproducible.
      SESSION_SECRET: "test_session_secret_at_least_thirty_two_chars",
    },
  },
});
