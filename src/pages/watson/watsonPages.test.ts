import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson member search pages", () => {
  it("defines server-rendered current business landing page", () => {
    const currentPage = fs.readFileSync(
      path.resolve("src/pages/watson/current/index.astro"),
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
    expect(currentPage).toContain("Current Business");
    expect(currentPage).toContain(
      "Live business information from the current Knit It Now platform.",
    );

    expect(shell).toContain('<a href="/watson/current">Current</a>');

    expect(component).toContain("CURRENT_BUSINESS_PLACEHOLDER");
    expect(component).toContain("currentBusiness");
    expect(component).not.toMatch(/\$[\d,]+/);
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
    expect(middleware).toContain("requireAdminForRequest");
    expect(middleware).toContain("watsonAccessDeniedResponse");
  });
});
