import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOINING_SHOULDER_SEAMS_CATALOG_SUBTITLE,
  JOINING_SHOULDER_SEAMS_CHECKLIST,
  JOINING_SHOULDER_SEAMS_PATH,
  JOINING_SHOULDER_SEAMS_PRIVATE_SIDE_GLOSSARY_ID,
  JOINING_SHOULDER_SEAMS_PUBLIC_SIDE_GLOSSARY_ID,
  JOINING_SHOULDER_SEAMS_RELATED_PRACTICE,
  JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID,
} from "./joiningShoulderSeamsSkillBuilder";
import { JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID } from "./joiningShoulderSeamsSkillBuilderVideos";

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

const REMOVED_COPY = [
  "What You're Practicing",
  "Practice Piece",
  "Before You Begin",
  "Join the Seam",
  "Pause and Check",
  "Finish",
  "Print Worksheet",
  "When you join a sweater",
  "___ shoulder stitches",
  "Practice shaping a neckline",
  "toolPrintTitle",
  "PrintButton",
  "data-sb-diagram",
  "joiningShoulderSeamsSkillBuilderDiagram",
  "joiningShoulderSeamsSkillBuilderPage",
  "sb-related-practice",
  "skill-buider.png",
];

describe("Join Beautiful Shoulder Seams Skill Builder pages", () => {
  const page = readPage("join-beautiful-shoulder-seams.astro");
  const component = readFileSync(
    join(componentsDir, "JoiningShoulderSeamsSkillBuilder.astro"),
    "utf8",
  );
  const catalog = readFileSync(join(pagesDir, "..", "skill-builders.astro"), "utf8");

  it("uses a stable public route without print chrome", () => {
    expect(page).toContain("export const prerender = true");
    expect(page).toContain("JoiningShoulderSeamsSkillBuilder");
    expect(page).toContain("getJoiningShoulderSeamsSkillBuilder");
    expect(page).not.toContain("toolPrintTitle");
    expect(JOINING_SHOULDER_SEAMS_PATH).toBe("/learn/skill-builders/join-beautiful-shoulder-seams");
  });

  it("gates the Skill Builder for logged-out and non-member visitors", () => {
    expect(component).toContain("SkillBuilderMemberGate");
    expect(component).toMatch(
      /<SkillBuilderMemberGate>[\s\S]*What You'll Practice[\s\S]*Shoulder Seam Checklist[\s\S]*GatedVimeoEmbed/,
    );
    expect(component).not.toContain('access_level="open"');
    expect(component).toContain("access_level={video.accessLevel}");
  });

  it("renders What You'll Practice, checklist, Watch, then a related Skill Builder card", () => {
    expect(component).toContain("SkillBuilderPageHeader");
    expect(component).toContain("data-sb-joining-shoulder-seams");
    expect(component).toContain("What You'll Practice");
    expect(component).toContain("builder.whatYoullPractice");
    expect(component).toContain("Shoulder Seam Checklist");
    expect(component).toContain("builder.checklist");
    expect(component).toContain("GatedVimeoEmbed");
    expect(component).toContain("video.vimeoId");
    expect(component).toContain('data-sb-video-content-id={String(video.contentId)}');
    expect(component).toContain("Watch");
    expect(component).toContain("access_level={video.accessLevel}");
    expect(JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID).toBe(202);
    expect(JOINING_SHOULDER_SEAMS_CHECKLIST).toHaveLength(6);
    expect(component).toMatch(
      /What You'll Practice[\s\S]*Shoulder Seam Checklist[\s\S]*data-sb-video-content-id[\s\S]*Watch[\s\S]*sb-related-card/,
    );
    expect(component).toContain("joiningShoulderSeamsIntroParts");
    expect(component).toContain("introParts");
    expect(component).toContain("GlossaryTooltip");
    expect(component).toContain("part.glossaryId");
    expect(JOINING_SHOULDER_SEAMS_THREE_NEEDLE_GLOSSARY_ID).toBe(522);
    expect(JOINING_SHOULDER_SEAMS_PUBLIC_SIDE_GLOSSARY_ID).toBe(322);
    expect(JOINING_SHOULDER_SEAMS_PRIVATE_SIDE_GLOSSARY_ID).toBe(323);
    expect(component).toContain("JOINING_SHOULDER_SEAMS_RELATED_PRACTICE");
    expect(JOINING_SHOULDER_SEAMS_RELATED_PRACTICE.href).toBe(
      "/learn/skill-builders/round-neckline-basics",
    );
    expect(JOINING_SHOULDER_SEAMS_RELATED_PRACTICE.eyebrow).toBe("RELATED SKILL BUILDER");
    expect(JOINING_SHOULDER_SEAMS_RELATED_PRACTICE.title).toBe("Shape a Round Neckline");
    expect(JOINING_SHOULDER_SEAMS_RELATED_PRACTICE.supportingText).toBe(
      "Practice the neckline shaping that comes before you join the shoulders.",
    );
    expect(component).toContain("sb-related-card__eyebrow");
    expect(component).toContain("sb-related-card__title");
    expect(component).toContain("sb-related-card__copy");
    expect(component).toContain("sb-related-card__body");
    expect(component).toContain("sb-related-card__content");
    expect(component).toMatch(
      /sb-related-card__eyebrow[\s\S]*sb-related-card__body[\s\S]*sb-related-card__icon[\s\S]*sb-related-card__content[\s\S]*sb-related-card__title[\s\S]*sb-related-card__copy/,
    );
    expect(component).toContain('src="/icons/tools/skill-builder-steps.svg"');
    expect(component).toContain('width="60"');
    expect(component).toContain('height="60"');
    expect(component).toContain("width: 60px");
    expect(component).toContain("height: 60px");
    expect(component).not.toContain("sb-related-card__heading");
    expect(component).not.toContain('width="22"');
    expect(component).not.toContain("width: 22px");
    expect(component).toContain('alt=""');
    expect(component).toContain('aria-hidden="true"');
    expect(component).toContain("flex-direction: column");
    expect(component).not.toMatch(/sb-related-card[\s\S]*<(button)/);
    for (const copy of REMOVED_COPY) {
      expect(component).not.toContain(copy);
      expect(page).not.toContain(copy);
    }
  });

  it("does not hard-code a Vimeo player URL", () => {
    expect(component).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(page).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
  });

  it("lists the builder on the Skill Builders catalog with the neckline cards", () => {
    expect(catalog).toContain(JOINING_SHOULDER_SEAMS_PATH);
    expect(catalog).toContain("Join Beautiful Shoulder Seams");
    expect(catalog).toContain(JOINING_SHOULDER_SEAMS_CATALOG_SUBTITLE);
    expect(catalog).toContain("/learn/skill-builders/round-neckline-basics");
    expect(catalog).toContain("Member Skill Builders");
  });
});
