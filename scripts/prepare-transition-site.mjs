#!/usr/bin/env node
/**
 * Copy only the public assets needed by the standalone transition-site build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(repoRoot, "public");
const targetRoot = path.join(repoRoot, "transition-site", "public");

const assetPaths = [
  "images/KINlogo.svg",
  "images/knit-by-machine-sue.png",
  "images/sue-signature.svg",
  "favicon.ico",
  "apple-touch-icon.png",
];

function copyFile(relativePath) {
  const source = path.join(publicRoot, relativePath);
  const target = path.join(targetRoot, relativePath);

  if (!fs.existsSync(source)) {
    console.warn(`[prepare-transition-site] missing source: ${relativePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[prepare-transition-site] copied ${relativePath}`);
}

fs.mkdirSync(path.join(targetRoot, "images"), { recursive: true });

for (const relativePath of assetPaths) {
  copyFile(relativePath);
}

console.log("[prepare-transition-site] done");
