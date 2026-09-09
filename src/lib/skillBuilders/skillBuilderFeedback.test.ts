import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SKILL_BUILDER_FEEDBACK_CATALOG,
  SKILL_BUILDER_FEEDBACK_CONTACT_HREF,
  SKILL_BUILDER_FEEDBACK_CONTACT_LABEL,
  SKILL_BUILDER_FEEDBACK_HEADING,
  SKILL_BUILDER_FEEDBACK_HELP_COPY,
  SKILL_BUILDER_REACTIONS,
  getSkillBuilderFeedbackConfig,
  isSkillBuilderFeedbackId,
  isSkillBuilderReactionId,
} from "./skillBuilderFeedback";
import { TIP_REACTIONS, TIP_REACTION_ENDPOINT } from "../tipOfTheWeekReactions";
import { SKILL_BUILDER_REACTION_ENDPOINT } from "./skillBuilderReactions";
import {
  SKILL_BUILDER_REACTION_BLOB_STORE,
  TIP_REACTION_BLOB_STORE_NAME,
} from "./skillBuilderReactionsAggregate";
import { TIP_REACTION_BLOB_STORE } from "../tipOfTheWeek/reactionsAggregate";

const componentsDir = join(process.cwd(), "src/components/skill-builders");
const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, `${name}.astro`), "utf8");
}

describe("Skill Builder feedback catalog", () => {
  it("uses stable reaction IDs that match the requested Skill Builder set", () => {
    const ids = SKILL_BUILDER_FEEDBACK_CATALOG.map((item) => item.id);
    expect(ids).toEqual([
      "skill-builder-round-neckline-straight-shoulders",
      "skill-builder-round-neckline-shaped-shoulders",
      "skill-builder-shoulder-seams",
      "skill-builder-e-wrap-cast-on",
      "skill-builder-short-rows",
    ]);
    expect(getSkillBuilderFeedbackConfig("round-neckline-basics")?.path).toBe(
      "/learn/skill-builders/round-neckline-basics",
    );
    expect(getSkillBuilderFeedbackConfig("round-necklines-shaped-shoulders")?.path).toBe(
      "/learn/skill-builders/round-necklines-shaped-shoulders",
    );
    expect(getSkillBuilderFeedbackConfig("join-beautiful-shoulder-seams")?.path).toBe(
      "/learn/skill-builders/join-beautiful-shoulder-seams",
    );
    expect(getSkillBuilderFeedbackConfig("e-wrap-cast-on-basics")?.path).toBe(
      "/learn/skill-builders/e-wrap-cast-on-basics",
    );
    expect(getSkillBuilderFeedbackConfig("short-rows")?.path).toBe("/learn/skill-builders/short-rows");
    expect(isSkillBuilderFeedbackId("skill-builder-short-rows")).toBe(true);
    expect(isSkillBuilderFeedbackId("taming-the-curl-2026-08")).toBe(false);
  });

  it("keeps Skill Builder reaction options distinct from Tip of the Week except the shared will_try id", () => {
    expect(SKILL_BUILDER_REACTIONS.map((r) => r.id)).toEqual(["did_it", "will_try", "need_help"]);
    expect(TIP_REACTIONS.map((r) => r.id)).toEqual(["helped", "will_try", "more_like_this"]);
    expect(isSkillBuilderReactionId("did_it")).toBe(true);
    expect(isSkillBuilderReactionId("need_help")).toBe(true);
    expect(isSkillBuilderReactionId("helped")).toBe(false);
    expect(isSkillBuilderReactionId("more_like_this")).toBe(false);
    expect(SKILL_BUILDER_FEEDBACK_HEADING).toBe("How did this practice go?");
  });

  it("uses the existing contact page without a subject parameter or new messaging system", () => {
    expect(SKILL_BUILDER_FEEDBACK_CONTACT_HREF).toBe("/contact");
    expect(SKILL_BUILDER_FEEDBACK_CONTACT_LABEL).toBe("Ask Sue a Question");
    expect(SKILL_BUILDER_FEEDBACK_HELP_COPY).toContain("What was confusing?");
    const contactPage = readFileSync(join(process.cwd(), "src/pages/contact/index.astro"), "utf8");
    expect(contactPage).not.toContain("searchParams");
    expect(contactPage).not.toContain("Astro.url");
    expect(SKILL_BUILDER_FEEDBACK_CONTACT_HREF).not.toContain("?");
    expect(SKILL_BUILDER_FEEDBACK_CONTACT_HREF).not.toContain("subject=");
  });

  it("stores Skill Builder reactions separately from Tip of the Week", () => {
    expect(SKILL_BUILDER_REACTION_BLOB_STORE).toBe("skill-builder-reactions");
    expect(TIP_REACTION_BLOB_STORE_NAME).toBe("tip-of-the-week-reactions");
    expect(TIP_REACTION_BLOB_STORE).toBe("tip-of-the-week-reactions");
    expect(SKILL_BUILDER_REACTION_BLOB_STORE).not.toBe(TIP_REACTION_BLOB_STORE);
    expect(SKILL_BUILDER_REACTION_ENDPOINT).toBe("/.netlify/functions/log-skill-builder-reaction");
    expect(TIP_REACTION_ENDPOINT).toBe("/.netlify/functions/log-tip-reaction");
    expect(SKILL_BUILDER_REACTION_ENDPOINT).not.toBe(TIP_REACTION_ENDPOINT);
  });
});

