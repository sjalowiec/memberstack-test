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

  it("exposes an ActiveCampaign Calendar external link near admin actions", () => {
    expect(page).toContain("ActiveCampaign Calendar");
    expect(page).toContain('href="https://knititnow.activehosted.com/app/campaigns"');
    expect(page).toContain('data-totw-activecampaign-calendar');
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');

    const linkBlock = page.slice(
      page.indexOf('href="https://knititnow.activehosted.com/app/campaigns"'),
      page.indexOf("ActiveCampaign Calendar") + "ActiveCampaign Calendar".length,
    );
    expect(linkBlock).toContain('target="_blank"');
    expect(linkBlock).toContain('rel="noopener noreferrer"');
    expect(linkBlock).toContain("ActiveCampaign Calendar");

    const toolbarIdx = page.indexOf('class="watson-totw__toolbar"');
    const linkIdx = page.indexOf("data-totw-activecampaign-calendar");
    const formIdx = page.indexOf("data-totw-form");
    expect(toolbarIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeGreaterThan(toolbarIdx);
    expect(linkIdx).toBeLessThan(formIdx);
  });

  it("links View Email Signups to the Watson report in the same tab near admin actions", () => {
    expect(page).toContain("View Email Signups");
    expect(page).toContain('href="/watson/email-signups"');
    expect(page).toContain("data-totw-email-signups");

    const linkStart = page.indexOf("data-totw-email-signups");
    const linkBlock = page.slice(
      page.lastIndexOf("<a", linkStart),
      page.indexOf("View Email Signups") + "View Email Signups".length,
    );
    expect(linkBlock).toContain('href="/watson/email-signups"');
    expect(linkBlock).toContain("watson-totw__btn watson-totw__btn--link");
    expect(linkBlock).not.toContain('target="_blank"');

    const toolbarIdx = page.indexOf('class="watson-totw__toolbar"');
    const emailSignupsIdx = page.indexOf("data-totw-email-signups");
    const formIdx = page.indexOf("data-totw-form");
    expect(toolbarIdx).toBeGreaterThan(-1);
    expect(emailSignupsIdx).toBeGreaterThan(toolbarIdx);
    expect(emailSignupsIdx).toBeLessThan(formIdx);
  });

  it("auto-defaults Available Through to a 7-day window with Reset control", () => {
    expect(page).toContain("data-totw-reset-seven-days");
    expect(page).toContain("Reset to 7 days");
    expect(script).toContain("onTipAvailableFromChanged");
    expect(script).toContain("resetTipAvailableThroughToSevenDays");
    expect(script).toContain("initTipDateFormState");
  });

  it("edits typed Related Help resources with video lookup and reorder controls", () => {
    expect(page).toContain("Add Related Resource");
    expect(page).toContain("data-related-links");
    expect(script).toContain("Knit It Now Video");
    expect(script).toContain("Link or Document");
    expect(script).toContain("data-related-video-id");
    expect(script).toContain("data-related-up");
    expect(script).toContain("data-related-down");
    expect(script).toContain("${API}/video/");
    expect(script).toContain('const API = "/api/watson/tip-of-the-week"');
    expect(script).not.toMatch(/drag-and-drop|draggable/i);
  });

  it("uses the billboard-style rich-text editor for Try It only", () => {
    expect(page).toContain("data-totw-try-rte");
    expect(page).toContain('data-wn-rte-cmd="bold"');
    expect(page).toContain('data-wn-rte-cmd="italic"');
    expect(page).toContain('data-wn-rte-cmd="paragraph"');
    expect(page).toContain('data-wn-rte-cmd="ul"');
    expect(page).toContain('data-wn-rte-cmd="ol"');
    expect(page).toContain('data-wn-rte-cmd="link"');
    expect(page).toContain('name="tryCopy"');
    expect(page).toMatch(/name="tryCopy"[^>]*hidden|hidden[^>]*name="tryCopy"/);
    expect(page).not.toMatch(/<textarea name="tryCopy"[^>]*rows=/);
    expect(page).toMatch(/<textarea name="sueTipCopy"/);
    expect(script).toContain("initWatsonTipTryItRichText");
    expect(script).toContain("setTryCopy");
    expect(script).toContain("syncTryCopy");
    expect(script).toContain("sanitizeBillboardHtml");
  });
});
