import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson email signups page", () => {
  it("defines a server-rendered Email Signups report with shell navigation", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/email-signups.astro"),
      "utf8",
    );
    const component = fs.readFileSync(
      path.resolve("src/components/watson/WatsonEmailSignupsReport.astro"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");
    const access = fs.readFileSync(
      path.resolve("src/lib/watson/watsonAccess.ts"),
      "utf8",
    );
    const sql = fs.readFileSync(
      path.resolve("scripts/sql/watson-email-signups.sql"),
      "utf8",
    );

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("WatsonEmailSignupsReport");
    expect(page).toContain("loadEmailSignupsReport");
    expect(page).toContain("emailSignupsReportLoad");
    expect(page).toContain("Email Signups");

    expect(shell).toContain('<a href="/watson/tip-of-the-week">Tip of the Week</a>');
    expect(shell).toContain('<a href="/watson/email-signups">Email Signups</a>');

    // Auth remains enforced via Watson middleware for all /watson/* pages.
    expect(access).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");

    expect(component).toContain("Last 7 days");
    expect(component).toContain("Last 30 days");
    expect(component).toContain("Daily breakdown");
    expect(component).not.toContain("email address");
    expect(component).not.toContain("skipped_unsubscribed");
    expect(page).not.toContain("ACTIVECAMPAIGN_API_KEY");
    expect(component).not.toContain("ACTIVECAMPAIGN");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watson_email_signups");
    expect(sql).toContain("'added'");
    expect(sql).toContain("'already-subscribed'");
    expect(sql).toContain("'not-added'");
    expect(sql).toContain("'failed'");
  });
});
