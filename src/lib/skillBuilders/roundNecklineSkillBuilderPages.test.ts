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
  "Your Gauge",
  "Get Started",
  "Your Practice Piece",
  "Shape the Shoulders",
  "Finish",
  "Print Worksheet",
];

const REMOVED_COPY = [
  "Common Mistakes",
  "Pause and Check",
  "Worksheet Summary",
  "Save This Practice Piece",
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

  it("gates Round Neckline with Shaped Shoulders on every landing and exercise route", () => {
    expect(shapedLanding).toContain("memberOnly");
    expect(shapedExercise).toContain("memberOnly");
    expect(landingComponent).toContain("SkillBuilderMemberGate");
    expect(landingComponent).toContain("SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT");
    expect(exerciseComponent).toContain("RoundNecklineSkillBuilderLanding");
    expect(pageScript).toContain('dataset.sbBound === "true"');
  });

  it("opens a combined workspace with in-page practice selection and shared gauge", () => {
    expect(landingComponent).toContain("SkillBuilderPageHeader");
    expect(landingComponent).toContain('href="/learn/skill-builders">Skill Builders</a>');
    expect(landingComponent).toContain("data-sb-round-neckline-exercise");
    expect(landingComponent).not.toContain("Back to practices");
    expect(landingBody).toContain("Choose Your Practice");
    expect(landingBody).toContain("Start here");
    expect(landingBody).toContain("sb-practice-choice__heading");
    expect(landingBody).toContain('font-family: "Kalam", cursive');
    expect(landingBody).toContain("color: #A94F3D");
    expect(landingBody).toContain("font-size: 1.5rem");
    expect(landingBody).not.toContain("sb-start-here__arrow");
    expect(landingBody).not.toContain("↓");
    expect(landingBody).toContain("ROUND_NECKLINE_PRACTICE_CHOICES");
    expect(landingBody).toContain("{choice.title}");
    expect(landingBody).toContain("{choice.summary}");
    expect(landingBody).toContain("{choice.image}");
    expect(landingBody).toContain("sb-practice-choice__media");
    expect(landingBody).toContain("object-fit: contain");
    expect(landingBody).toContain("aspect-ratio: 4 / 3");
    expect(landingBody).toContain("flex-direction: row");
    expect(landingBody).toContain("flex: 0 0 38%");
    expect(landingBody).toContain("data-sb-practice");
    expect(landingBody).toContain("RoundNecklineSkillBuilderExerciseBody");
    expect(landingBody).toContain("prerequisiteNote");
    expect(landingBody).not.toContain("skillBuilderExercisePath");
    expect(landingBody).not.toContain("Choose a practice");
    expect(landingBody).not.toContain("What You're Practicing");
    expect(exerciseBody).not.toContain("What You're Practicing");
    expect(exerciseBody).not.toContain("data-sb-exercise-description");
    expect(exerciseBody).toContain("Your Gauge");
    expect(exerciseBody).toContain("GET KNITTING");
    expect(exerciseBody).toContain("data-sb-create-practice");
    expect(exerciseBody).toMatch(/data-sb-create-practice[\s\S]*\bhidden\b/);
    expect(exerciseBody).toMatch(/id="sb-practice-results"[\s\S]*data-sb-results hidden/);
    expect(landingBody).toContain("data-sb-setup");
    expect(landingBody).toContain("data-sb-setup-summary");
    expect(landingBody).toContain("Change practice or gauge");
    expect(exerciseBody).toContain(
      "Enter your gauge to create <strong>custom practice instructions</strong> for <strong>YOUR machine and yarn.</strong>",
    );
    expect(exerciseBody).toMatch(
      /id="sb-gauge-heading"[\s\S]*Enter your gauge to create <strong>custom practice instructions<\/strong> for <strong>YOUR machine and yarn\.<\/strong>[\s\S]*SkillBuilderGaugeInput/,
    );
    expect(landingBody).toMatch(
      /Choose Your Practice[\s\S]*Start here[\s\S]*sb-practice-choice__options[\s\S]*RoundNecklineSkillBuilderExerciseBody/,
    );
    expect(exerciseBody).toContain("sb-${builderId}");
    expect(exerciseComponent).toContain("initialExerciseId={exerciseId}");
    expect(exerciseComponent).not.toContain("Back to practices");
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
    expect(exerciseBody).not.toMatch(/>\s*Instructions\s*</);
    expect(exerciseBody).toContain("SkillBuilderGaugeInput");
    expect(exerciseBody).toContain("sb-practice-panel__note");
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
      /Get Started[\s\S]*Your Practice Piece[\s\S]*data-sb-diagram[\s\S]*skillBuilderVideoHelperCopy[\s\S]*Shape the Shoulders[\s\S]*data-sb-shoulder-checklist="right"[\s\S]*id="sb-finish-heading"/,
    );
    expect(exerciseBody).toMatch(
      /id="sb-get-started-heading">Get Started[\s\S]*data-sb-get-started[\s\S]*id="sb-diagram-heading">Your Practice Piece[\s\S]*data-sb-diagram[\s\S]*sb-video-helper[\s\S]*GatedVimeoEmbed[\s\S]*id="sb-shoulders-heading">\s*Shape the Shoulders/,
    );
    expect(exerciseBody).not.toContain("Before You Begin");
    expect(exerciseBody).not.toContain("Full Practice-Piece Diagram");
    expect(exerciseBody).not.toContain("data-sb-before-begin");
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
    expect(landingComponent).toContain("document.readyState");
    expect(pageScript).toContain("buildRoundNecklineGetStartedHtml");
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

  it("embeds the unlisted catalog video as a quiet helper after Get Started and the practice-piece diagram", () => {
    expect(exerciseBody).toContain("skillBuilderVideoHelperCopy");
    expect(exerciseBody).toContain("helper.heading");
    expect(exerciseBody).toContain("GatedVimeoEmbed");
    expect(exerciseBody).toContain("video.vimeoId");
    expect(exerciseBody).toContain('privacyHash={video.privacyHash ?? ""}');
    expect(exerciseBody).toContain("data-sb-video-content-id={String(video.contentId)}");
    expect(exerciseBody).toContain('class="sb-video-helper no-print"');
    expect(exerciseBody).toContain("sb-video-help-heading");
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
      /data-sb-diagram[\s\S]*sb-video-help-heading[\s\S]*GatedVimeoEmbed[\s\S]*id="sb-shoulders-heading">\s*Shape the Shoulders/,
    );
    expect(exerciseBody).not.toMatch(
      /What You're Practicing[\s\S]*GatedVimeoEmbed[\s\S]*data-sb-get-started/,
    );
    expect(exerciseBody).not.toContain("Before You Begin");
    expect(landingBody).not.toContain("Watch the Shaping Sequence");
    expect(landingBody).not.toContain("Need a little help?");
    expect(landingBody).not.toContain("Need a refresher?");
    expect(landingBody).not.toContain("The shaping process is the same as the shallow neckline exercise.");
    expect(landingBody).not.toContain("SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING");
    expect(landingBody).not.toContain("skillBuilderVideoHelperCopy");
    expect(exerciseBody).toContain('privacyHash={video.privacyHash ?? ""}');
    expect(landingBody).toContain("RoundNecklineSkillBuilderExerciseBody");
  });

  it("lists the new public builders on the Skill Builders catalog", () => {
    expect(catalog).toContain("/learn/skill-builders/round-neckline-basics");
    expect(catalog).toContain("/learn/skill-builders/round-necklines-shaped-shoulders");
    expect(catalog).toContain("Try a Skill Builder Free");
  });

  it("maps legacy shallow/deep exercise routes onto the same workspace", () => {
    expect(basicsExercise).toContain("RoundNecklineSkillBuilderExercise");
    expect(shapedExercise).toContain("RoundNecklineSkillBuilderExercise");
    expect(exerciseComponent).toContain("RoundNecklineSkillBuilderLanding");
    expect(exerciseComponent).toContain("initialExerciseId={exerciseId}");
    expect(pageScript).toContain("parseRoundNecklinePracticeId");
    expect(pageScript).toContain("roundNecklineWorkspaceHref");
    expect(pageScript).toContain("syncRoundNecklinePracticeSelection");
    expect(pageScript).toContain("history.replaceState");
    expect(pageScript).toContain("canCreateRoundNecklinePractice");
    expect(pageScript).toContain("applyRoundNecklineWorkspaceMode");
    expect(pageScript).toContain("resolveRoundNecklinePracticeCreation");
    expect(pageScript).not.toContain("calculateFromInputs");
    expect(pageScript).not.toMatch(/stitchInput\.value\s*=/);
    expect(pageScript).not.toMatch(/rowInput\.value\s*=/);
    expect(pageScript).toContain("currentExerciseId()");
  });

  it("asks for email only after setup, before personalized practice, on the free builder", () => {
    expect(landingBody).toContain("Choose Your Practice");
    expect(landingBody).toContain("{builder.purpose}");
    expect(exerciseBody).toContain("GET KNITTING");
    expect(exerciseBody).toContain("Ready to practice?");
    expect(exerciseBody).toContain("Create My Practice Instructions");
    expect(exerciseBody).toContain("Free. No membership required.");
    expect(exerciseBody).toContain("By signing up, you agree to receive emails from Knit It Now.");
    expect(exerciseBody).toContain('href="/privacy"');
    expect(exerciseBody).toContain("data-sb-lead-capture");
    expect(exerciseBody).toContain("data-sb-lead-form");
    expect(exerciseBody).toContain("data-sb-lead-email");
    expect(exerciseBody).toContain('name="bot-field"');
    expect(exerciseBody).toMatch(/data-sb-lead-capture[\s\S]*\bhidden\b/);
    expect(exerciseBody).toMatch(/id="sb-practice-results"[\s\S]*data-sb-results hidden/);
    expect(exerciseBody).toContain("!memberOnly");
    expect(exerciseBody).not.toContain("Create an account");
    expect(exerciseBody).not.toContain("data-ms-modal");
    expect(pageScript).toContain("decideRoundNecklineLeadCapture");
    expect(pageScript).toContain("submitRoundNecklineLeadRequest");
    expect(pageScript).toContain("isRoundNecklineLeadRecognized");
    expect(pageScript).toContain("readKnownRoundNecklineLeadMember");
    expect(pageScript).toContain('applyRoundNecklineWorkspaceMode(page, "lead")');
    expect(pageScript).not.toContain("createActiveCampaignClient");
    expect(pageScript).not.toContain("roundNecklineSkillBuilderLeadCapture");
    expect(pageScript).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(pageScript).not.toMatch(/Api-Token/);
  });

  it("does not add email capture to the member-only shaped-shoulders builder", () => {
    expect(shapedLanding).toContain("memberOnly");
    expect(shapedExercise).toContain("memberOnly");
    expect(landingComponent).toContain("SkillBuilderMemberGate");
    expect(landingComponent).toContain("memberOnly ? (");
  });

  it("uses the same in-page practice model for straight and shaped shoulder builders", () => {
    expect(basicsLanding).toContain("RoundNecklineSkillBuilderLanding");
    expect(shapedLanding).toContain("RoundNecklineSkillBuilderLanding");
    expect(landingBody).toContain("ROUND_NECKLINE_PRACTICE_CHOICES");
    expect(landingBody).toContain("data-sb-practice-description");
    expect(exerciseBody).toContain("data-sb-video-exercise");
    expect(exerciseBody).toContain("data-sb-get-started");
  });
});
