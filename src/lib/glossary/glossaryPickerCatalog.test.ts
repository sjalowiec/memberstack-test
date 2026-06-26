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

  it("escapes link text in generated html", () => {
    expect(buildGlossaryLinkHtml("back-bed", "Back & Bed")).toBe(
      `<a href="/glossary/back-bed" class="glossary-link">Back &amp; Bed</a>`,
    );
  });
});
