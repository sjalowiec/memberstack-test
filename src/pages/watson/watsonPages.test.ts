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
    expect(cards.find((card) => card.id === "shopify-sales")?.displayValue).toBe(
      CURRENT_BUSINESS_PLACEHOLDER,
    );
  });

  it("renders placeholder cards when the live summary is unavailable", () => {
    const cards = buildCurrentBusinessSummaryCardViews(null);
    expect(cards.every((card) => card.displayValue === CURRENT_BUSINESS_PLACEHOLDER)).toBe(
      true,
    );
  });

  it("defines server-rendered search and member detail routes", () => {
    const searchPage = fs.readFileSync(
      path.resolve("src/pages/watson/index.astro"),
      "utf8",
    );
    const detailPage = fs.readFileSync(
      path.resolve("src/pages/watson/members/[memberid].astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(searchPage).toContain('export const prerender = false');
    expect(searchPage).toContain("searchLegacyMembers");
    expect(searchPage).toContain('data-sortable-table');
    expect(searchPage).toContain("/watson/members/${encodeURIComponent(row.memberid)}");

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
