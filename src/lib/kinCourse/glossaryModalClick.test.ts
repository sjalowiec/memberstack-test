import { describe, expect, it } from "vitest";
import { courseGlossaryClick, siteGlossarySlugForId } from "./glossaryModalClick";

const course66 = [
  { glossaryId: 184 },
  { glossaryId: 267 },
  { glossaryId: 381 },
  { glossaryId: 382 },
];

describe("course glossary clicks", () => {
  it("opens Full Needle Rib from the course catalog and Isolated Motif from the site glossary", () => {
    expect(courseGlossaryClick(184, course66)).toEqual({ type: "course", glossaryId: 184 });
    expect(courseGlossaryClick(713, course66)).toEqual({ type: "site", slug: "isolated-motif" });
    expect(siteGlossarySlugForId(184)).toBe("full-needle-rib");
    expect(siteGlossarySlugForId(713)).toBe("isolated-motif");
  });

  it("keeps Isolated Motif on the course modal when that course catalogs it", () => {
    expect(courseGlossaryClick(713, [{ glossaryId: 713 }])).toEqual({
      type: "course",
      glossaryId: 713,
    });
  });

  it("opens Full Needle Rib from the site glossary when the course catalog is empty", () => {
    expect(courseGlossaryClick(184, [])).toEqual({ type: "site", slug: "full-needle-rib" });
  });

  it("ignores unknown ids", () => {
    expect(courseGlossaryClick(0, course66)).toEqual({ type: "ignore" });
    expect(courseGlossaryClick(999999, course66)).toEqual({ type: "ignore" });
  });
});
