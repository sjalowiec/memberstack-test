/**
 * Give spaced machine model names a joined spelling in the built HTML
 * before Pagefind indexes the site.
 *
 *   vite-node src/lib/addMachineModelSearchAliases.ts
 *   vite-node src/lib/addMachineModelSearchAliases.ts --dir=dist
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { addMachineModelSearchAliases } from "./machineModelSearch";

const dirArg = process.argv.find((arg) => arg.startsWith("--dir="));
const root = path.resolve(dirArg ? dirArg.slice("--dir=".length) : "dist");

async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(full)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const files = await htmlFiles(root);
let updated = 0;
for (const file of files) {
  const html = await readFile(file, "utf8");
  const next = addMachineModelSearchAliases(html);
  if (next === html) continue;
  await writeFile(file, next);
  updated += 1;
}
console.log(`Machine model search aliases: updated ${updated} of ${files.length} HTML files in ${root}`);
