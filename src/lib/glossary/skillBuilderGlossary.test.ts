import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import glossary from "../../data/glossary.json";
import { slugify } from "../slugify";
import { glossarySlugFromEnglish } from "./glossaryPickerCatalog";
import { getGlossaryTooltipPayload, glossarySlugForId } from "./glossaryTooltipHydrate";

const SKILL_BUILDER_GLOSSARY_ID = 862;
const SKILL_BUILDER_SLUG = "skill-builder";
const SKILL_BUILDER_DEFINITION =
  "A short, hands-on practice tool that helps you learn one machine-knitting skill at a time. Enter your gauge, follow the chart and checklist, and practice the technique on a small sample before using it in a project.";
const SKILL_BUILDERS_LANDING_PATH = "/learn/skill-builders";

type GlossaryRow = {
  glossaryId?: number;
  english?: string;
  example?: string;
  helpinfo?: string;
  active?: boolean;
  relatedTools?: Array<{ name?: string; url?: string }>;
};

function cleanTerm(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

describe("Skill Builder glossary entry", () => {
  const entries = glossary as GlossaryRow[];
  const entry = entries.find((row) => row.glossaryId === SKILL_BUILDER_GLOSSARY_ID);

  it("is active, uniquely slugified, and uses the standard glossary route", () => {
    expect(entry).toBeDefined();
    expect(entry?.active).toBe(true);
    expect(entry?.english).toBe("Skill Builder");
    expect(slugify(cleanTerm(entry?.english))).toBe(SKILL_BUILDER_SLUG);
    expect(glossarySlugFromEnglish(String(entry?.english))).toBe(SKILL_BUILDER_SLUG);
    expect(glossarySlugForId(SKILL_BUILDER_GLOSSARY_ID)).toBe(SKILL_BUILDER_SLUG);

    const slugMatches = entries.filter(
      (row) => row.active === true && slugify(cleanTerm(row.english)) === SKILL_BUILDER_SLUG,
    );
    expect(slugMatches).toHaveLength(1);
  });

  it("stores the Skill Builder definition for the glossary index and search payload", () => {
    expect(String(entry?.helpinfo ?? "").trim()).toBe(SKILL_BUILDER_DEFINITION);
    expect(String(entry?.example ?? "").trim()).toBe("");
  });

  it("links to the existing Skill Builders landing page", () => {
    expect(existsSync(resolve(process.cwd(), "src/pages/learn/skill-builders.astro"))).toBe(true);
    expect(entry?.relatedTools).toEqual([
      { name: "Skill Builders", url: SKILL_BUILDERS_LANDING_PATH },
    ]);
  });

  it("includes the definition and landing-page link in tooltip payload HTML", () => {
    const payload = getGlossaryTooltipPayload(SKILL_BUILDER_GLOSSARY_ID);
    expect(payload?.titlePlain).toBe("Skill Builder");
    expect(payload?.cleanHtml).toContain(SKILL_BUILDER_DEFINITION);
    expect(payload?.cleanHtml).toContain(`href="${SKILL_BUILDERS_LANDING_PATH}"`);
  });
});
