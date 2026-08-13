import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
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
  const exerciseComponent = readFileSync(
    join(componentsDir, "RoundNecklineSkillBuilderExercise.astro"),
    "utf8",
  );
  const landingComponent = readFileSync(
    join(componentsDir, "RoundNecklineSkillBuilderLanding.astro"),
    "utf8",
  );
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

  it("keeps the new Skill Builders public", () => {
    for (const source of [
      basicsLanding,
      basicsExercise,
      shapedLanding,
      shapedExercise,
      exerciseComponent,
      landingComponent,
    ]) {
      expect(source).not.toContain("MemberLockOverlay");
      expect(source).not.toContain("memberAccess");
      expect(source).not.toContain("data-sb-member-lock");
    }
  });

  it("shows a landing with two exercises and an exercise back link", () => {
    expect(landingComponent).toContain("SkillBuilderPageHeader");
    expect(exerciseComponent).toContain("SkillBuilderPageHeader");
    expect(landingComponent).toContain("Choose a practice");
    expect(landingComponent).toContain("skillBuilderExercisePath");
    expect(landingComponent).toContain("prerequisiteNote");
    expect(exerciseComponent).toContain("Back to practices");
  });

  it("renders the required exercise sections, gauge form, and print button", () => {
    for (const heading of REQUIRED_HEADINGS) {
      expect(exerciseComponent).toContain(heading);
    }
    for (const copy of REMOVED_COPY) {
      expect(exerciseComponent).not.toContain(copy);
    }
    expect(exerciseComponent).toContain("SkillBuilderGaugeInput");
    expect(exerciseComponent).toContain('label="Print Worksheet"');
    expect(exerciseComponent).toContain("shaping-map.css");
    expect(exerciseComponent).toContain("ns-shaping-chart.css");
    expect(exerciseComponent).toContain("pattern-tips.css");
    expect(exerciseComponent).toContain("Left Shoulder");
    expect(exerciseComponent).toContain("Right Shoulder");
    expect(exerciseComponent).toContain('role="tablist"');
    expect(exerciseComponent).toContain('data-sb-diagram');
    expect(exerciseComponent.match(/data-sb-diagram/g)?.length).toBe(1);
    expect(exerciseComponent).toMatch(
      /Full Practice-Piece Diagram[\s\S]*Before You Begin[\s\S]*Shape the Shoulders[\s\S]*data-sb-shoulder-checklist="right"[\s\S]*id="sb-finish-heading"/,
    );
    expect(exerciseComponent).toContain('data-sb-shoulder-checklist="left"');
    expect(exerciseComponent).toContain('data-sb-shoulder-checklist="right"');
    expect(exerciseComponent).not.toContain("data-sb-shoulder-chart");
    expect(exerciseComponent).toContain("Work the left shoulder after binding off the center neck stitches.");
    expect(exerciseComponent).toContain(
      "Rehang the right shoulder. Reset the row counter to 000, then follow this reversed checklist.",
    );
    expect(exerciseComponent).toContain("<ul class=\"sb-finish-list\">");
    expect(exerciseComponent).toContain("Scrap off the remaining live shoulder stitches onto waste yarn.");
    expect(exerciseComponent).toContain(
      "Keep this practice piece for the shoulder-joining and neckband-finishing practice.",
    );
    expect(exerciseComponent).not.toContain(
      "Scrap off the remaining live shoulder stitches. Keep this practice piece",
    );
    expect(exerciseComponent).toMatch(/id="sb-panel-right"[\s\S]*\bhidden\b/);
    expect(exerciseComponent).toContain('aria-selected="true"');
    expect(exerciseComponent).toContain('aria-selected="false"');
    expect(exerciseComponent).toContain(".sb-shoulder-tabs__panel[hidden]");
    expect(exerciseComponent).toContain("display: none !important");
    expect(exerciseComponent).toContain(".sb-shoulder-print-title");
    expect(exerciseComponent).toContain("document.readyState");
    expect(pageScript).toContain("buildRoundNecklineSkillBuilderDiagramHtml");
    expect(pageScript).toContain("[data-sb-diagram]");
    expect(pageScript).not.toContain("data-sb-shoulder-chart");
    expect(pageScript).toContain("work.checklistHtml");
    expect(pageScript).not.toContain("work.chartHtml");
  });

  it("does not hard-code a video embed", () => {
    expect(exerciseComponent).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(landingComponent).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(exerciseComponent).toContain("skillBuilderVideoSlot");
  });

  it("lists the new public builders on the Skill Builders catalog", () => {
    expect(catalog).toContain("/learn/skill-builders/round-neckline-basics");
    expect(catalog).toContain("/learn/skill-builders/round-necklines-shaped-shoulders");
    expect(catalog).toContain("Free Practice");
  });
});
