import { describe, expect, it } from "vitest";
import { slugify } from "../slugify";
import {
  canonicalizeGlossaryEntry,
  glossaryEntriesEqual,
  glossaryOverrides,
  overlaySavedGlossaryEntries,
  parseGlossarySavePayload,
  type GlossaryEntry,
} from "./glossaryEntries";
import { sourceGlossaryEntries } from "./loadGlossaryEntries";

function entry(partial: Record<string, unknown>): GlossaryEntry {
  const normalized = canonicalizeGlossaryEntry({
    glossaryId: 1,
    english: "Term",
    example: "",
    helpinfo: "",
    image: "",
    image_alt: "",
    image_description: "",
    metaTitle: "",
    metaDescription: "",
    active: true,
    vimeoIds: [],
    ...partial,
  });
  if (!normalized) throw new Error("invalid test entry");
  return normalized;
}

describe("glossary entry storage", () => {
  it("keeps every current source id and slug when nothing has been saved", () => {
    const source = sourceGlossaryEntries();
    const loaded = overlaySavedGlossaryEntries(source, []);
    expect(loaded).toHaveLength(source.length);
    expect(loaded.map((row) => row.glossaryId)).toEqual(source.map((row) => row.glossaryId));
    expect(loaded.map((row) => slugify(String(row.english)))).toEqual(
      source.map((row) => slugify(String(row.english))),
    );
    expect(glossaryOverrides(source, loaded)).toEqual([]);
  });

  it("lets a saved edit win without dropping source entries or a new entry", () => {
    const source = [
      entry({ glossaryId: 172, english: "Alternate", helpinfo: "Original" }),
      entry({ glossaryId: 173, english: "Back Bed", helpinfo: "Original bed" }),
    ];
    const saved = [
      entry({ glossaryId: 172, english: "Alternate", helpinfo: "Saved help" }),
      entry({ glossaryId: 900, english: "Glossary Save Check", helpinfo: "New" }),
    ];

    const loaded = overlaySavedGlossaryEntries(source, saved);

    expect(loaded.map((row) => row.glossaryId)).toEqual([172, 173, 900]);
    expect(loaded[0]?.helpinfo).toBe("Saved help");
    expect(loaded[1]?.helpinfo).toBe("Original bed");
    expect(slugify(String(loaded[0]?.english))).toBe("alternate");
    expect(slugify(String(loaded[2]?.english))).toBe("glossary-save-check");
  });

  it("does not let the source file replace a newer saved field", () => {
    const source = [entry({ glossaryId: 172, english: "Alternate", example: "File example" })];
    const saved = [entry({ glossaryId: 172, english: "Alternate", example: "Saved example" })];
    const loaded = overlaySavedGlossaryEntries(source, saved);
    expect(loaded[0]?.example).toBe("Saved example");
    expect(glossaryEntriesEqual(loaded[0]!, source[0]!)).toBe(false);
  });

  it("rejects a save that would drop an existing id", () => {
    const source = [entry({ glossaryId: 172 }), entry({ glossaryId: 173 })];
    expect(() => parseGlossarySavePayload([source[0]], source)).toThrow(/drop 1 existing/);
  });

  it("stores a changed entry and a new entry, and skips unchanged source rows", () => {
    const source = [entry({ glossaryId: 172, english: "Alternate", example: "Same" })];
    const payload = parseGlossarySavePayload(
      [
        entry({ glossaryId: 172, english: "Alternate", example: "Edited" }),
        entry({ glossaryId: 900, english: "Glossary Save Check", relatedTools: [{ name: "Tool", url: "/tools" }] }),
      ],
      source,
    );
    const overrides = glossaryOverrides(source, payload);
    expect(overrides.map((row) => row.glossaryId)).toEqual([172, 900]);
    expect(overrides[1]?.relatedTools).toEqual([{ name: "Tool", url: "/tools" }]);
  });
});
