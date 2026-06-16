/**
 * Machine Library — data access layer.
 *
 * Single source of truth for reading the knitting-machine reference catalog
 * (data/machines.json, ~100 records) and shaping it for the Machine Library
 * pages at /reference/machines and /reference/machines/[slug].
 *
 * The legacy catalog stores `gauge` as a mix of numeric pitches ("4.5", "7.0")
 * and named categories ("Standard Gauge", "Bulky/Chunky", "Mid-Gauge",
 * "Fine Gauge"). We normalize both into:
 *   - pitchAlpha: the gauge category used for filtering ("Standard Gauge", …)
 *   - pitch:      the needle pitch in millimetres (well-known standard values)
 *
 * Pages and components consume these helpers, never the JSON directly, so the
 * data source can later move (e.g. to a content collection or Supabase) without
 * touching the UI.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface MachineImage {
  url?: string | null;
  isMain?: boolean | null;
}

/** Raw record shape as stored in data/machines.json. */
interface RawMachine {
  machineId?: number | null;
  brand?: string | null;
  model?: string | null;
  bed?: string | null;
  gauge?: string | null;
  needleCount?: number | null;
  machineStyle?: string | null;
  punchcardWidth?: number | null;
  year?: number | null;
  notes?: string | null;
  images?: MachineImage[] | null;
}

/** Normalized machine record consumed by the Machine Library UI. */
export interface Machine {
  /** Stable legacy identifier. */
  machineId: number | null;
  /** Derived brand+model slug, used in /reference/machines/{slug}. */
  slug: string;
  brand: string;
  model: string;
  bed: string | null;
  /** Display gauge category (PitchAlpha), e.g. "Standard Gauge". */
  gauge: string;
  /** Gauge category used for filtering (same value as `gauge`). */
  pitchAlpha: string;
  /** Needle pitch in millimetres, when known. */
  pitch: number | null;
  needleCount: number | null;
  machineStyle: string | null;
  year: number | null;
  /** Free-text notes. Not present in the legacy data yet; reserved. */
  notes: string | null;
  images: MachineImage[];
  /**
   * Supported techniques sourced solely from src/data/machine_techniques.csv
   * (joined on MachineID_FK = machineId). Never inferred from accessories or
   * machine type. Empty when the machine has no technique records.
   */
  techniques: string[];
}

const IMAGE_BASE = "https://www.knititnow.com/images/machines/";

function loadRawMachines(): RawMachine[] {
  const machinesPath = path.join(process.cwd(), "data", "machines.json");
  const raw = readFileSync(machinesPath, "utf8");
  // The export contains bare `NaN` tokens which are not valid JSON.
  return JSON.parse(raw.replace(/\bNaN\b/g, "null")) as RawMachine[];
}

/**
 * Load supported techniques keyed by machineId from
 * src/data/machine_techniques.csv (columns: MachineID_FK, Taxonomy, Category).
 * The technique name is the `Taxonomy` value. Values are stored in a Set so a
 * machine that appears multiple times in the CSV is de-duplicated.
 */
function loadTechniquesByMachineId(): Map<number, Set<string>> {
  const csvPath = path.join(process.cwd(), "src", "data", "machine_techniques.csv");
  const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  const map = new Map<number, Set<string>>();
  // Skip the header row.
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const id = Number.parseInt((cols[0] ?? "").trim(), 10);
    const technique = (cols[1] ?? "").trim();
    if (Number.isNaN(id) || !technique) continue;
    if (!map.has(id)) map.set(id, new Set<string>());
    map.get(id)!.add(technique);
  }
  return map;
}

function clean(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value).trim();
}

function makeSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize the mixed `gauge` field into a gauge category (PitchAlpha) plus a
 * needle pitch in millimetres. Category labels and their standard pitches are
 * well-established machine-knitting conventions.
 */
function normalizeGauge(rawGauge: string): { pitchAlpha: string; pitch: number | null } {
  const raw = rawGauge.trim();
  if (!raw) return { pitchAlpha: "Unknown", pitch: null };

  const lower = raw.toLowerCase();
  const isNumeric = /^[\d.]+$/.test(raw);
  const numeric = isNumeric ? Number.parseFloat(raw) : Number.NaN;

  let pitchAlpha: string;
  if (lower.includes("fine")) pitchAlpha = "Fine Gauge";
  else if (lower.includes("bulky") || lower.includes("chunky")) pitchAlpha = "Bulky/Chunky";
  else if (lower.includes("mid")) pitchAlpha = "Mid-Gauge";
  else if (lower.includes("standard")) pitchAlpha = "Standard Gauge";
  else if (!Number.isNaN(numeric)) {
    if (numeric < 4) pitchAlpha = "Fine Gauge";
    else if (numeric <= 5) pitchAlpha = "Standard Gauge";
    else if (numeric <= 7.5) pitchAlpha = "Mid-Gauge";
    else pitchAlpha = "Bulky/Chunky";
  } else {
    pitchAlpha = raw;
  }

  const STANDARD_PITCH: Record<string, number> = {
    "Fine Gauge": 3.6,
    "Standard Gauge": 4.5,
    "Mid-Gauge": 6.5,
    "Bulky/Chunky": 9,
  };
  const pitch = !Number.isNaN(numeric) ? numeric : STANDARD_PITCH[pitchAlpha] ?? null;

  return { pitchAlpha, pitch };
}

