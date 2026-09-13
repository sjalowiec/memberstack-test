import { describe, expect, it } from "vitest";
import { glossarySlugForId } from "../glossary/glossaryTooltipHydrate";
import {
  resolveIntroGlossaryEntry,
  tipOfTheWeekIntroParts,
} from "./introGlossary";

const FAIR_ISLE_INTRO =
  "When knitting Fair Isle, long floats on the back of your knitting can snag and make finishing difficult. Explore practical ways to manage, secure, hide, or avoid long floats when working with color.";

describe("Tip of the Week intro glossary tooltips", () => {
  it("resolves glossary slugs and phrases without requiring a numeric id", () => {
    expect(resolveIntroGlossaryEntry("floats")).toEqual({
      glossaryId: 269,
      slug: "floats",
    });
    expect(glossarySlugForId(269)).toBe("floats");
    expect(resolveIntroGlossaryEntry("fair-isle")?.glossaryId).toBe(217);
    expect(resolveIntroGlossaryEntry("public-side")?.glossaryId).toBe(322);
    expect(resolveIntroGlossaryEntry("ribbing")?.glossaryId).toBeDefined();
    expect(resolveIntroGlossaryEntry("")).toBeNull();
    expect(resolveIntroGlossaryEntry("not-a-real-glossary-term")).toBeNull();
  });

  it("adds a glossary tooltip on the first matching intro mention only", () => {
    const parts = tipOfTheWeekIntroParts(FAIR_ISLE_INTRO, "floats");
    expect(parts).toEqual([
      { type: "text", text: "When knitting Fair Isle, long " },
      { type: "glossary", glossaryId: 269, text: "floats" },
      {
        type: "text",
        text: " on the back of your knitting can snag and make finishing difficult. Explore practical ways to manage, secure, hide, or avoid long floats when working with color.",
      },
    ]);
    expect(parts.filter((part) => part.type === "glossary")).toEqual([
      { type: "glossary", glossaryId: 269, text: "floats" },
    ]);
    expect(parts.map((part) => part.text).join("")).toBe(FAIR_ISLE_INTRO);
  });

  it("leaves the intro as plain text when the glossary field is empty or unmatched", () => {
    expect(tipOfTheWeekIntroParts(FAIR_ISLE_INTRO)).toEqual([
      { type: "text", text: FAIR_ISLE_INTRO },
    ]);
    expect(tipOfTheWeekIntroParts(FAIR_ISLE_INTRO, "")).toEqual([
      { type: "text", text: FAIR_ISLE_INTRO },
    ]);
    expect(tipOfTheWeekIntroParts(FAIR_ISLE_INTRO, "ribbing")).toEqual([
      { type: "text", text: FAIR_ISLE_INTRO },
    ]);
    expect(tipOfTheWeekIntroParts("No glossary phrase here.", "floats")).toEqual([
      { type: "text", text: "No glossary phrase here." },
    ]);
  });

  it("matches hyphenated slugs to spaced phrases in the intro", () => {
    const parts = tipOfTheWeekIntroParts(
      "When knitting Fair Isle, long floats can snag.",
      "fair-isle",
    );
    expect(parts.filter((part) => part.type === "glossary")).toEqual([
      { type: "glossary", glossaryId: 217, text: "Fair Isle" },
    ]);
    expect(parts.map((part) => part.text).join("")).toBe(
      "When knitting Fair Isle, long floats can snag.",
    );
  });
});
