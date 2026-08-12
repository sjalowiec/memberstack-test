import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { computeMembershipSummary } from "../../lib/membership/membershipSummary";
import {
  buildCurrentBusinessSummaryCardViews,
  CURRENT_BUSINESS_PLACEHOLDER,
} from "../../lib/watson/currentBusiness";

describe("Watson member search pages", () => {
  it("defines server-rendered current business landing page with live loader", () => {
    const currentPage = fs.readFileSync(
      path.resolve("src/pages/watson/current/index.astro"),
      "utf8",
    );
    const loader = fs.readFileSync(
      path.resolve("src/lib/watson/currentBusinessLoader.ts"),
      "utf8",
    );
    const adminReport = fs.readFileSync(
      path.resolve("netlify/functions/admin-membership-report.ts"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );
    const component = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCurrentBusiness.astro"),
      "utf8",
    );

    expect(currentPage).toContain('export const prerender = false');
    expect(currentPage).toContain("WatsonPageShell");
    expect(currentPage).toContain("WatsonCurrentBusiness");
    expect(currentPage).toContain("loadCurrentBusinessMembershipSummary");
    expect(currentPage).toContain("loadError={loadError}");
    expect(currentPage).toContain("Current Business");
    expect(currentPage).toContain(
      "Live business information from the current Knit It Now platform.",
    );

    expect(loader).toContain("resolveCurrentBusinessMemberstackSecretKey");
    expect(loader).toContain("import.meta.env");
    expect(loader).toContain("MEMBERSTACK_SECRET_KEY");
    expect(loader).not.toContain("PUBLIC_MEMBERSTACK");
    expect(adminReport).toContain("process.env.MEMBERSTACK_SECRET_KEY");

    expect(shell).toContain('<a href="/watson/current">Current</a>');
    expect(shell).toContain('<a href="/watson/course-admin/111">Course 111 Admin</a>');
    expect(shell).toContain('<a href="/watson/video-replies">Video Replies</a>');
    expect(shell).toContain('href="/watson/whats-new"');
    expect(shell).toContain('href="/watson/tip-of-the-week"');
    expect(shell).toContain('<a href="/watson/email-signups">Email Signups</a>');
    expect(shell).toContain('<a href="/watson/responses">Responses</a>');
    expect(shell).toContain('<a href="/watson/contact-messages">Contact Messages</a>');

    expect(component).toContain("loadError");
    expect(component).toContain("watson__status--error");
    expect(component).toContain("watson-current__as-of");
    expect(component).toContain("CURRENT_BUSINESS_PLACEHOLDER");
    expect(component).toContain("card.isLive");
    expect(component).not.toMatch(/sk_[a-z0-9_]+/i);
    expect(currentPage).not.toMatch(/MEMBERSTACK_SECRET_KEY/);
    expect(component).not.toContain("<script");
  });

  it("renders successful current business summary cards from computed data", () => {
    const summary = computeMembershipSummary(
      [
        {
          id: "mem_1",
          createdAt: "2026-07-01T00:00:00.000Z",
          planConnections: [],
        },
      ],
      { now: new Date("2026-07-12T12:00:00.000Z") },
    );
    const cards = buildCurrentBusinessSummaryCardViews(summary);

    expect(cards.find((card) => card.id === "new-members")?.displayValue).toBe("1");
    // Recent Sales is implemented: the Shopify card is a navigation/action card
    // that links to live Shopify orders rather than showing a summary metric.
    const shopifyCard = cards.find((card) => card.id === "shopify-sales");
    expect(shopifyCard?.displayValue).toBe("Open Recent Sales");
    expect(shopifyCard?.isLive).toBe(true);
  });

  it("renders placeholder cards when the live summary is unavailable", () => {
    const cards = buildCurrentBusinessSummaryCardViews(null);

    // The Shopify sales card is a navigation/action card and stays available
    // (links to Recent Sales) even without live summary data.
    expect(cards.find((card) => card.id === "shopify-sales")?.displayValue).toBe(
      "Open Recent Sales",
    );

    // Every card that genuinely depends on live summary data falls back to the
    // placeholder when the summary is unavailable.
    const summaryDependentCards = cards.filter((card) => card.id !== "shopify-sales");
    expect(
      summaryDependentCards.every(
        (card) => card.displayValue === CURRENT_BUSINESS_PLACEHOLDER,
      ),
    ).toBe(true);
  });

  it("defines Video Replies Watson page with create form and sortable history", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/video-replies.astro"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("Create Video Reply");
    expect(page).toContain("Video Reply History");
    expect(page).toContain('data-sortable-table');
    expect(page).toContain('data-sort-default="true"');
    expect(page).toContain("Mark Sent");
    expect(page).toContain("Copy Link");
    expect(page).toContain("Copy Message");
    expect(page).toContain("Disable Link");
    expect(page).toContain("privateNotes");
    expect(page).toContain("initWatsonVideoReplies");
    expect(shell).toContain('<a href="/watson/video-replies">Video Replies</a>');
  });

  it("defines membership report routes under /watson/reports", () => {
    const reportsIndex = fs.readFileSync(
      path.resolve("src/pages/watson/reports/index.astro"),
      "utf8",
    );
    const currentMembers = fs.readFileSync(
      path.resolve("src/pages/watson/reports/current-legacy-members.astro"),
      "utf8",
    );
    const annualAccess = fs.readFileSync(
      path.resolve("src/pages/watson/reports/remaining-annual-access.astro"),
      "utf8",
    );

    expect(reportsIndex).toContain("/watson/reports/current-legacy-members");
    expect(reportsIndex).toContain("/watson/reports/remaining-annual-access");
    expect(reportsIndex).toContain("/watson/pattern-inspector");
    expect(currentMembers).toContain("loadCurrentLegacyMembersReport");
    expect(currentMembers).toContain('export const prerender = false');
    expect(annualAccess).toContain("loadRemainingAnnualAccessReport");
    expect(annualAccess).toContain('export const prerender = false');
  });

  it("defines the read-only legacy renewals preview page and nav link", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/legacy-renewals.astro"),
      "utf8",
    );
    const component = fs.readFileSync(
      path.resolve("src/components/watson/WatsonLegacyRenewalPreview.astro"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("loadLegacyRenewalReminderPreview");
    expect(page).toContain("WatsonLegacyRenewalPreview");
    // The page must never invoke live mode; it relies on the loader's forced dry run.
    expect(page).not.toContain("dryRun: false");
    expect(page).not.toContain("confirm=LIVE");

    expect(component).toContain("Renewal Reminder Preview");
    expect(component).toContain("Refresh Preview");
    expect(component).toContain("Legacy Expiration Date");
    expect(component).toContain("Days Until Expiration");

    expect(shell).toContain('<a href="/watson/legacy-renewals">Legacy Renewals</a>');
  });

  it("defines server-rendered dashboard and member detail routes", () => {
    const dashboardPage = fs.readFileSync(
      path.resolve("src/pages/watson/index.astro"),
      "utf8",
    );
    const detailPage = fs.readFileSync(
      path.resolve("src/pages/watson/members/[memberid].astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(dashboardPage).toContain('export const prerender = false');
    expect(dashboardPage).toContain("loadWatsonDashboard");
    expect(dashboardPage).toContain("WatsonDashboardSummary");
    expect(dashboardPage).toContain("WatsonDashboardRecentActivity");
    expect(dashboardPage).not.toContain("watson__search");
    expect(dashboardPage).not.toContain("searchLegacyMembers");
    expect(dashboardPage).not.toContain("watson-member-search");

    expect(detailPage).toContain('export const prerender = false');
    expect(detailPage).toContain("getLegacyMemberById");
    expect(detailPage).toContain("buildMemberOverviewFields");
    expect(detailPage).toContain("watsonMemberNotFoundHtml");
    expect(detailPage).toContain("Back to Search");
    expect(detailPage).toContain("WatsonMemberNotes");
    expect(detailPage).toContain("getMemberWatsonNoteCount");
    expect(detailPage).toContain("legacyNoteCount");
    expect(detailPage).toContain("watsonNoteCount");

    const notesComponent = fs.readFileSync(
      path.resolve("src/components/watson/WatsonMemberNotes.astro"),
      "utf8",
    );
    expect(notesComponent).toContain("Legacy Notes");
    expect(notesComponent).toContain("Watson Notes");
    expect(notesComponent).toContain("watson-member-notes__grid");

    const memberNotesApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/members/[memberid]/notes.ts"),
      "utf8",
    );
    expect(memberNotesApi).toContain("requireWatsonAdminJson");

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
    expect(middleware).not.toContain("requireAdminForRequest");
  });
});
