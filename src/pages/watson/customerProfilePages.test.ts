import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson customer profile pages", () => {
  it("defines server-rendered customer search and typed profile routes", () => {
    const searchPage = fs.readFileSync(
      path.resolve("src/pages/watson/customers/index.astro"),
      "utf8",
    );
    const legacyProfilePage = fs.readFileSync(
      path.resolve("src/pages/watson/customers/legacy/[memberid].astro"),
      "utf8",
    );
    const memberstackProfilePage = fs.readFileSync(
      path.resolve("src/pages/watson/customers/memberstack/[memberstackId].astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(searchPage).toContain('export const prerender = false');
    expect(searchPage).toContain("searchCustomers");
    expect(searchPage).toContain('data-sortable-table');
    expect(searchPage).toContain("/watson/customers");

    expect(legacyProfilePage).toContain('export const prerender = false');
    expect(legacyProfilePage).toContain("loadLegacyCustomerProfile");
    expect(legacyProfilePage).toContain("watsonCustomerNotFoundHtml");
    expect(legacyProfilePage).toContain("memberstackLinkStatus");
    expect(legacyProfilePage).toContain("WatsonCustomerNotes");
    expect(legacyProfilePage).toContain("WatsonCustomerTimeline");
    expect(legacyProfilePage).toContain("WatsonCustomerSnapshot");
    expect(legacyProfilePage).toContain("WatsonCustomerInternalInfo");
    expect(legacyProfilePage).toContain("notesWriteId");
    expect(legacyProfilePage).toContain("headerView");

    expect(memberstackProfilePage).toContain('export const prerender = false');
    expect(memberstackProfilePage).toContain("loadMemberstackCustomerProfile");
    expect(memberstackProfilePage).toContain("WatsonCustomerLegacyAmbiguity");
    expect(memberstackProfilePage).toContain("legacyLinkAmbiguous");
    expect(memberstackProfilePage).toContain("WatsonCustomerMembership");
    expect(memberstackProfilePage).toContain("WatsonCustomerSnapshot");

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");

    expect(shell).toContain('<a href="/watson/customers">Customers</a>');
  });

  it("keeps secrets out of rendered customer profile pages", () => {
    const legacyProfilePage = fs.readFileSync(
      path.resolve("src/pages/watson/customers/legacy/[memberid].astro"),
      "utf8",
    );
    const memberstackProfilePage = fs.readFileSync(
      path.resolve("src/pages/watson/customers/memberstack/[memberstackId].astro"),
      "utf8",
    );
    const memberstackLoader = fs.readFileSync(
      path.resolve("src/lib/watson/customerMemberstack.ts"),
      "utf8",
    );
    const notesSection = fs.readFileSync(
      path.resolve("src/lib/watson/watsonMemberWatsonNotesSection.ts"),
      "utf8",
    );

    expect(legacyProfilePage).not.toContain("MEMBERSTACK_SECRET_KEY");
    expect(memberstackProfilePage).not.toContain("MEMBERSTACK_SECRET_KEY");
    expect(legacyProfilePage).not.toMatch(/sk_[a-z0-9_]+/i);
    expect(memberstackProfilePage).not.toMatch(/sk_[a-z0-9_]+/i);
    expect(memberstackLoader).toContain("import.meta.env");
    expect(memberstackLoader).not.toContain("PUBLIC_MEMBERSTACK");
    expect(notesSection).toContain("/api/watson/members/");
    expect(notesSection).not.toContain("MEMBERSTACK_SECRET_KEY");
  });

  it("reuses Watson notes API with session protection", () => {
    const memberNotesApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/members/[memberid]/notes.ts"),
      "utf8",
    );

    expect(memberNotesApi).toContain("requireWatsonAdminJson");
    expect(memberNotesApi).not.toContain("MEMBERSTACK_SECRET_KEY");
  });

  it("renders dashboard sections with appropriate empty states", () => {
    const purchases = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerPurchases.astro"),
      "utf8",
    );
    const timeline = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerTimeline.astro"),
      "utf8",
    );
    const notes = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerNotes.astro"),
      "utf8",
    );
    const internalInfo = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerInternalInfo.astro"),
      "utf8",
    );

    expect(purchases).toContain("Not available yet");
    expect(purchases).toContain("No legacy history");
    expect(timeline).toContain("unified customer timeline is coming next");
    expect(notes).toContain("WatsonMemberWatsonNotesContent");
    expect(internalInfo).toContain("Not available yet");
  });
});
