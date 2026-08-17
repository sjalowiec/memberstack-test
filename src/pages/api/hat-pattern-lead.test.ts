import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(dir, "hat-pattern-lead.ts"), "utf8");
const handlerSource = readFileSync(
  join(dir, "../../lib/patterns/hat/hatPatternLeadCapture.ts"),
  "utf8",
);
const sharedLeadSource = readFileSync(
  join(dir, "../../lib/leads/taggedLeadCapture.ts"),
  "utf8",
);
const clientSource = readFileSync(
  join(dir, "../../lib/patterns/hat/hatPatternLeadClient.ts"),
  "utf8",
);
const sharedSource = readFileSync(
  join(dir, "../../lib/patterns/hat/hatPatternLeadShared.ts"),
  "utf8",
);
const summaryPage = readFileSync(
  join(dir, "../patterns/hat/summary/index.astro"),
  "utf8",
);
const patternPage = readFileSync(join(dir, "../patterns/hat/pattern.astro"), "utf8");
const summaryScript = readFileSync(
  join(dir, "../../scripts/hat-pattern-summary-page.ts"),
  "utf8",
);
const patternScript = readFileSync(join(dir, "../../scripts/hat-pattern-page.ts"), "utf8");
const formSource = readFileSync(
  join(dir, "../../components/patterns/HatPatternLeadCapture.astro"),
  "utf8",
);
const acClientSource = readFileSync(
  join(dir, "../../lib/activecampaign/client.ts"),
  "utf8",
);

describe("hat-pattern-lead API route", () => {
  it("is a JSON POST endpoint that uses the Hat server handler", () => {
    expect(routeSource).toContain("export const prerender = false");
    expect(routeSource).toContain("export const POST");
    expect(routeSource).toContain("application/json");
    expect(routeSource).toContain("handleHatPatternLeadRequest");
    expect(routeSource).toContain("toPublicHatPatternLeadResponse");
  });

  it("does not embed ActiveCampaign credentials or call AC from the route file directly", () => {
    expect(routeSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(routeSource).not.toMatch(/Api-Token/);
    expect(routeSource).not.toMatch(/activehosted\.com/);
  });
});

describe("ActiveCampaign calls stay server-side", () => {
  it("keeps the Admin API client on the shared server handler only", () => {
    expect(handlerSource).toContain("handleTaggedLeadCaptureRequest");
    expect(handlerSource).toContain("HAT_PATTERN_LEAD_TAG");
    expect(sharedSource).toContain("lead: Hat Pattern");
    expect(sharedLeadSource).toContain("createActiveCampaignClient");
    expect(sharedLeadSource).toContain("syncContact");
    expect(sharedLeadSource).toContain("resolveTagId");
    expect(clientSource).not.toContain("createActiveCampaignClient");
    expect(clientSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(summaryScript).not.toContain("createActiveCampaignClient");
    expect(patternScript).not.toContain("createActiveCampaignClient");
    expect(formSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(formSource).not.toMatch(/Api-Token/);
    expect(acClientSource).toContain("/api/3/contact/sync");
  });

  it("does not let the browser choose an ActiveCampaign tag", () => {
    expect(routeSource).not.toMatch(/body\.tag|body\["tag"\]/);
    expect(clientSource).not.toContain("lead: Hat Pattern");
    expect(formSource).not.toContain("lead: Hat Pattern");
  });
});

describe("Hat lead capture markup and wiring", () => {
  it("mounts the guest form on summary and finished pages without membership gates", () => {
    expect(summaryPage).toContain("HatPatternLeadCapture");
    expect(patternPage).toContain("HatPatternLeadCapture");
    expect(summaryPage).not.toContain("SleevelessPatternMemberGate");
    expect(summaryPage).not.toContain("PatternBuilderAccountGate");
    expect(patternPage).not.toContain("SleevelessPatternMemberGate");
    expect(patternPage).not.toContain("PatternBuilderAccountGate");
    expect(formSource).toContain("HAT_PATTERN_LEAD_HELPER");
    expect(formSource).toContain("HAT_PATTERN_LEAD_TITLE");
    expect(formSource).toContain("HAT_PATTERN_LEAD_COPY");
    expect(formSource).toContain("HAT_PATTERN_LEAD_TIP");
    expect(formSource).toContain("HAT_PATTERN_LEAD_SUBMIT_LABEL");
    expect(formSource).toContain("/privacy");
    expect(sharedSource).toContain("Your free Hat Pattern is ready");
    expect(sharedSource).toContain(
      "Enter your email to view your custom knitting instructions instantly on-screen.",
    );
    expect(sharedSource).toContain(
      "Tip: Be sure to print your pattern so you have a copy for later.",
    );
    expect(sharedSource).toContain("Free. No account or password needed.");
    expect(sharedSource).not.toContain("Free. No membership required.");
    expect(sharedSource).not.toMatch(/bookmark|permanent link|email the pattern/i);
    expect(sharedSource).toContain("VIEW MY PATTERN");
  });

  it("intercepts View My Pattern on summary before navigating", () => {
    expect(summaryScript).toContain("continueAfterPersist");
    expect(summaryScript).toContain("writeCurrentSummaryDraft");
    expect(summaryScript).toContain("resolveHatPatternLeadContinue");
    expect(summaryScript).toContain("revealHatLeadCapture");
    expect(summaryScript).toContain("navigateAfterPrimarySuccess");
    expect(summaryScript).toContain("bindHatLeadForm");
    expect(summaryScript).not.toContain("SleevelessPatternMemberGate");
    expect(summaryScript).not.toContain("hasSystemAccess");
  });

  it("blocks finished knitting instructions until lead capture is satisfied", () => {
    expect(patternScript).toContain("resolveLeadAndRender");
    expect(patternScript).toContain("showHatPatternLeadGate");
    expect(patternScript).toContain("renderHatPatternIfAllowed");
    expect(patternScript).toContain("buildHatPatternHtml");
    const renderAllowed = patternScript.indexOf("async function renderHatPatternIfAllowed");
    const resolveLead = patternScript.indexOf("async function resolveLeadAndRender");
    expect(renderAllowed).toBeGreaterThan(-1);
    expect(resolveLead).toBeGreaterThan(-1);
    expect(patternScript).toContain("bindHatLeadForm");
    expect(patternScript).not.toContain("SleevelessPatternMemberGate");
    expect(patternScript).not.toContain("PatternBuilderAccountGate");
  });
});
