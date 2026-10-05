import { defineConfig } from "tsup";

export default defineConfig([
  // The component. Marked as client code so Next.js server pages can render it directly
  {
    entry: { index: "src/index.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    external: ["react"],
    banner: { js: '"use client";' },
  },
  // Data only, no "use client", so it can be called on the server
  {
    entry: { server: "src/server.ts" },
    format: ["esm", "cjs"],
    dts: true,
  },
]);
