import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import glossary from "../../data/glossary.json";
import { JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID } from "./shapingNotationGlossary";
import { shouldPlaceGlossaryImageAfterHelpinfo } from "./glossaryEntryImagePlacement";
import { slugify } from "../slugify";

describe("shouldPlaceGlossaryImageAfterHelpinfo", () => {
  it("is false by default and true only when the entry opts in", () => {
    expect(shouldPlaceGlossaryImageAfterHelpinfo(undefined)).toBe(false);
    expect(shouldPlaceGlossaryImageAfterHelpinfo({})).toBe(false);
    expect(shouldPlaceGlossaryImageAfterHelpinfo({ imageAfterHelpinfo: false })).toBe(false);
    expect(shouldPlaceGlossaryImageAfterHelpinfo({ imageAfterHelpinfo: true })).toBe(true);
  });
});

describe("Japanese Notation (Traditional) image placement", () => {
  const entry = (glossary as Array<Record<string, unknown>>).find(
    (row) => row.glossaryId === JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID,
  );

  it("uses the traditional slug and keeps image metadata unchanged", () => {
    expect(entry).toBeDefined();
    const title = String(entry?.english ?? "").replace(/<[^>]*>/g, "").trim();
    expect(slugify(title)).toBe("japanese-notation-traditional");
    expect(entry?.image).toBe("/images/glossary/japanese-knitting-notation-symbols-diagram.jpg");
    expect(entry?.image_alt).toBe(
      "Diagram of Japanese knitting notation symbols on a garment piece",
    );
    expect(String(entry?.helpinfo ?? "")).toContain("Shaping Notation (Knit It Now)");
  });

  it("opts into placing the image after helpinfo", () => {
    expect(shouldPlaceGlossaryImageAfterHelpinfo(entry)).toBe(true);
    expect(entry?.imageAfterHelpinfo).toBe(true);
  });

  it("GlossaryEntry renders opted-in images after helpinfo (page and modal)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/GlossaryEntry.astro"),
      "utf8",
    );
    expect(source).toContain("shouldPlaceGlossaryImageAfterHelpinfo");
    const helpinfoIdx = source.indexOf('class="glossary-entry-helpinfo"');
    const afterImageIdx = source.indexOf("{imageSrc && imageAfterHelpinfo");
    expect(helpinfoIdx).toBeGreaterThan(-1);
    expect(afterImageIdx).toBeGreaterThan(helpinfoIdx);

    const modalSource = readFileSync(
      resolve(process.cwd(), "src/pages/glossary/modal/[slug].astro"),
      "utf8",
    );
    expect(modalSource).toContain("<GlossaryEntry");
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/pages/glossary/[slug].astro"),
      "utf8",
    );
    expect(pageSource).toContain("<GlossaryEntry");
  });
});
