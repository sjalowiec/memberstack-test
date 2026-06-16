/**
 * Machine Database admin — shared record schema, parsing, and normalization.
 *
 * Used by both the admin page (`/admin/machines`) and the save API
 * (`/api/admin/machines`) so the client preview and the authoritative
 * server-side write stay in sync.
 *
 * The legacy catalog lives in `data/machines.json`. Records are keyed by the
 * stable numeric `machineId`. Array fields use small object shapes:
 *   - images:      { url, isMain }
 *   - accessories: { model, title, category }
 *   - manuals:     { title, type, url }
 *
 * Unknown top-level fields already present on a record are preserved on save;
 * only the known fields below are coerced.
 */

export type MachineImage = { url: string; isMain: boolean };
export type MachineAccessory = { model: string; title: string; category: string };
export type MachineManual = { title: string; type: string; url: string };

/** A machine record. Unknown keys are preserved through normalization. */
export type MachineRecord = Record<string, unknown>;

export type NormalizeResult =
  | { ok: true; machine: MachineRecord }
  | { ok: false; error: string };

export function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value);
}

/** Coerce a form/string/number value to a finite number or null. */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Coerce to a trimmed string, or null when empty. */
export function stringOrNull(value: unknown): string | null {
  const s = asString(value).trim();
  return s === "" ? null : s;
}

export function machineId(machine: MachineRecord): number | null {
  return numberOrNull(machine.machineId);
}

/** Next available machineId: one past the current maximum (min 1). */
export function nextMachineId(machines: MachineRecord[]): number {
  let max = 0;
  for (const m of machines) {
    const id = machineId(m);
    if (id !== null && id > max) max = id;
  }
  return max + 1;
}

/** Normalized lowercase "brand|model" key used to detect duplicates. */
export function brandModelKey(machine: MachineRecord): string {
  return `${asString(machine.brand).trim().toLowerCase()}|${asString(machine.model)
    .trim()
    .toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Array fields: line-based textarea (de)serialization.
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Images textarea: one image per line.
 *   url
 *   url | main      ← marks isMain = true
 */
export function parseImages(text: string): MachineImage[] {
  return splitLines(text)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const url = parts[0] ?? "";
      const isMain = parts.slice(1).some((p) => p.toLowerCase() === "main");
      return { url, isMain };
    })
    .filter((img) => img.url.length > 0);
}

export function serializeImages(value: unknown): string {
  return normalizeImages(value)
    .map((img) => (img.isMain ? `${img.url} | main` : img.url))
    .join("\n");
}

export function normalizeImages(value: unknown): MachineImage[] {
  if (!Array.isArray(value)) return [];
  const out: MachineImage[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const url = item.trim();
      if (url) out.push({ url, isMain: false });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const url = asString(rec.url).trim();
      if (url) out.push({ url, isMain: rec.isMain === true });
    }
  }
  return out;
}

/**
 * Accessories textarea: one per line.
 *   model | title | category
 */
export function parseAccessories(text: string): MachineAccessory[] {
  return splitLines(text)
    .map((line) => {
      const [model = "", title = "", category = ""] = line.split("|").map((p) => p.trim());
      return { model, title, category };
    })
    .filter((a) => a.model || a.title || a.category);
}

export function serializeAccessories(value: unknown): string {
  return normalizeAccessories(value)
    .map((a) => [a.model, a.title, a.category].join(" | "))
    .join("\n");
}

export function normalizeAccessories(value: unknown): MachineAccessory[] {
  if (!Array.isArray(value)) return [];
  const out: MachineAccessory[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const model = asString(rec.model).trim();
    const title = asString(rec.title).trim();
    const category = asString(rec.category).trim();
    if (model || title || category) out.push({ model, title, category });
  }
  return out;
}

/**
 * Manuals textarea: one per line.
 *   title | type | url
 */
export function parseManuals(text: string): MachineManual[] {
  return splitLines(text)
    .map((line) => {
      const [title = "", type = "", url = ""] = line.split("|").map((p) => p.trim());
      return { title, type, url };
    })
    .filter((m) => m.title || m.type || m.url);
}

export function serializeManuals(value: unknown): string {
  return normalizeManuals(value)
    .map((m) => [m.title, m.type, m.url].join(" | "))
    .join("\n");
}

export function normalizeManuals(value: unknown): MachineManual[] {
  if (!Array.isArray(value)) return [];
  const out: MachineManual[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = asString(rec.title).trim();
    const type = asString(rec.type).trim();
    const url = asString(rec.url).trim();
    if (title || type || url) out.push({ title, type, url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Record normalization (authoritative shape written to disk).
// ---------------------------------------------------------------------------

/**
 * Normalize one record for saving. Preserves unknown top-level fields, coerces
 * the known fields, and normalizes the three array fields.
 *
 * Requires a numeric `machineId` (the integrity key for in-place updates) and a
 * non-empty `brand`. `model` is coerced but not required here: a few legacy
 * "brand-only" records have no model, and the bulk write must preserve them.
 * The per-record brand + model requirement is enforced where a record is
 * created or edited (the admin page), not on every record in the array.
 */
export function normalizeMachineForSave(
  input: unknown,
  index: number
): NormalizeResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: `Machine #${index + 1} is not a valid object.` };
  }

  // Preserve unknown fields by starting from a shallow copy.
  const out: MachineRecord = { ...(input as MachineRecord) };

  const id = numberOrNull(out.machineId);
  if (id === null) {
    return { ok: false, error: `Machine #${index + 1} is missing a numeric machineId.` };
  }

  const brand = asString(out.brand).trim();
  if (!brand) return { ok: false, error: `Machine #${index + 1} (machineId ${id}): brand is required.` };
  const model = asString(out.model).trim();

  out.machineId = id;
  out.brand = brand;
  out.model = model;
  out.bed = stringOrNull(out.bed);
  out.gauge = stringOrNull(out.gauge);
  out.needleCount = numberOrNull(out.needleCount);
  out.machineStyle = stringOrNull(out.machineStyle);
  out.punchcardWidth = numberOrNull(out.punchcardWidth);
  out.year = numberOrNull(out.year);

  // `notes` is reserved/optional: keep it only when present and non-empty.
  const notes = stringOrNull(out.notes);
  if (notes === null) delete out.notes;
  else out.notes = notes;

  out.images = normalizeImages(out.images);
  out.accessories = normalizeAccessories(out.accessories);
  out.manuals = normalizeManuals(out.manuals);

  return { ok: true, machine: out };
}