describe("Skill Builder feedback shared rendering", () => {
  const feedback = readComponent("SkillBuilderFeedback");
  const gate = readComponent("SkillBuilderMemberGate");
  const shortRows = readComponent("ShortRowsSkillBuilder");
  const eWrap = readComponent("EWrapCastOnSkillBuilder");
  const joining = readComponent("JoiningShoulderSeamsSkillBuilder");
  const exerciseBody = readComponent("RoundNecklineSkillBuilderExerciseBody");
  const landing = readComponent("RoundNecklineSkillBuilderLanding");
  const logFn = readFileSync(
    join(process.cwd(), "netlify/functions/log-skill-builder-reaction.ts"),
    "utf8",
  );
  const client = readFileSync(
    join(process.cwd(), "src/lib/skillBuilders/skillBuilderReactions.ts"),
    "utf8",
  );

  it("keeps member-only feedback inside the member gate template, not the lock overlay", () => {
    const templateStart = gate.indexOf("<template data-sb-member-body-template>");
    const lockMarkup = gate.slice(gate.indexOf("<div class=\"sb-member-lock\""), templateStart);
    expect(lockMarkup).toContain("MemberLockOverlay");
    expect(lockMarkup).not.toContain("<SkillBuilderFeedback");
    expect(gate.slice(templateStart)).toContain("<SkillBuilderFeedback");
    expect(getSkillBuilderFeedbackConfig("round-neckline-basics")?.memberOnly).toBe(false);
    expect(getSkillBuilderFeedbackConfig("round-necklines-shaped-shoulders")?.memberOnly).toBe(true);
    expect(getSkillBuilderFeedbackConfig("join-beautiful-shoulder-seams")?.includeBackLink).toBe(
      false,
    );
    expect(gate).toContain("getSkillBuilderFeedbackConfig");
    expect(shortRows).toContain("<SkillBuilderMemberGate builderId={builder.id}>");
    expect(eWrap).toContain("<SkillBuilderMemberGate builderId={builder.id}>");
    expect(joining).toContain("<SkillBuilderMemberGate builderId={builder.id}>");
  });

  it("places round-neckline feedback inside the generated exercise, not the setup screen", () => {
    expect(exerciseBody).toContain("SkillBuilderFeedback");
    expect(exerciseBody).toContain("getSkillBuilderFeedbackConfig");
    expect(exerciseBody).toMatch(
      /id="sb-practice-results"[\s\S]*data-sb-results hidden[\s\S]*SkillBuilderFeedback/,
    );
    expect(landing).not.toContain("builderId={builder.id}");
    expect(landing).toContain("<SkillBuilderMemberGate>");
    expect(landing).not.toContain("SkillBuilderFeedback");
  });

  it("uses real buttons, labels, visible focus, and a live status region", () => {
    expect(feedback).toContain('type="button"');
    expect(feedback).toContain("sb-feedback__label");
    expect(feedback).toContain(":focus-visible");
    expect(feedback).toContain('aria-live="polite"');
    expect(feedback).toContain("data-sb-feedback-status");
    expect(feedback).toContain('aria-hidden="true"');
    expect(feedback).toContain("{reaction.label}");
    expect(feedback).toContain("SKILL_BUILDER_FEEDBACK_HEADING");
    expect(feedback).toContain("href={SKILL_BUILDER_FEEDBACK_CONTACT_HREF}");
    expect(feedback).toContain("data-sb-feedback-help");
    expect(client).toContain('reactionId === "need_help"');
    expect(client).toContain("SKILL_BUILDER_FEEDBACK_SAVE_ERROR");
  });

  it("does not send Sue an automatic alert or email", () => {
    expect(logFn).not.toContain("nodemailer");
    expect(logFn).not.toContain("mailto:");
    expect(logFn).not.toContain("/.netlify/functions/contact");
    expect(logFn).not.toContain("sendgrid");
    expect(client).not.toContain("nodemailer");
    expect(client).not.toContain("mailto:");
    expect(client).not.toContain("/.netlify/functions/contact");
    expect(feedback).not.toContain("mailto:");
    expect(feedback).toContain("href={SKILL_BUILDER_FEEDBACK_CONTACT_HREF}");
  });

  it("removes the unsaved Short Rows preference radios", () => {
    expect(shortRows).not.toContain("data-sb-completion");
    expect(shortRows).not.toContain("Which method felt more comfortable?");
    expect(shortRows).not.toContain("sb-short-rows-comfort");
    expect(shortRows).not.toContain('type="radio"');
    expect(shortRows).not.toContain("completionPrompt");
    expect(shortRows).not.toContain("completionOptions");
    expect(shortRows).not.toContain("Manual wrapping");
    expect(readFileSync(join(pagesDir, "short-rows.astro"), "utf8")).not.toContain(
      "Which method felt more comfortable?",
    );
  });

  it("keeps educational Finish copy on round neckline and does not duplicate this feedback purpose there", () => {
    expect(exerciseBody).toContain("Finish");
    expect(exerciseBody).toContain("Scrap off the remaining live shoulder stitches onto waste yarn.");
    expect(exerciseBody).not.toContain("Which method felt more comfortable?");
  });
});
