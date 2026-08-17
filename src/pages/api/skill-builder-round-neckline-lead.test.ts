import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(dir, "skill-builder-round-neckline-lead.ts"), "utf8");
const handlerSource = readFileSync(
  join(dir, "../../lib/skillBuilders/roundNecklineSkillBuilderLeadCapture.ts"),
  "utf8",
);
const sharedLeadSource = readFileSync(
  join(dir, "../../lib/leads/taggedLeadCapture.ts"),
  "utf8",
);
const clientSource = readFileSync(
  join(dir, "../../lib/skillBuilders/roundNecklineSkillBuilderLeadClient.ts"),
  "utf8",
);
const pageSource = readFileSync(
  join(dir, "../../lib/skillBuilders/roundNecklineSkillBuilderPage.ts"),
  "utf8",
);
const sharedSource = readFileSync(
  join(dir, "../../lib/skillBuilders/roundNecklineSkillBuilderLeadShared.ts"),
  "utf8",
);
const exerciseBody = readFileSync(
  join(dir, "../../components/skill-builders/RoundNecklineSkillBuilderExerciseBody.astro"),
  "utf8",
);
const acClientSource = readFileSync(
  join(dir, "../../lib/activecampaign/client.ts"),
  "utf8",
);

describe("skill-builder-round-neckline-lead API route", () => {
  it("is a JSON POST endpoint that uses the shared server handler", () => {
    expect(routeSource).toContain("export const prerender = false");
    expect(routeSource).toContain("export const POST");
    expect(routeSource).toContain("application/json");
    expect(routeSource).toContain("handleRoundNecklineSkillBuilderLeadRequest");
    expect(routeSource).toContain("toPublicRoundNecklineLeadResponse");
  });

  it("does not embed ActiveCampaign credentials or call AC from the route file directly", () => {
    expect(routeSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(routeSource).not.toMatch(/Api-Token/);
    expect(routeSource).not.toMatch(/activehosted\.com/);
  });
});

describe("ActiveCampaign calls stay server-side", () => {
  it("keeps the Admin API client on the server handler only", () => {
    expect(handlerSource).toContain("handleTaggedLeadCaptureRequest");
    expect(handlerSource).toContain("ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG");
    expect(sharedLeadSource).toContain("createActiveCampaignClient");
    expect(sharedLeadSource).toContain("getActiveCampaignConfig");
    expect(sharedLeadSource).toContain("resolveTagId");
    expect(sharedSource).toContain('lead: Skill Builder - Round Neckline');
    expect(clientSource).not.toContain("createActiveCampaignClient");
    expect(clientSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(clientSource).not.toMatch(/Api-Token/);
    expect(clientSource).not.toMatch(/activehosted\.com/);
    expect(pageSource).not.toContain("createActiveCampaignClient");
    expect(pageSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(pageSource).not.toMatch(/Api-Token/);
    expect(sharedSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(sharedSource).not.toMatch(/activehosted\.com/);
    expect(exerciseBody).not.toMatch(/ACTIVECAMPAIGN/);
    expect(exerciseBody).not.toMatch(/Api-Token/);
    expect(exerciseBody).not.toMatch(/activehosted\.com/);
  });

  it("upserts contacts by email instead of creating a new contact per submission", () => {
    expect(handlerSource).toContain("handleTaggedLeadCaptureRequest");
    expect(sharedLeadSource).toContain("syncContact");
    expect(acClientSource).toContain("/api/3/contact/sync");
  });
});
