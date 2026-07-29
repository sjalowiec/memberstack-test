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
    expect(legacyProfilePage).toContain("WatsonCustomerSupportResponses");
    expect(legacyProfilePage).toContain("WatsonCustomerInternalInfo");
    expect(legacyProfilePage).toContain("customerFirstNameFromProfile");
    expect(legacyProfilePage).toContain("notesWriteId");
    expect(legacyProfilePage).toContain("destinationState");
    expect(legacyProfilePage).toContain("destinationPostal");
    expect(legacyProfilePage).toContain('profileType="legacy"');
    expect(legacyProfilePage).toContain("headerView");
    expect(legacyProfilePage).toContain("data-watson-customer-accordion-group");
    expect(legacyProfilePage).toContain("WatsonCustomerAccordionInit");
    expect(legacyProfilePage).toContain("WatsonCustomerProfileHeader");

    expect(memberstackProfilePage).toContain('export const prerender = false');
    expect(memberstackProfilePage).toContain("loadMemberstackCustomerProfile");
    expect(memberstackProfilePage).toContain("WatsonCustomerLegacyAmbiguity");
    expect(memberstackProfilePage).toContain("legacyLinkAmbiguous");
    expect(memberstackProfilePage).toContain("WatsonCustomerMembership");
    expect(memberstackProfilePage).toContain("WatsonCustomerSnapshot");
    expect(memberstackProfilePage).toContain("WatsonCustomerSupportResponses");
    expect(memberstackProfilePage).toContain("customerFirstNameFromProfile");
    expect(memberstackProfilePage).toContain("notesWriteId");
    expect(memberstackProfilePage).toContain("destinationState");
    expect(memberstackProfilePage).toContain('profileType="memberstack"');
    expect(memberstackProfilePage).toContain("data-watson-customer-accordion-group");
    expect(memberstackProfilePage).toContain("WatsonCustomerAccordionInit");
    expect(memberstackProfilePage).toContain("WatsonCustomerProfileHeader");

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
    expect(memberstackLoader).toContain("getMemberstackSecretKey");
    expect(memberstackLoader).not.toContain("PUBLIC_MEMBERSTACK");
    // Netlify functions do not provide import.meta.env; secret resolution must not require it.
    expect(memberstackLoader).not.toMatch(
      /resolveCustomerMemberstackSecretKey\([\s\S]*import\.meta\.env/,
    );
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

  it("renders major customer data sections as collapsed accordions", () => {
    const accordion = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerAccordionSection.astro"),
      "utf8",
    );
    const accordionLib = fs.readFileSync(
      path.resolve("src/lib/watson/customerDetailAccordion.ts"),
      "utf8",
    );
    const header = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerProfileHeader.astro"),
      "utf8",
    );
    const snapshot = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerSnapshot.astro"),
      "utf8",
    );
    const membership = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerMembership.astro"),
      "utf8",
    );
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
    const supportResponses = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerSupportResponses.astro"),
      "utf8",
    );
    const ambiguity = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerLegacyAmbiguity.astro"),
      "utf8",
    );

    expect(accordion).toContain("<details");
    expect(accordion).toContain("<summary");
    expect(accordion).toContain("data-watson-customer-accordion");
    expect(accordion).not.toContain(" open");
    expect(accordionLib).toContain("closeOtherCustomerAccordions");
    expect(accordionLib).toContain("initCustomerDetailAccordions");

    expect(header).toContain("watson-customer__header");
    expect(header).toContain("header.displayName");
    expect(header).toContain("header.email");
    expect(header).not.toContain("WatsonCustomerAccordionSection");

    // Success banner shows the saved date and only appears when paidThroughUpdated=1.
    expect(header).toContain("paidThroughUpdated ?");
    expect(header).toContain("data-paid-through-updated-banner");
    expect(header).toContain("Legacy paid-through date updated to ${header.legacyAccessThroughDate}");
    expect(header).toContain("{paidThroughUpdatedMessage}");
    // Edit input repopulates with the newly saved authoritative date after redirect.
    expect(header).toContain('value={header.legacyPaidThroughYmd ?? ""}');

    expect(ambiguity).toContain("watson-customer__legacy-ambiguity");
    expect(ambiguity).not.toContain("WatsonCustomerAccordionSection");

    expect(snapshot).toContain("WatsonCustomerAccordionSection");
    expect(snapshot).toContain('title="Customer Snapshot"');
    expect(membership).toContain("WatsonCustomerAccordionSection");
    expect(membership).toContain('title="Membership"');
    expect(purchases).toContain('title="Store Purchases"');
    expect(purchases).toContain("WatsonCustomerStoreFulfillment");
    expect(purchases).toContain("notesWriteId");
    expect(purchases).toContain('title="Course Access"');
    expect(purchases).toContain('title="PDF Purchases"');
    expect(purchases).toContain("data-watson-customer-pdf-panel");
    expect(purchases).toContain("Not available yet");
    expect(purchases).toContain("No legacy history");

    const storeFulfillment = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerStoreFulfillment.astro"),
      "utf8",
    );
    expect(storeFulfillment).toContain('title="Store Fulfillment"');
    expect(storeFulfillment).toContain('id="customer-store-fulfillment"');
    expect(storeFulfillment).toContain("getCustomerStoreFulfillments");
    expect(storeFulfillment).toContain("WatsonMemberStoreFulfillmentContent");
    expect(timeline).toContain("WatsonCustomerAccordionSection");
    expect(timeline).toContain('title="Timeline"');
    expect(timeline).toContain("events.map");
    expect(timeline).not.toContain("previewLimit");
    expect(timeline).not.toContain("Showing ");
    expect(notes).toContain('title="Customer Notes"');
    expect(notes).toContain('title="Watson Notes"');
    expect(notes).toContain("WatsonMemberWatsonNotesContent");
    expect(notes).toContain('id="customer-notes"');
    expect(supportResponses).toContain('title="Support Responses"');
    expect(supportResponses).toContain("getCustomerSupportResponseTemplates");
    expect(supportResponses).toContain("Copy Response");
    expect(supportResponses).toContain("data-temporary-password");
    expect(supportResponses).toContain("fillSupportResponse");
    expect(internalInfo).toContain('title="Internal Information"');
    expect(internalInfo).toContain("Not available yet");
  });

  it("keeps a wide single-column customer-detail accordion layout", () => {
    const styles = fs.readFileSync(path.resolve("src/styles/watson.css"), "utf8");

    expect(styles).toContain(".watson:has(.watson-customer__dashboard)");
    expect(styles).toContain("max-width: 1800px");
    expect(styles).toContain(".watson-customer__accordion");
    expect(styles).toContain(".watson-customer__accordion-indicator::before");
    expect(styles).not.toContain("grid-template-areas:");
    expect(styles).not.toContain('"membership timeline"');
    expect(styles).toMatch(
      /\.watson-customer__notes[\s\S]*?max-height:\s*none[\s\S]*?overflow-y:\s*visible/,
    );
  });
});
