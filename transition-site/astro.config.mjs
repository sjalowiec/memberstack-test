import { defineConfig } from "astro/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

/** Minimal static build for the transition landing page only. */
export default defineConfig({
  root: here,
  srcDir: path.join(here, "src"),
  publicDir: path.join(here, "public"),
  outDir: path.join(here, "dist"),
  output: "static",
  server: {
    port: 4322,
    strictPort: true,
  },
  vite: {
    resolve: {
      alias: {
        "@transition": path.join(repoRoot, "src/components/transition"),
        "@repo-styles": path.join(repoRoot, "src/styles"),
      },
    },
    server: {
      fs: {
        allow: [repoRoot],
      },
    },
  },
});
