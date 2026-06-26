import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/load-env.ts", "./test/setup.ts"],
    // DB-backed tests must not run concurrently (shared schema, truncate between tests).
    fileParallelism: false,
    pool: "forks",
  },
});
