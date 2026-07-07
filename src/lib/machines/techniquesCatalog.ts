/**
 * Server-side loader for the machine technique catalog.
 *
 * Builds a `machineId -> technique names` map from `src/data/machine_techniques.csv`.
 * This is read-only join data shared by the admin machine pages
 * (`/admin/machines` and `/admin/machines/for-sale`); technique assignments are
 * not edited there.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export function loadTechniquesByMachineId(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  try {
    const csvPath = path.join(process.cwd(), "src", "data", "machine_techniques.csv");
    const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const id = (cols[0] ?? "").trim();
      const technique = (cols[1] ?? "").trim();
      if (!id || !technique) continue;
      if (!map[id]) map[id] = [];
      if (!map[id].includes(technique)) map[id].push(technique);
    }
  } catch {
    /* CSV optional — tables just show 0 techniques. */
  }
  return map;
}
