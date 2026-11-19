import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Watson tip feedback report page", () => {
  const page = readFileSync("src/pages/watson/tip-of-the-week/feedback.astro", "utf8");
  const reactions = readFileSync("src/components/tip-of-the-week/TipReactions.astro", "utf8");

  it("renders the stored-feedback comparison inside Watson", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("loadTipFeedbackReport");
    expect(page).toContain("renderTipFeedbackReportTable");
    expect(page).toContain("FEEDBACK_REPORT_TOTAL_EXPLANATION");
    expect(page).toContain("FEEDBACK_REPORT_VIEWS_LIMITATION");
    expect(page).toContain('href="/watson/tip-of-the-week"');
    expect(page).toContain("WatsonPageShell");
    expect(page).not.toContain("visitorId");
  });

  it("leaves the public feedback buttons unchanged", () => {
    expect(reactions).toContain("Was this tip helpful?");
    expect(reactions).toContain("TIP_FEEDBACK_CHOICES.map");
    expect(reactions).toContain("data-tip-reaction={reaction.id}");
    expect(reactions).not.toContain("will_try");
  });
});
