import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve("src/pages/polls/sweater-panels-thanks.astro"),
  "utf8",
);

describe("sweater panels poll thank-you page", () => {
  it("is a public prerendered Layout page with the standard site chrome", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain('import Layout from "../../layouts/Layout.astro"');
    expect(pageSource).not.toContain("onboarding={true}");
    expect(pageSource).not.toContain("marketing={true}");
    expect(pageSource).not.toMatch(/<form\b/);
    expect(pageSource).not.toMatch(/memberstack|data-ms-|requireAuth|membership.?gat/i);
  });

  it("keeps the requested brief copy and home CTA", () => {
    expect(pageSource).toContain("Thanks for voting!");
    expect(pageSource).toContain(
      "Your input helps me as I explore new ways to expand our pattern builders.",
    );
    expect(pageSource).toContain(
      "I appreciate you taking a minute to share your preference.",
    );
    expect(pageSource).toContain('class="kbm-btn kbm-btn-primary"');
    expect(pageSource).toContain('href="/"');
    expect(pageSource).toContain("Explore Knit It Now");
  });

  it("does not promise outcomes or refer to a specific vote", () => {
    expect(pageSource).not.toMatch(/plus-?size/i);
    expect(pageSource).not.toMatch(/release date|coming soon|will be built|winner/i);
    expect(pageSource).not.toMatch(/you voted|your vote|your choice/i);
  });
});
