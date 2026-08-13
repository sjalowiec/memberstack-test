import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  E_WRAP_CAST_ON_CATALOG_SUBTITLE,
  E_WRAP_CAST_ON_CHECKLIST,
  E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID,
  E_WRAP_CAST_ON_PATH,
  E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID,
  E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID,
  E_WRAP_CAST_ON_WEIGHTS_HEADING,
  E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID,
} from "./eWrapCastOnSkillBuilder";
import { E_WRAP_CAST_ON_VIDEO_CONTENT_ID } from "./eWrapCastOnSkillBuilderVideos";

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

const REMOVED_COPY = [
  "What You're Practicing",
  "Practice Piece",
  "Before You Begin",
  "Pause and Check",
  "Finish",
  "Print Worksheet",
  "toolPrintTitle",
  "PrintButton",
  "data-sb-diagram",
  "SkillBuilderGaugeInput",
  "SkillBuilderDiagram",
  "sb-related-card",
  "skill-buider.png",
];

describe("E-Wrap Cast On Basics Skill Builder pages", () => {
  const page = readPage("e-wrap-cast-on-basics.astro");
  const component = readFileSync(
    join(componentsDir, "EWrapCastOnSkillBuilder.astro"),
    "utf8",
  );
  const catalog = readFileSync(join(pagesDir, "..", "skill-builders.astro"), "utf8");

  it("uses a stable public route without print chrome", () => {
    expect(page).toContain("export const prerender = true");
    expect(page).toContain("EWrapCastOnSkillBuilder");
    expect(page).toContain("getEWrapCastOnSkillBuilder");
    expect(page).not.toContain("toolPrintTitle");
    expect(E_WRAP_CAST_ON_PATH).toBe("/learn/skill-builders/e-wrap-cast-on-basics");
  });

  it("gates the Skill Builder for logged-out and non-member visitors", () => {
    expect(component).toContain("SkillBuilderMemberGate");
    expect(component).toMatch(
      /<SkillBuilderMemberGate>[\s\S]*What You'll Practice[\s\S]*GatedVimeoEmbed[\s\S]*E-Wrap Cast On Checklist[\s\S]*Using weights/,
    );
    expect(component).not.toContain('access_level="open"');
    expect(component).toContain("access_level={video.accessLevel}");
  });

  it("renders title, intro, What You'll Practice, video #206, checklist, then the weights note", () => {
    expect(component).toContain("SkillBuilderPageHeader");
    expect(component).toContain("data-sb-e-wrap-cast-on");
    expect(component).toContain("What You'll Practice");
    expect(component).toContain("builder.whatYoullPractice");
    expect(component).toContain("E-Wrap Cast On Checklist");
    expect(component).toContain("builder.checklist");
    expect(component).toContain("GatedVimeoEmbed");
    expect(component).toContain("video.vimeoId");
    expect(component).toContain("data-sb-video-content-id={String(video.contentId)}");
    expect(component).toContain("Watch");
    expect(component).toContain("access_level={video.accessLevel}");
    expect(E_WRAP_CAST_ON_VIDEO_CONTENT_ID).toBe(206);
    expect(E_WRAP_CAST_ON_CHECKLIST).toHaveLength(6);
    expect(component).toMatch(
      /What You'll Practice[\s\S]*data-sb-video-content-id[\s\S]*Watch[\s\S]*E-Wrap Cast On Checklist[\s\S]*data-sb-weights-note[\s\S]*Using weights/,
    );
    expect(component).toContain("eWrapCastOnIntroParts");
    expect(component).toContain("introParts");
    expect(component).toContain("GlossaryTooltip");
    expect(component).toContain("part.glossaryId");
    expect(component).toContain("eWrapCastOnWeightsNoteParts");
    expect(component).toContain("data-sb-weights-note");
    expect(component).toContain("Using weights");
    expect(E_WRAP_CAST_ON_WEIGHTS_HEADING).toBe("Using weights");
    expect(E_WRAP_CAST_ON_EWRAP_GLOSSARY_ID).toBe(312);
    expect(E_WRAP_CAST_ON_WORKING_POSITION_GLOSSARY_ID).toBe(207);
    expect(E_WRAP_CAST_ON_WASTE_YARN_GLOSSARY_ID).toBe(239);
    expect(E_WRAP_CAST_ON_RAVEL_CORD_GLOSSARY_ID).toBe(249);
    expect(component).not.toContain("sb-related-card");
    for (const copy of REMOVED_COPY) {
      expect(component).not.toContain(copy);
      expect(page).not.toContain(copy);
    }
  });

  it("does not present waste yarn or ravel cord as a cast-on prerequisite", () => {
    const gatedBody = component.slice(
      component.indexOf("<SkillBuilderMemberGate>"),
      component.indexOf("</SkillBuilderMemberGate>"),
    );
    const practiceAndVideo = gatedBody.slice(
      0,
      gatedBody.indexOf("E-Wrap Cast On Checklist"),
    );
    const checklistBlock = gatedBody.slice(
      gatedBody.indexOf("E-Wrap Cast On Checklist"),
      gatedBody.indexOf("data-sb-weights-note"),
    );
    expect(practiceAndVideo).not.toMatch(/waste yarn|ravel cord/i);
    expect(checklistBlock).not.toMatch(/waste yarn|ravel cord/i);
    expect(checklistBlock).not.toContain("weightsNoteParts");
    expect(gatedBody).toMatch(/E-Wrap Cast On Checklist[\s\S]*data-sb-weights-note/);
    expect(gatedBody).toContain("weightsNoteParts");
    expect(gatedBody).toContain("Using weights");
  });

  it("does not hard-code a Vimeo player URL", () => {
    expect(component).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(page).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
  });

  it("lists the builder on the Skill Builders catalog with the other member cards", () => {
    expect(catalog).toContain(E_WRAP_CAST_ON_PATH);
    expect(catalog).toContain("E-Wrap Cast On Basics");
    expect(catalog).toContain(E_WRAP_CAST_ON_CATALOG_SUBTITLE);
    expect(catalog).toContain("/learn/skill-builders/join-beautiful-shoulder-seams");
    expect(catalog).toContain("Member Skill Builders");
  });
});
