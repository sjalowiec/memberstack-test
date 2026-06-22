// @ts-check
import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: netlify(),

  server: {
    port: 4321,
    strictPort: true,
    open: "/videos" // or "/tips" or true
  },

  vite: {
    server: {
      watch: {
        // Course editor backups should not trigger dev-server reloads.
        ignored: ["**/src/data/legacy_kin/cleaned/backups/**"],
      },
    },
  },
});