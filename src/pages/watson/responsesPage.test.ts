import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { SUPPORT_RESPONSE_TEMPLATES } from "../../lib/watson/supportResponses";

describe("Watson Responses page", () => {
  it("defines a static canned-response page with accordion copy interaction", () => {
    const page = fs.readFileSync(path.resolve("src/pages/watson/responses.astro"), "utf8");
    const accordionSection = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerAccordionSection.astro"),
      "utf8",
    );
    const accordionInit = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerAccordionInit.astro"),
      "utf8",
    );
    const accordionLib = fs.readFileSync(
      path.resolve("src/lib/watson/customerDetailAccordion.ts"),
      "utf8",
    );
    // Normalize CRLF/CR so body comparisons are OS-agnostic (Windows checkouts
    // store template source with \r\n while template.body uses \n).
    const supportResponses = fs
      .readFileSync(path.resolve("src/lib/watson/supportResponses.ts"), "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain('heading="Responses"');
    expect(page).toContain("SUPPORT_RESPONSE_TEMPLATES");
    expect(page).toContain("WatsonCustomerAccordionSection");
    expect(page).toContain("WatsonCustomerAccordionInit");
    expect(page).toContain("data-watson-customer-accordion-group");
    expect(page).toContain("data-response-panel");
    expect(page).toContain("Copy Response");
    expect(page).toContain("Copied");
    expect(page).toContain("readonly");
    expect(page).toContain("data-response-text");
    expect(page).toContain("data-copy-response");
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("navigator.clipboard.writeText");
    expect(page).not.toContain("data-response-card");
    expect(page).not.toContain("watson-responses__card");
    expect(page).not.toContain("watson__panel");
    expect(page).not.toContain(" open");

    expect(page).toContain("id={`response-${template.id}`}");
    expect(page).toContain("title={template.title}");
    expect(page).toContain("{template.body}");
    expect(SUPPORT_RESPONSE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const template of SUPPORT_RESPONSE_TEMPLATES) {
      expect(supportResponses).toContain(template.title);
      expect(supportResponses).toContain(template.body);
      expect(supportResponses).toContain(`id: "${template.id}"`);
    }

    expect(accordionSection).toContain("<details");
    expect(accordionSection).toContain("<summary");
    expect(accordionSection).toContain("data-watson-customer-accordion");
    expect(accordionSection).toContain("watson-customer__accordion-indicator");
    expect(accordionSection).not.toContain(" open");
    expect(accordionInit).toContain("initCustomerDetailAccordions");
    expect(accordionLib).toContain("closeOtherCustomerAccordions");
    expect(accordionLib).toContain("initCustomerDetailAccordions");

    expect(supportResponses).toContain("DAK License Delivery");
    expect(supportResponses).toContain("Login Help - Password Reset Email");
    expect(supportResponses).toContain("Login Help - Temporary Password");
    expect(supportResponses).toContain("Hello {Customer Name},");
    expect(supportResponses).toContain("DesignaKnit 9 {Version}");
    expect(supportResponses).toContain("{License Number}");
    expect(supportResponses).toContain("Hi {FirstName},");
    expect(supportResponses).toContain("{TemporaryPassword}");
    expect(supportResponses).toContain("knitcraft@knitcraft.com");
    expect(supportResponses).toContain("https://softbyte.co.uk/_dk9webinst/MiniSetup_D9_US.exe");
    expect(supportResponses).toContain(
      "https://learndesignaknit.com/courses/designaknit-quick-start/",
    );

    expect(page).not.toContain("/api/watson/responses");
    expect(page).not.toContain("getStore");
    expect(page).not.toContain("Netlify");
    expect(fs.existsSync(path.resolve("src/pages/api/watson/responses/index.ts"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/pages/api/watson/responses.ts"))).toBe(false);

    expect(shell).toContain('<a href="/watson/responses">Responses</a>');

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
  });

  it("is covered by Watson route auth like other Watson pages", () => {
    const access = fs.readFileSync(path.resolve("src/lib/watson/watsonAccess.ts"), "utf8");

    expect(access).toContain('pathname === "/watson" || pathname.startsWith("/watson/")');
  });
});
