// this config is just used to run benches

import { defineConfig } from "vitest/config";

import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    benchmark: {
      include: ["src/**/*.bench.ts"],
    },
    setupFiles: ["@vitest/web-worker"],
    environment: "node",
  },
});
