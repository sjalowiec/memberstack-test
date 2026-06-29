import { describe, expect, it } from "vitest";
import {
  buildGlossaryLinkHtml,
  buildGlossaryPickerCatalog,
  filterGlossaryPickerRows,
  glossarySlugFromEnglish,
} from "./glossaryPickerCatalog";

describe("glossaryPickerCatalog", () => {
  it("builds slugs the same way as glossary pages", () => {
    expect(glossarySlugFromEnglish("Back Bed")).toBe("back-bed");
    expect(glossarySlugFromEnglish("<strong>Alternate</strong>")).toBe("alternate");
  });

  it("builds picker rows from glossary entries", () => {
    const rows = buildGlossaryPickerCatalog([
      { glossaryId: 173, english: "Back Bed", active: true },
      { glossaryId: 172, english: "Alternate", active: false },
      { glossaryId: "x", english: "" },
    ]);
    expect(rows).toEqual([
      { glossaryId: 172, term: "Alternate", slug: "alternate", active: false },
      { glossaryId: 173, term: "Back Bed", slug: "back-bed", active: true },
    ]);
  });

  it("filters rows by term name", () => {
    const rows = buildGlossaryPickerCatalog([
      { glossaryId: 1, english: "Back Bed", active: true },
      { glossaryId: 2, english: "Front Bed", active: true },
    ]);
    expect(filterGlossaryPickerRows(rows, "back")).toEqual([
      { glossaryId: 1, term: "Back Bed", slug: "back-bed", active: true },
    ]);
  });

  it("returns the full catalog when no search query is given", () => {
    const rows = buildGlossaryPickerCatalog(
      Array.from({ length: 55 }, (_, index) => ({
        glossaryId: index + 1,
        english: `Term ${String(index).padStart(2, "0")}`,
        active: true,
      })),
    );
    expect(filterGlossaryPickerRows(rows, "")).toHaveLength(55);
  });

  it("respects an explicit result limit", () => {
    const rows = buildGlossaryPickerCatalog(
      Array.from({ length: 10 }, (_, index) => ({
        glossaryId: index + 1,
        english: `Term ${index}`,
        active: true,
      })),
    );
    expect(filterGlossaryPickerRows(rows, "", 3)).toHaveLength(3);
  });

  it("escapes link text in generated html", () => {
    expect(buildGlossaryLinkHtml("back-bed", "Back & Bed")).toBe(
      `<a href="/glossary/back-bed" class="glossary-link">Back &amp; Bed</a>`,
    );
  });
});
