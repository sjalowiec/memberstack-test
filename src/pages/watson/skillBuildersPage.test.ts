import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SKILL_BUILDER_FEEDBACK_CATALOG } from "../../lib/skillBuilders/skillBuilderFeedback";

describe("Watson Skill Builder reactions page", () => {
  const page = readFileSync("src/pages/watson/skill-builders.astro", "utf8");
  const shell = readFileSync("src/components/watson/WatsonPageShell.astro", "utf8");
  const apiIndex = readFileSync(
    "src/pages/api/watson/skill-builders/reactions/index.ts",
    "utf8",
  );
  const apiId = readFileSync(
    "src/pages/api/watson/skill-builders/reactions/[skillBuilderId].ts",
    "utf8",
  );
  const totw = readFileSync("src/pages/watson/tip-of-the-week.astro", "utf8");
  const totwApi = readFileSync(
    "src/pages/api/watson/tip-of-the-week/reactions/[tipId].ts",
    "utf8",
  );

  it("is wired into Watson navigation next to Tip of the Week", () => {
    expect(shell).toContain('href="/watson/tip-of-the-week"');
    expect(shell).toContain('href="/watson/skill-builders"');
    expect(shell.indexOf("/watson/skill-builders")).toBeGreaterThan(
      shell.indexOf("/watson/tip-of-the-week"),
    );
  });

  it("shows totals for each Skill Builder response without visitor IDs", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("loadAllSkillBuilderReactionTotals");
    expect(page).toContain("How did this practice go?");
    expect(page).toContain("These are not Tip of the Week reactions");
    expect(page).not.toContain("visitorId");
    expect(page).toContain("data-sb-reaction-row={row.skillBuilderId}");
    expect(SKILL_BUILDER_FEEDBACK_CATALOG.length).toBe(5);
    expect(apiIndex).toContain('contentType: "skill-builder"');
    expect(apiIndex).not.toContain("visitorId");
    expect(apiId).toContain("loadSkillBuilderReactionTotals");
    expect(apiId).not.toContain("visitorId");
    expect(apiId).not.toContain("loadTipReactionTotals");
  });

  it("keeps Skill Builder reporting separate from Tip of the Week reactions", () => {
    expect(totwApi).toContain("loadTipReactionTotals");
    expect(totwApi).not.toContain("loadSkillBuilderReactionTotals");
    expect(apiIndex).not.toContain("loadTipReactionTotals");
    expect(totw).toContain('href="/watson/skill-builders"');
    expect(totw).toContain("data-totw-skill-builder-reactions");
    const aggregate = readFileSync(
      "src/lib/skillBuilders/skillBuilderReactionsAggregate.ts",
      "utf8",
    );
    expect(aggregate).toContain('SKILL_BUILDER_REACTION_BLOB_STORE = "skill-builder-reactions"');
    expect(aggregate).toContain('TIP_REACTION_BLOB_STORE_NAME = "tip-of-the-week-reactions"');
    expect(page).not.toContain("tip-of-the-week-reactions");
  });

  it("does not send automatic alerts or email from the report", () => {
    expect(page).not.toMatch(/mailto:|nodemailer|sendgrid|alert Sue/i);
    expect(apiIndex).not.toMatch(/email|mailto|nodemailer|sendgrid/i);
  });
});
