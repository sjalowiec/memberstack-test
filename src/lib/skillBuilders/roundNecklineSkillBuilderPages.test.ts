import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, `${name}.astro`), "utf8");
}

const REQUIRED_HEADINGS = [
  "What You're Practicing",
  "Your Gauge",
  "Full Practice-Piece Diagram",
  "Before You Begin",
  "Shape the Shoulders",
  "Finish",
  "Print Worksheet",
];

const REMOVED_COPY = [
  "Common Mistakes",
  "Pause and Check",
  "Worksheet Summary",
  "Save This Practice Piece",
  "Instructions",
  "1. Knit the Practice Piece",
  "2. Shape the Left Shoulder",
  "3. Shape the Right Shoulder",
  "SHOULDER_WORKFLOW_HEADING",
  "SAVE_THIS_PRACTICE_PIECE_NOTE",
  "data-sb-prepare-heading",
  "data-sb-shoulder-chart",
];

describe("public round neckline Skill Builder pages", () => {
  const basicsLanding = readPage("round-neckline-basics", "index.astro");
  const basicsExercise = readPage("round-neckline-basics", "[exercise].astro");
  const shapedLanding = readPage("round-necklines-shaped-shoulders", "index.astro");
  const shapedExercise = readPage("round-necklines-shaped-shoulders", "[exercise].astro");
  const exerciseComponent = readComponent("RoundNecklineSkillBuilderExercise");
  const exerciseBody = readComponent("RoundNecklineSkillBuilderExerciseBody");
  const landingComponent = readComponent("RoundNecklineSkillBuilderLanding");
  const landingBody = readComponent("RoundNecklineSkillBuilderLandingBody");
  const catalog = readFileSync(join(pagesDir, "..", "skill-builders.astro"), "utf8");
  const pageScript = readFileSync(
    join(process.cwd(), "src/lib/skillBuilders/roundNecklineSkillBuilderPage.ts"),
    "utf8",
  );

  it("uses stable public routes for both builders and all four exercises", () => {
    expect(basicsLanding).toContain('builderId="round-neckline-basics"');
    expect(shapedLanding).toContain('builderId="round-necklines-shaped-shoulders"');
    expect(basicsExercise).toContain("export const prerender = true");
    expect(shapedExercise).toContain("export const prerender = true");
    expect(basicsExercise).toContain("getStaticPaths");
    expect(shapedExercise).toContain("getStaticPaths");
    expect(basicsExercise).toContain("round-neckline-basics");
    expect(shapedExercise).toContain("round-necklines-shaped-shoulders");
  });

  it("keeps Round Neckline Basics fully public", () => {
    for (const source of [basicsLanding, basicsExercise]) {
      expect(source).not.toContain("memberOnly");
      expect(source).not.toContain("MemberLockOverlay");
      expect(source).not.toContain("data-sb-member-lock");
    }
  });

  it("gates Round Necklines with Shaped Shoulders on every landing and exercise route", () => {
    expect(shapedLanding).toContain("memberOnly");
    expect(shapedExercise).toContain("memberOnly");
    expect(landingComponent).toContain("SkillBuilderMemberGate");
    expect(exerciseComponent).toContain("SkillBuilderMemberGate");
    expect(exerciseComponent).toContain("SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT");
    expect(pageScript).toContain('dataset.sbBound === "true"');
  });

  it("shows a landing with two exercises and an exercise back link", () => {
    expect(landingComponent).toContain("SkillBuilderPageHeader");
    expect(exerciseComponent).toContain("SkillBuilderPageHeader");
    expect(landingBody).toContain("Choose a practice");
    expect(landingBody).toContain("skillBuilderExercisePath");
    expect(landingBody).toContain("prerequisiteNote");
    expect(exerciseComponent).toContain("Back to practices");
    expect(exerciseComponent).toContain("exercise.subtitle ?? builder.title");
    expect(exerciseComponent).toContain('sb-practice-hero__intro">{subtitle}</p>');
    expect(exerciseComponent).not.toContain('sb-practice-hero__intro">{builder.title}</p>');
    expect(exerciseComponent).not.toContain("Shaping with Bind-Offs & Decreases");
    expect(landingComponent).not.toContain("Shaping with Bind-Offs & Decreases");
    expect(landingBody).not.toContain("Shaping with Bind-Offs & Decreases");
  });

  it("renders the required exercise sections, gauge form, and print button", () => {
    for (const heading of REQUIRED_HEADINGS) {
      expect(exerciseBody).toContain(heading);
    }
    for (const copy of REMOVED_COPY) {
      expect(exerciseBody).not.toContain(copy);
      expect(exerciseComponent).not.toContain(copy);
    }
    expect(exerciseBody).toContain("SkillBuilderGaugeInput");
    expect(exerciseBody).toContain('label="Print Worksheet"');
    expect(exerciseBody).toContain("shaping-map.css");
    expect(exerciseBody).toContain("ns-shaping-chart.css");
    expect(exerciseBody).toContain("pattern-tips.css");
    expect(exerciseBody).toContain("Left Shoulder");
    expect(exerciseBody).toContain("Right Shoulder");
    expect(exerciseBody).toContain('role="tablist"');
    expect(exerciseBody).toContain('data-sb-diagram');
    expect(exerciseBody.match(/data-sb-diagram/g)?.length).toBe(1);
    expect(exerciseBody).toMatch(
      /Full Practice-Piece Diagram[\s\S]*Before You Begin[\s\S]*SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING[\s\S]*Shape the Shoulders[\s\S]*data-sb-shoulder-checklist="right"[\s\S]*id="sb-finish-heading"/,
    );
    expect(exerciseBody).toMatch(
      /id="sb-begin-heading">Before You Begin[\s\S]*data-sb-before-begin[\s\S]*sb-video-helper[\s\S]*GatedVimeoEmbed[\s\S]*id="sb-shoulders-heading">\s*Shape the Shoulders/,
    );
    expect(exerciseBody).toContain('data-sb-shoulder-checklist="left"');
    expect(exerciseBody).toContain('data-sb-shoulder-checklist="right"');
    expect(exerciseBody).not.toContain("data-sb-shoulder-chart");
    expect(exerciseBody).toContain("Work the left shoulder after binding off the center neck stitches.");
    expect(exerciseBody).toContain(
      "Rehang the right shoulder. Reset the row counter to 000, then follow this reversed checklist.",
    );
    expect(exerciseBody).toContain("<ul class=\"sb-finish-list\">");
    expect(exerciseBody).toContain("Scrap off the remaining live shoulder stitches onto waste yarn.");
    expect(exerciseBody).toContain(
      "Keep this practice piece for the shoulder-joining and neckband-finishing practice.",
    );
    expect(exerciseBody).not.toContain(
      "Scrap off the remaining live shoulder stitches. Keep this practice piece",
    );
    expect(exerciseBody).toMatch(/id="sb-panel-right"[\s\S]*\bhidden\b/);
    expect(exerciseBody).toContain('aria-selected="true"');
    expect(exerciseBody).toContain('aria-selected="false"');
    expect(exerciseBody).toContain(".sb-shoulder-tabs__panel[hidden]");
    expect(exerciseBody).toContain("display: none !important");
    expect(exerciseBody).toContain(".sb-shoulder-print-title");
    expect(exerciseComponent).toContain("document.readyState");
    expect(pageScript).toContain("buildRoundNecklineSkillBuilderDiagramHtml");
    expect(pageScript).toContain("[data-sb-diagram]");
    expect(pageScript).not.toContain("data-sb-shoulder-chart");
    expect(pageScript).toContain("work.checklistHtml");
    expect(pageScript).not.toContain("work.chartHtml");
  });

  it("does not hard-code a video embed", () => {
    expect(exerciseBody).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(landingBody).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(exerciseBody).toContain("skillBuilderVideoSlot");
  });

  it("embeds the unlisted catalog video as a quiet helper after Before You Begin instructions", () => {
    expect(exerciseBody).toContain("SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING");
    expect(exerciseBody).toContain("SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY");
    expect(exerciseBody).toContain("GatedVimeoEmbed");
    expect(exerciseBody).toContain("video.vimeoId");
    expect(exerciseBody).toContain('privacyHash={video.privacyHash ?? ""}');
    expect(exerciseBody).toContain("data-sb-video-content-id={String(video.contentId)}");
    expect(exerciseBody).toContain('class="sb-video-helper no-print"');
    expect(exerciseBody).toContain('id="sb-video-help-heading"');
    expect(exerciseBody).toContain("sb-video-helper__embed");
    expect(exerciseBody).toContain("max-width: 30rem");
    expect(exerciseBody).not.toContain("sb-shaping-video-heading");
    expect(exerciseBody).not.toContain("Watch the Shaping Sequence");
    expect(exerciseBody).not.toContain("Watch the complete process before you begin");
    expect(exerciseBody).not.toContain("b1bc386c3c");
    expect(exerciseBody).not.toContain("1218264661");
    expect(exerciseBody).not.toMatch(/href=["']https:\/\/vimeo\.com/);
    expect(exerciseBody).not.toMatch(/player\.vimeo\.com/);
    expect(exerciseBody).toMatch(
      /data-sb-before-begin[\s\S]*<h3 id="sb-video-help-heading">[\s\S]*GatedVimeoEmbed[\s\S]*id="sb-shoulders-heading">\s*Shape the Shoulders/,
    );
    expect(exerciseBody).not.toMatch(
      /What You're Practicing[\s\S]*GatedVimeoEmbed[\s\S]*data-sb-before-begin/,
    );
    expect(landingBody).not.toContain("Watch the Shaping Sequence");
    expect(landingBody).not.toContain("Need a little help?");
    expect(landingBody).not.toContain("SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING");
    expect(landingBody).toContain('privacyHash={video.privacyHash ?? ""}');
  });

  it("lists the new public builders on the Skill Builders catalog", () => {
    expect(catalog).toContain("/learn/skill-builders/round-neckline-basics");
    expect(catalog).toContain("/learn/skill-builders/round-necklines-shaped-shoulders");
    expect(catalog).toContain("Free Skill Builder");
  });
});
