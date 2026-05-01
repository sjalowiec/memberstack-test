import { readFileSync } from "node:fs";
import path from "node:path";

export interface MachineImage {
  url?: string | null;
  isMain?: boolean | null;
}

export interface ReferenceMachine {
  machineId?: number;
  brand?: string | null;
  model?: string | null;
  bed?: string | null;
  gauge?: string | null;
  needleCount?: number | null;
  machineStyle?: string | null;
  punchcardWidth?: number | null;
  year?: number | null;
  images?: MachineImage[] | null;
}

function loadMachines(): ReferenceMachine[] {
  const machinesPath = path.join(process.cwd(), "data", "machines.json");
  const raw = readFileSync(machinesPath, "utf8");
  return JSON.parse(raw.replace(/\bNaN\b/g, "null"));
}

function makeSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Paths for `src/pages/reference/machine-guide/[slug].astro` (Astro isolates `getStaticPaths`). */
export function buildReferenceMachineStaticPaths() {
  const machines = loadMachines();
  const bySlug = new Map<string, ReferenceMachine>();

  for (const machine of machines) {
    const brand = machine.brand != null ? String(machine.brand).trim() : "";
    const model = machine.model != null ? String(machine.model).trim() : "";
    if (!brand || !model) continue;

    const slug = makeSlug(brand, model);
    if (!bySlug.has(slug)) bySlug.set(slug, machine);
  }

  return [...bySlug.entries()].map(([slug, machine]) => ({
    params: { slug },
    props: { machine },
  }));
}
