import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test roda as functions num isolate parecido com o do Convex
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
  },
});