function toMachine(raw: RawMachine): Machine | null {
  const brand = clean(raw.brand);
  const model = clean(raw.model);
  if (!brand || !model) return null;

  const { pitchAlpha, pitch } = normalizeGauge(clean(raw.gauge));
  const images = Array.isArray(raw.images)
    ? raw.images.filter((img): img is MachineImage => !!img && !!clean(img.url))
    : [];

  const needleCount =
    typeof raw.needleCount === "number" && !Number.isNaN(raw.needleCount)
      ? Math.round(raw.needleCount)
      : null;
  const year =
    typeof raw.year === "number" && !Number.isNaN(raw.year) ? Math.round(raw.year) : null;
  const machineStyle = clean(raw.machineStyle) || null;
  const notes = clean(raw.notes) || null;

  return {
    machineId: typeof raw.machineId === "number" ? raw.machineId : null,
    slug: makeSlug(brand, model),
    brand,
    model,
    bed: clean(raw.bed) || null,
    gauge: pitchAlpha,
    pitchAlpha,
    pitch,
    needleCount,
    machineStyle,
    year,
    notes,
    images,
    techniques: [],
  };
}

let cache: Machine[] | null = null;
let cacheMtimeMs = 0;

/** Modification time of data/machines.json, used to invalidate the cache. */
function machinesFileMtimeMs(): number {
  try {
    return statSync(path.join(process.cwd(), "data", "machines.json")).mtimeMs;
  } catch {
    return 0;
  }
}

/** All machines, de-duplicated by slug, sorted alphabetically by model. */
export function getAllMachines(): Machine[] {
  // Re-read when the source file changes (e.g. after an admin save) so edits
  // are reflected without restarting the server. The mtime is stable during a
  // static build, so this still caches across the build.
  const mtime = machinesFileMtimeMs();
  if (cache && mtime === cacheMtimeMs) return cache;

  const techniquesByMachineId = loadTechniquesByMachineId();
  const bySlug = new Map<string, Machine>();
  // Techniques are accumulated per slug so duplicate machineIds collapsed during
  // de-duplication still contribute their technique records.
  const techniquesBySlug = new Map<string, Set<string>>();

  for (const raw of loadRawMachines()) {
    const machine = toMachine(raw);
    if (!machine) continue;
    if (!bySlug.has(machine.slug)) bySlug.set(machine.slug, machine);

    if (machine.machineId != null) {
      const techniques = techniquesByMachineId.get(machine.machineId);
      if (techniques) {
        if (!techniquesBySlug.has(machine.slug)) {
          techniquesBySlug.set(machine.slug, new Set<string>());
        }
        const acc = techniquesBySlug.get(machine.slug)!;
        for (const t of techniques) acc.add(t);
      }
    }
  }

  for (const [slug, machine] of bySlug) {
    const techniques = techniquesBySlug.get(slug);
    machine.techniques = techniques
      ? Array.from(techniques).sort((a, b) =>
          a.localeCompare(b, "en", { sensitivity: "base" })
        )
      : [];
  }

  cache = Array.from(bySlug.values()).sort((a, b) =>
    a.model.localeCompare(b.model, "en", { numeric: true, sensitivity: "base" })
  );
  cacheMtimeMs = mtime;
  return cache;
}

export function getMachineBySlug(slug: string | undefined): Machine | undefined {
  if (!slug) return undefined;
  return getAllMachines().find((m) => m.slug === slug);
}

/** Unique, sorted list of brands for the brand filter. */
export function getAllBrands(): string[] {
  const set = new Set<string>();
  for (const m of getAllMachines()) set.add(m.brand);
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
}

/** Gauge categories (PitchAlpha) ordered fine → bulky for the gauge filter. */
export function getAllGauges(): string[] {
  const ORDER = ["Fine Gauge", "Standard Gauge", "Mid-Gauge", "Bulky/Chunky"];
  const set = new Set<string>();
  for (const m of getAllMachines()) set.add(m.pitchAlpha);
  return Array.from(set).sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "en", { sensitivity: "base" });
  });
}

/** Unique, sorted list of machine types (machineStyle) for the type filter. */
export function getAllMachineStyles(): string[] {
  const set = new Set<string>();
  for (const m of getAllMachines()) {
    if (m.machineStyle) set.add(m.machineStyle);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
}

/** Build the absolute URL for a stored machine image path. */
export function machineImageUrl(relativePath: string | null | undefined): string | null {
  const value = clean(relativePath);
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean).map(encodeURIComponent);
  return `${IMAGE_BASE.replace(/\/+$/, "")}/${parts.join("/")}`;
}

/** Pick the primary image URL for a machine (main image, else first). */
export function primaryImageUrl(machine: Machine): string | null {
  const main = machine.images.find((img) => img.isMain === true) ?? machine.images[0] ?? null;
  return main ? machineImageUrl(main.url) : null;
}

/** Display the pitch as a millimetre string, e.g. "4.5 mm". */
export function formatPitch(machine: Machine): string | null {
  return machine.pitch != null ? `${machine.pitch} mm` : null;
}

/**
 * True when the model adds nothing beyond the brand (e.g. brand-only legacy
 * records where the model was filled with the brand name). Used so the display
 * shows "Prazisa" rather than "Prazisa Prazisa".
 */
export function isBrandOnly(machine: Machine): boolean {
  const model = machine.model.trim();
  return !model || model.toLowerCase() === machine.brand.trim().toLowerCase();
}

/** Display name: "Brand Model", or just "Brand" when the model is redundant. */
export function machineTitle(machine: Machine): string {
  return isBrandOnly(machine) ? machine.brand : `${machine.brand} ${machine.model}`;
}

/** Combined lowercase string used for instant client-side search matching. */
export function buildSearchIndex(machine: Machine): string {
  return [machine.brand, machine.model, machine.gauge, machine.machineStyle ?? ""]
    .join(" ")
    .toLowerCase();
}
