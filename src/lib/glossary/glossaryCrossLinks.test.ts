import { describe, expect, it } from "vitest";
import {
  JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID,
  SHAPING_NOTATION_KIN_GLOSSARY_ID,
} from "./shapingNotationGlossary";
import { getGlossaryTooltipPayload, glossarySlugForId } from "./glossaryTooltipHydrate";

describe("glossary cross-links", () => {
  it("resolves slugs for shaping notation reciprocal entries", () => {
    expect(glossarySlugForId(JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID)).toBe(
      "japanese-notation-traditional",
    );
    expect(glossarySlugForId(SHAPING_NOTATION_KIN_GLOSSARY_ID)).toBe("shaping-notation-knit-it-now");
  });

  it("embeds reciprocal cross-link ids in tooltip payload help HTML", () => {
    const shaping = getGlossaryTooltipPayload(SHAPING_NOTATION_KIN_GLOSSARY_ID);
    const japanese = getGlossaryTooltipPayload(JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID);
    expect(shaping?.cleanHtml).toContain(
      `data-glossary-id="${JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID}"`,
    );
    expect(japanese?.cleanHtml).toContain(`data-glossary-id="${SHAPING_NOTATION_KIN_GLOSSARY_ID}"`);
  });
});
