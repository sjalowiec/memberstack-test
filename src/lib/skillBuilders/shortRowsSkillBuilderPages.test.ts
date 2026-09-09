import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { vimeoNumericIdFromPublicVideo } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import {
  SHORT_ROWS_CATALOG_SUBTITLE,
  SHORT_ROWS_COMPLETION_OPTIONS,
  SHORT_ROWS_PATH,
  SHORT_ROWS_PRACTICE_1_STEPS,
  SHORT_ROWS_PRACTICE_2_STEPS,
  SHORT_ROWS_PRACTICE_SETUP,
  SHORT_ROWS_WHAT_YOULL_LEARN,
} from "./shortRowsSkillBuilder";
import { SHORT_ROWS_VIDEO_CONTENT_ID } from "./shortRowsSkillBuilderVideos";

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");
const catalog = videosPublic as PublicVideoRow[];

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

const REMOVED_COPY = [
  "What You're Practicing",
  "Print Worksheet",
  "toolPrintTitle",
  "<PrintButton",
  "kbm-print-button",
  "data-sb-diagram",
  "SkillBuilderGaugeInput",
  "SkillBuilderDiagram",
  "sb-related-card",
  "skill-buider.png",
];

describe("Short Rows Practice Skill Builder pages", () => {
  const page = readPage("short-rows.astro");
  const component = readFileSync(
    join(componentsDir, "ShortRowsSkillBuilder.astro"),
    "utf8",
  );
  const videosSource = readFileSync(
    join(process.cwd(), "src/lib/skillBuilders/shortRowsSkillBuilderVideos.ts"),
    "utf8",
  );
  const listing = readFileSync(join(pagesDir, "..", "skill-builders.astro"), "utf8");
  const row = findPublicVideoByContentId(catalog, 330);
  const vimeoId = row ? vimeoNumericIdFromPublicVideo(row) : "";

  it("uses a stable public route without print chrome", () => {
    expect(page).toContain("export const prerender = true");
    expect(page).toContain("ShortRowsSkillBuilder");
    expect(page).toContain("getShortRowsSkillBuilder");
    expect(page).not.toContain("toolPrintTitle");
    expect(SHORT_ROWS_PATH).toBe("/learn/skill-builders/short-rows");
  });

  it("gates the Skill Builder for logged-out and non-member visitors", () => {
    expect(component).toContain("SkillBuilderMemberGate");
    expect(component).toMatch(
      /<SkillBuilderMemberGate>[\s\S]*What You'll Learn[\s\S]*GatedVimeoEmbed[\s\S]*Practice Setup[\s\S]*practice1Heading[\s\S]*practice2Heading[\s\S]*data-sb-completion/,
    );
    expect(component).not.toContain('access_level="open"');
    expect(component).toContain("access_level={video.accessLevel}");
  });

  it("renders required exercise content, video #330, and the completion prompt", () => {
    expect(component).toContain("SkillBuilderPageHeader");
    expect(component).toContain("data-sb-short-rows");
    expect(component).toContain("builder.subtitle");
    expect(component).toContain("What You'll Learn");
    expect(component).toContain("builder.whatYoullLearn");
    expect(component).toContain("Practice Setup");
    expect(component).toContain("builder.practiceSetup");
    expect(component).toContain("builder.practice1Heading");
    expect(component).toContain("builder.practice2Heading");
    expect(component).toContain("builder.sueTip");
    expect(component).toContain("data-sb-sue-tip");
    expect(component).toContain("data-sb-completion");
    expect(component).toContain("builder.completionPrompt");
    expect(component).toContain("builder.completionOptions");
    expect(component).toContain('href="/learn/skill-builders" data-sb-print-hide>Skill Builders</a>');
    expect(component).toContain('href="/learn/skill-builders" data-sb-print-hide>Back to Skill Builders</a>');
    expect(component).toContain("GatedVimeoEmbed");
    expect(component).toContain("video.vimeoId");
    expect(component).toContain("data-sb-video-content-id={String(video.contentId)}");
    expect(component).toContain("Watch");
    expect(component).toContain("access_level={video.accessLevel}");
    expect(SHORT_ROWS_VIDEO_CONTENT_ID).toBe(330);
    expect(SHORT_ROWS_WHAT_YOULL_LEARN).toHaveLength(5);
    expect(SHORT_ROWS_PRACTICE_SETUP).toHaveLength(6);
    expect(SHORT_ROWS_PRACTICE_1_STEPS).toHaveLength(9);
    expect(SHORT_ROWS_PRACTICE_2_STEPS).toHaveLength(11);
    expect(SHORT_ROWS_COMPLETION_OPTIONS).toEqual([
      "Manual wrapping",
      "Automatic wrapping",
      "I need another try",
    ]);
    expect(component).toMatch(
      /What You'll Learn[\s\S]*data-sb-video-content-id[\s\S]*Watch[\s\S]*Practice Setup[\s\S]*practice1Heading[\s\S]*practice2Heading[\s\S]*data-sb-sue-tip[\s\S]*data-sb-completion/,
    );
    expect(component).toContain("shortRowsIntroParts");
    expect(component).toContain('<div class="sb-practice-hero__intro">');
    expect(component).not.toContain('<p class="sb-practice-hero__intro">');
    expect(component).not.toMatch(/sb-practice-hero__intro[\s\S]{0,200}<br/i);
    expect(component).toContain("GlossaryTooltip");
    expect(component).toContain("part.glossaryId");
    expect(component).toContain('import "../../styles/glossary-tooltip.css"');
    expect(component).toMatch(
      /\.sb-practice-page :global\(sup\.glossary-tooltip-icon\) \{[\s\S]*?display: none;/,
    );
    expect(component).toContain("[data-sb-short-rows] :global(button.glossary-tooltip-trigger)");
    expect(component).toContain("font-weight: inherit");
    expect(component).toContain("background-image: none");
    expect(component).not.toMatch(
      /\.sb-practice-page :global\(\.glossary-tooltip-trigger\) \{[\s\S]*?font-weight: 600/,
    );
    expect(component).toContain('src="/images/skill-builders/short-rows.png"');
    expect(component).toContain(
      'alt="Diagram showing progressively shortened rows in three colors"',
    );
    expect(component).toContain("sb-intro-layout");
    expect(component).toContain("sb-intro-media");
    expect(component).toContain("grid-template-columns");
    expect(component.split("/images/skill-builders/short-rows.png")).toHaveLength(2);
    expect(component).not.toContain("kin-dev.netlify.app");
    expect(component).not.toContain("sb-related-card");
    for (const copy of REMOVED_COPY) {
      expect(component).not.toContain(copy);
      expect(page).not.toContain(copy);
    }
  });

  it("does not hard-code a Vimeo player URL or Vimeo ID", () => {
    expect(component).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(page).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(videosSource).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(videosSource).toContain("SHORT_ROWS_VIDEO_CONTENT_ID = 330");
    expect(videosSource).toContain("catalogVideoSlotForContentId");
    expect(videosSource).not.toMatch(/vimeoId:\s*["']\d+["']/);
    expect(vimeoId).toMatch(/^\d+$/);
    expect(page).not.toContain(vimeoId);
    expect(component).not.toContain(vimeoId);
    expect(videosSource).not.toContain(vimeoId);
  });

  it("does not duplicate the catalog video transcript or description on the page", () => {
    const description = typeof row?.description === "string" ? row.description.trim() : "";
    expect(description.length).toBeGreaterThan(20);
    expect(component).not.toContain(description);
    expect(page).not.toContain(description);
    expect(component).not.toContain("Explore these 2 methods, then try them yourself");
  });

  it("lists the builder on the Skill Builders catalog with the other member cards", () => {
    expect(listing).toContain(SHORT_ROWS_PATH);
    expect(listing).toContain("Short Rows Practice");
    expect(listing).toContain(SHORT_ROWS_CATALOG_SUBTITLE);
    expect(listing).toContain("/images/skill-builders/short-rows.png");
    expect(listing).toContain("/learn/skill-builders/e-wrap-cast-on-basics");
    expect(listing).toContain("More Skill Builders");
    const comingSoonConst = listing.slice(
      listing.indexOf("const comingSoonItems"),
      listing.indexOf("<Layout"),
    );
    expect(comingSoonConst).not.toContain("Short Rows Practice");
  });

  it("adds a reusable Print Practice control without tools print chrome", () => {
    expect(component).toContain("SkillBuilderPrintButton");
    expect(component).toContain("sb-card__heading");
    expect(component).toContain("data-sb-print-root");
    expect(component).toContain("data-sb-print-hide");
    expect(component).toContain('ariaLabel={`Print ${builder.title}`}');
    expect(component).toMatch(
      /Practice Setup[\s\S]*SkillBuilderPrintButton[\s\S]*practiceSetup/,
    );
    expect(component).toMatch(
      /data-sb-video-content-id[\s\S]*data-sb-print-hide/,
    );
    expect(component).toMatch(/data-sb-completion[\s\S]*data-sb-print-hide/);
    expect(component).not.toContain("Print Worksheet");
    expect(component).not.toContain("<PrintButton");
    expect(component).not.toContain("kbm-print-button");
    expect(component).not.toContain("toolPrintTitle");
    expect(page).not.toContain("<PrintButton");
    expect(page).not.toContain("toolPrintTitle");
    expect(
      readFileSync(join(componentsDir, "EWrapCastOnSkillBuilder.astro"), "utf8"),
    ).not.toContain("SkillBuilderPrintButton");
    expect(
      readFileSync(join(componentsDir, "JoiningShoulderSeamsSkillBuilder.astro"), "utf8"),
    ).not.toContain("SkillBuilderPrintButton");
  });
});
