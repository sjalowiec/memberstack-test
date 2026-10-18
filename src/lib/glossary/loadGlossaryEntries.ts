import glossaryData from "../../data/glossary.json";
import {
  canonicalizeGlossaryEntry,
  glossaryOverrides,
  isMissingGlossaryTable,
  overlaySavedGlossaryEntries,
  parseGlossarySavePayload,
  type GlossaryEntry,
} from "./glossaryEntries";
import { listSavedGlossaryEntries, replaceSavedGlossaryEntries } from "./glossaryStore";

export function sourceGlossaryEntries(): GlossaryEntry[] {
  const raw = Array.isArray(glossaryData) ? glossaryData : [];
  const entries: GlossaryEntry[] = [];
  for (const row of raw) {
    const entry = canonicalizeGlossaryEntry(row);
    if (entry) entries.push(entry);
  }
  return entries;
}

async function readSavedOrEmpty(): Promise<GlossaryEntry[]> {
  try {
    return await listSavedGlossaryEntries();
  } catch (error) {
    if (isMissingGlossaryTable(error)) return [];
    throw error;
  }
}

/** Source file, with saved rows winning by glossary id. */
export async function loadGlossaryEntries(): Promise<GlossaryEntry[]> {
  const source = sourceGlossaryEntries();
  const saved = await readSavedOrEmpty();
  return overlaySavedGlossaryEntries(source, saved);
}

/** Public pages keep serving the source file if storage cannot be read. */
export async function loadPublicGlossaryEntries(): Promise<GlossaryEntry[]> {
  try {
    return await loadGlossaryEntries();
  } catch (error) {
    console.error("Glossary storage could not be read. Using the source file.", error);
    return sourceGlossaryEntries();
  }
}

/**
 * Store only entries that differ from the source file, including brand-new ids.
 * Unchanged source entries are not written, so a later source update can still appear.
 */
export async function saveGlossaryEntries(raw: unknown): Promise<GlossaryEntry[]> {
  const source = sourceGlossaryEntries();
  const payload = parseGlossarySavePayload(raw, source);
  const overrides = glossaryOverrides(source, payload);
  await replaceSavedGlossaryEntries(overrides);
  return overlaySavedGlossaryEntries(source, overrides);
}
