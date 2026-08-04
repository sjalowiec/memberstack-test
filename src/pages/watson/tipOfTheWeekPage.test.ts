import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Watson Tip of the Week page", () => {
  const page = readFileSync("src/pages/watson/tip-of-the-week.astro", "utf8");
  const script = readFileSync("src/scripts/watsonTipOfTheWeek.ts", "utf8");
  const shell = readFileSync("src/components/watson/WatsonPageShell.astro", "utf8");
  const apiIndex = readFileSync(
    "src/pages/api/watson/tip-of-the-week/index.ts",
    "utf8",
  );
  const apiId = readFileSync(
    "src/pages/api/watson/tip-of-the-week/[id].ts",
    "utf8",
  );
  const apiReactions = readFileSync(
    "src/pages/api/watson/tip-of-the-week/reactions/[tipId].ts",
    "utf8",
  );

  it("is wired into Watson navigation near What’s New", () => {
    expect(shell).toContain('href="/watson/whats-new"');
    expect(shell).toContain('href="/watson/tip-of-the-week"');
    expect(shell.indexOf("/watson/tip-of-the-week")).toBeGreaterThan(
      shell.indexOf("/watson/whats-new"),
    );
  });

  it("loads tips from Watson and exposes CRUD actions", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("listAllTipOfTheWeek");
    expect(page).toContain("data-totw-save-draft");
    expect(page).toContain("data-totw-schedule");
    expect(page).toContain("data-totw-activate");
    expect(page).toContain("data-totw-archive");
    expect(script).toContain("/api/watson/tip-of-the-week");
    expect(apiIndex).toContain("requireWatsonSessionJson");
    expect(apiId).toContain("updateTipOfTheWeek");
  });

  it("aggregates reaction totals without visitor IDs in the API response path", () => {
    expect(page).toContain("loadTipReactionTotals");
    expect(apiReactions).toContain("loadTipReactionTotals");
    expect(apiReactions).toContain("tipReactionDisplayRows");
    expect(apiReactions).not.toContain("visitorId");
  });

  it("links Preview to a Watson-gated preview query on the public page", () => {
    expect(page).toContain("/tip-of-the-week?preview=");
    expect(script).toContain("/api/watson/tip-of-the-week");
  });

  it("auto-defaults Available Through to a 7-day window with Reset control", () => {
    expect(page).toContain("data-totw-reset-seven-days");
    expect(page).toContain("Reset to 7 days");
    expect(script).toContain("onTipAvailableFromChanged");
    expect(script).toContain("resetTipAvailableThroughToSevenDays");
    expect(script).toContain("initTipDateFormState");
  });
});
