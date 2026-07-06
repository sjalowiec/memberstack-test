/**
 * Build-time manifests for on-disk public assets.
 *
 * The SSR runtime must never scan `public/` with the filesystem: Astro's Netlify
 * adapter traces those `fs` calls with @vercel/nft and copies the referenced
 * directory trees (hundreds of MB of PDFs/images) into the SSR function, blowing
 * past Netlify's upload limit.
 *
 * Instead we snapshot the small set of facts the runtime actually needs
 * (filenames, and file sizes for the ebook audit UI) into tiny JSON manifests
 * that are imported normally. Run automatically via `prebuild`; the output is
 * checked into the repo so local dev works without a build step.
 */
import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "generated");

/** List regular files directly inside `dir` (relative to project root). */
function listFiles(relDir) {
  const abs = join(ROOT, relDir);
  try {
    return readdirSync(abs)
      .filter((name) => {
        try {
          return statSync(join(abs, name)).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  } catch {
    return [];
  }
}

function writeManifest(filename, data) {
  const target = join(OUT_DIR, filename);
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  return { target, count: Array.isArray(data) ? data.length : 0 };
}

mkdirSync(OUT_DIR, { recursive: true });

// 1) Machine images — just the filenames present in public/images/machines.
const machineImages = listFiles(join("public", "images", "machines"));

// 2) Legacy shop downloads — filename + byte size (audit UI shows sizes).
const shopDir = join("public", "downloads", "shop");
const shopDownloads = listFiles(shopDir).map((name) => {
  let size = null;
  try {
    size = statSync(join(ROOT, shopDir, name)).size;
  } catch {
    size = null;
  }
  return { name, size };
});

const a = writeManifest("machine-images-manifest.json", machineImages);
const b = writeManifest("shop-downloads-manifest.json", shopDownloads);

console.log(`[public-manifests] machine images: ${a.count} file(s)`);
console.log(`[public-manifests] shop downloads: ${b.count} file(s)`);
