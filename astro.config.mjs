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
        ignored: [
          // Netlify dev emulation writes per-request temp dirs + function bundles here; watching it
          // leaks file handles on Windows (EMFILE). Not app source, so safe to ignore.
          "**/.netlify/**",
          "**/src/data/legacy_kin/cleaned/backups/**",
          // Illustrator masters + autosave temps (avoid dev-server HMR thrash).
          "**/assets/**/*.ai",
          "**/assets/**/~ai-*",
          "**/assets/**/*.tmp",
          "**/public/images/patterns/**/*.ai",
          "**/public/images/patterns/**/~ai-*",
          "**/public/images/patterns/**/*.tmp",
        ],
      },
    },
  },
});