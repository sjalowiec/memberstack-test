export type GlossaryEntry = Record<string, unknown> & {
  glossaryId: number;
};

export class GlossarySaveError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GlossarySaveError";
    this.status = status;
  }
}

const RETAINED_FORM = "Your changes are still in the editor.";

export function glossarySaveError(message: string, status = 400): GlossarySaveError {
  const text = message.includes(RETAINED_FORM) ? message : `${message} ${RETAINED_FORM}`;
  return new GlossarySaveError(text, status);
}

export function normalizeGlossaryEntry(raw: unknown): GlossaryEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = { ...(raw as Record<string, unknown>) };
  const id = record.glossaryId;
  const glossaryId = typeof id === "number" ? id : Number(id);
  if (!Number.isInteger(glossaryId)) return null;
  record.glossaryId = glossaryId;
  return record as GlossaryEntry;
}

/** Match the admin editor's field cleanup without dropping extra keys. */
export function canonicalizeGlossaryEntry(raw: unknown): GlossaryEntry | null {
  const entry = normalizeGlossaryEntry(raw);
  if (!entry) return null;
  entry.english = String(entry.english ?? "");
  entry.example = String(entry.example ?? "");
  entry.helpinfo = String(entry.helpinfo ?? "");
  entry.image = String(entry.image ?? "");
  entry.image_alt = String(entry.image_alt ?? "");
  entry.image_description = String(entry.image_description ?? "");
  entry.metaTitle = String(entry.metaTitle ?? "");
  entry.metaDescription = String(entry.metaDescription ?? "");
  entry.active =
    entry.active === true || entry.active === "true" || entry.active === 1 || entry.active === "1";
  const videos = entry.vimeoIds;
  entry.vimeoIds = Array.isArray(videos) ? videos.map((id) => String(id)) : [];
  return entry;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function glossaryEntriesEqual(left: GlossaryEntry, right: GlossaryEntry): boolean {
  return stableJson(left) === stableJson(right);
}

/**
 * Saved rows win by glossary id. Source entries that have never been saved stay
 * in the catalog. Saved rows are not replaced by the source file.
 */
export function overlaySavedGlossaryEntries(
  source: GlossaryEntry[],
  saved: GlossaryEntry[],
): GlossaryEntry[] {
  if (saved.length === 0) return source.map((entry) => ({ ...entry }));
  const savedById = new Map(saved.map((entry) => [entry.glossaryId, entry]));
  const sourceIds = new Set(source.map((entry) => entry.glossaryId));
  const merged = source.map((entry) => ({ ...(savedById.get(entry.glossaryId) ?? entry) }));
  for (const entry of saved) {
    if (!sourceIds.has(entry.glossaryId)) merged.push({ ...entry });
  }
  return merged;
}

export function glossaryOverrides(source: GlossaryEntry[], payload: GlossaryEntry[]): GlossaryEntry[] {
  const sourceById = new Map(source.map((entry) => [entry.glossaryId, entry]));
  const overrides: GlossaryEntry[] = [];
  for (const entry of payload) {
    const original = sourceById.get(entry.glossaryId);
    if (!original || !glossaryEntriesEqual(original, entry)) overrides.push(entry);
  }
  return overrides;
}

export function parseGlossarySavePayload(raw: unknown, source: GlossaryEntry[]): GlossaryEntry[] {
  if (!Array.isArray(raw)) {
    throw glossarySaveError("Glossary save must be a list of entries, so nothing was saved.");
  }

  const payload: GlossaryEntry[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const entry = canonicalizeGlossaryEntry(item);
    if (!entry) {
      throw glossarySaveError("A glossary entry is missing a valid id, so nothing was saved.");
    }
    if (seen.has(entry.glossaryId)) {
      throw glossarySaveError(
        `Glossary id ${entry.glossaryId} was sent twice, so nothing was saved.`,
      );
    }
    seen.add(entry.glossaryId);
    payload.push(entry);
  }

  const missing = source.filter((entry) => !seen.has(entry.glossaryId)).map((entry) => entry.glossaryId);
  if (missing.length > 0) {
    const sample = missing.slice(0, 5).join(", ");
    throw glossarySaveError(
      `This save would drop ${missing.length} existing glossary entries (${sample}), so nothing was saved.`,
    );
  }

  return payload;
}

export function glossaryErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof GlossarySaveError) return error.message;
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const raw = error instanceof Error ? error.message : "";
  if (code === "42P01" || /glossary_entries/i.test(raw) && /does not exist/i.test(raw)) {
    return `Glossary storage is not ready, so nothing was saved. ${RETAINED_FORM}`;
  }
  if (!raw || /ECONNREFUSED|ENOTFOUND|password|postgres:\/\//i.test(raw)) return fallback;
  return fallback;
}

export function isMissingGlossaryTable(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const raw = error instanceof Error ? error.message : "";
  return code === "42P01" || (/glossary_entries/i.test(raw) && /does not exist/i.test(raw));
}
