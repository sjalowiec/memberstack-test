import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import glossary from "../../data/glossary.json";
import { slugify } from "../slugify";
import {
  JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID,
  SHAPING_NOTATION_KIN_GLOSSARY_ID,
} from "./shapingNotationGlossary";
import { getGlossaryTooltipPayload, glossarySlugForId } from "./glossaryTooltipHydrate";

const SHORT_ROW_INCREASE_ID = 1789995174575;
const SHORT_ROW_DECREASE_ID = 1789995192454;
const SHORT_ROW_PARTIAL_KNITTING_ID = 811;
const EVERY_OTHER_ROW_ID = 182;
const MANUAL_WRAP_ID = 718;
const SHORT_ROW_IMAGE = "/images/glossary/short-row-increase-decrease.jpg";

type GlossaryRow = {
  glossaryId?: number;
  english?: string;
  helpinfo?: string;
  image?: string;
  active?: boolean;
  vimeoIds?: unknown;
};

function cleanTerm(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

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

describe("short-row increase and decrease glossary entries", () => {
  const entries = glossary as GlossaryRow[];
  const increase = entries.find((row) => row.glossaryId === SHORT_ROW_INCREASE_ID);
  const decrease = entries.find((row) => row.glossaryId === SHORT_ROW_DECREASE_ID);

  it("keeps the approved IDs unique and active", () => {
    expect(entries.filter((row) => row.glossaryId === SHORT_ROW_INCREASE_ID)).toHaveLength(1);
    expect(entries.filter((row) => row.glossaryId === SHORT_ROW_DECREASE_ID)).toHaveLength(1);
    expect(increase?.active).toBe(true);
    expect(decrease?.active).toBe(true);
    expect(increase?.english).toBe("Short-row Increase");
    expect(decrease?.english).toBe("Short-row Decrease");
  });

  it("uses unique public slugs", () => {
    expect(glossarySlugForId(SHORT_ROW_INCREASE_ID)).toBe("short-row-increase");
    expect(glossarySlugForId(SHORT_ROW_DECREASE_ID)).toBe("short-row-decrease");
    const activeSlugs = entries
      .filter((row) => row.active === true)
      .map((row) => slugify(cleanTerm(row.english)));
    expect(activeSlugs.filter((slug) => slug === "short-row-increase")).toHaveLength(1);
    expect(activeSlugs.filter((slug) => slug === "short-row-decrease")).toHaveLength(1);
  });

  it("embeds reciprocal and related glossary links that resolve", () => {
    const increaseHtml = getGlossaryTooltipPayload(SHORT_ROW_INCREASE_ID)?.cleanHtml ?? "";
    const decreaseHtml = getGlossaryTooltipPayload(SHORT_ROW_DECREASE_ID)?.cleanHtml ?? "";
    expect(increaseHtml).toContain(`data-glossary-id="${SHORT_ROW_DECREASE_ID}"`);
    expect(decreaseHtml).toContain(`data-glossary-id="${SHORT_ROW_INCREASE_ID}"`);
    for (const html of [increaseHtml, decreaseHtml]) {
      expect(html).toContain(`data-glossary-id="${SHORT_ROW_PARTIAL_KNITTING_ID}"`);
      expect(html).toContain(`data-glossary-id="${EVERY_OTHER_ROW_ID}"`);
      expect(html).toContain(`data-glossary-id="${MANUAL_WRAP_ID}"`);
    }
    expect(glossarySlugForId(SHORT_ROW_PARTIAL_KNITTING_ID)).toBe("short-row-partial-knitting");
    expect(glossarySlugForId(EVERY_OTHER_ROW_ID)).toBe("every-other-row");
    expect(glossarySlugForId(MANUAL_WRAP_ID)).toBe("manual-wrap");
  });

  it("shares the committed short-row image and has no Vimeo IDs", () => {
    expect(increase?.image).toBe(SHORT_ROW_IMAGE);
    expect(decrease?.image).toBe(SHORT_ROW_IMAGE);
    expect(increase?.vimeoIds).toEqual([]);
    expect(decrease?.vimeoIds).toEqual([]);
    expect(existsSync(resolve(process.cwd(), "public/images/glossary/short-row-increase-decrease.jpg"))).toBe(
      true,
    );
  });
});
