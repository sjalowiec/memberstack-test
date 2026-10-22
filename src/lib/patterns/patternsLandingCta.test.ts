import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
  applyPatternsAudienceMessaging,
  applyPatternsSalesPresentation,
  applyPatternsCatalogPresentation,
  PATTERN_CATALOG_MEMBERSHIP_BODY,
  PATTERN_CATALOG_MORE_HEADING,
  PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY,
  PATTERNS_LANDING_BECOME_MEMBER_LABEL,
  PATTERNS_LANDING_JOIN_OR_RENEW_LABEL,
  PATTERNS_LANDING_LOGIN_LABEL,
  PATTERNS_LANDING_MEMBERSHIP_BODY,
  PATTERNS_LANDING_MEMBERSHIP_HEADING,
  resolvePatternsCatalogAudience,
  resolvePatternsLandingCtaMode,
} from "./patternsLandingCta";

describe("patterns landing CTA", () => {
  it("shows prospect CTAs for anonymous visitors", () => {
    expect(resolvePatternsLandingCtaMode(null)).toBe("prospect");
    expect(resolvePatternsLandingCtaMode({ data: null })).toBe("prospect");
  });

  it("shows prospect CTAs for logged-in users without active membership", () => {
    expect(
      resolvePatternsLandingCtaMode({
        data: {
          id: "ms_nosub",
          planConnections: [],
        },
      }),
    ).toBe("prospect");

    expect(
      resolvePatternsLandingCtaMode({
        data: {
          id: "ms_canceled",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "CANCELED",
              active: false,
            },
          ],
        },
      }),
    ).toBe("prospect");
  });

  it("separates logged-out, signed-in without access, and active members", () => {
    expect(resolvePatternsCatalogAudience(null)).toBe("loggedOut");
    expect(resolvePatternsCatalogAudience({ data: null })).toBe("loggedOut");

    expect(
      resolvePatternsCatalogAudience({
        data: { id: "ms_nosub", planConnections: [] },
      }),
    ).toBe("loggedInNoAccess");

    expect(
      resolvePatternsCatalogAudience({
        data: {
          id: "ms_canceled",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "CANCELED",
              active: false,
            },
          ],
        },
      }),
    ).toBe("loggedInNoAccess");

    expect(
      resolvePatternsCatalogAudience(
        { data: { id: "mem_legacy", planConnections: [] } },
        { legacyPaidThroughYmd: "2026-12-01", todayYmd: "2026-10-14" },
      ),
    ).toBe("member");

    expect(
      resolvePatternsCatalogAudience(
        { data: { id: "mem_legacy", planConnections: [] } },
        { legacyPaidThroughYmd: "2026-01-01", todayYmd: "2026-10-14" },
      ),
    ).toBe("loggedInNoAccess");

    expect(
      resolvePatternsCatalogAudience({
        data: {
          id: "ms_member",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "ACTIVE",
              active: true,
            },
          ],
        },
      }),
    ).toBe("member");

    expect(
      resolvePatternsCatalogAudience({
        data: {
          id: "ms_trial",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "TRIALING",
              active: true,
            },
          ],
        },
      }),
    ).toBe("member");
  });

  it("shows Create a Pattern for active members only (not lifetime-only owners)", () => {
    expect(
      resolvePatternsLandingCtaMode({
        data: {
          id: "ms_member",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "ACTIVE",
              active: true,
            },
          ],
        },
      }),
    ).toBe("member");

    expect(
      resolvePatternsLandingCtaMode({
        data: {
          id: "ms_lifetime",
          planConnections: [
            {
              planId: PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId,
              status: "ACTIVE",
              active: true,
            },
          ],
        },
      }),
    ).toBe("prospect");
  });

  it("contains no free-account promise in public CTA copy", () => {
    const copy = [
      PATTERNS_LANDING_MEMBERSHIP_HEADING,
      PATTERNS_LANDING_MEMBERSHIP_BODY,
      PATTERNS_LANDING_BECOME_MEMBER_LABEL,
      PATTERNS_LANDING_LOGIN_LABEL,
    ].join(" ");
    expect(copy).not.toMatch(/free account/i);
    expect(copy).not.toMatch(/sign up free/i);
    expect(copy).not.toMatch(/create an account/i);
    expect(copy).toMatch(/active Knit it Now membership/i);
  });

  it("catalog membership copy does not imply every pattern requires membership", () => {
    expect(PATTERN_CATALOG_MORE_HEADING).toBe("Choose a Project");
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toBe(
      "The Hat builder is free to try. The other Pattern Builders are included with an active Knit It Now membership.",
    );
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).not.toMatch(/Dynamic Patterns are included/i);
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).not.toMatch(/Explore the available patterns below/i);
    expect(PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY).toMatch(/Join or renew/);
    expect(PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY).toMatch(/My Patterns/);
    expect(PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY).toMatch(/Hat builder is free/);
    expect(PATTERNS_LANDING_JOIN_OR_RENEW_LABEL).toBe("Join or renew");
    expect(PATTERNS_LANDING_JOIN_OR_RENEW_LABEL).not.toMatch(/log in/i);
  });

  it("shows the featured guest catalog until paid membership is confirmed", () => {
    function catalogNode(kind: "guest" | "member", hidden: boolean) {
      const attrs = new Set(hidden ? ["hidden"] : []);
      return {
        dataset: { patternsCatalog: kind },
        toggleAttribute(name: string, force?: boolean) {
          if (name !== "hidden") return;
          if (force) attrs.add("hidden");
          else attrs.delete("hidden");
        },
        isHidden() {
          return attrs.has("hidden");
        },
      };
    }

    const guest = catalogNode("guest", false);
    const member = catalogNode("member", true);
    const root = {
      querySelectorAll: () => [guest, member],
    } as unknown as ParentNode;

    applyPatternsCatalogPresentation("prospect", root);
    expect(guest.isHidden()).toBe(false);
    expect(member.isHidden()).toBe(true);

    applyPatternsCatalogPresentation("member", root);
    expect(guest.isHidden()).toBe(true);
    expect(member.isHidden()).toBe(false);

    applyPatternsCatalogPresentation("prospect", root);
    expect(guest.isHidden()).toBe(false);
    expect(member.isHidden()).toBe(true);
  });

  it("shows join-or-renew copy only for a signed-in visitor without membership", () => {
    function audienceNode(kind: "loggedOut" | "loggedInNoAccess", hidden: boolean) {
      const attrs = new Set(hidden ? ["hidden"] : []);
      return {
        dataset: { patternsAudience: kind },
        toggleAttribute(name: string, force?: boolean) {
          if (name !== "hidden") return;
          if (force) attrs.add("hidden");
          else attrs.delete("hidden");
        },
        isHidden() {
          return attrs.has("hidden");
        },
      };
    }

    const loggedOut = audienceNode("loggedOut", false);
    const signedIn = audienceNode("loggedInNoAccess", true);
    const root = {
      querySelectorAll: () => [loggedOut, signedIn],
    } as unknown as ParentNode;

    applyPatternsAudienceMessaging("loggedOut", root);
    expect(loggedOut.isHidden()).toBe(false);
    expect(signedIn.isHidden()).toBe(true);

    applyPatternsAudienceMessaging("loggedInNoAccess", root);
    expect(loggedOut.isHidden()).toBe(true);
    expect(signedIn.isHidden()).toBe(false);

    applyPatternsAudienceMessaging("member", root);
    expect(loggedOut.isHidden()).toBe(true);
    expect(signedIn.isHidden()).toBe(true);
  });

  it("refreshes catalog presentation from the same paid-membership check as the CTA", () => {
    const src = readFileSync(resolve("src/lib/patterns/patternsLandingCta.ts"), "utf8");
    expect(src).toContain("applyPatternsCatalogPresentation(mode, pageRoot(root))");
    expect(src).toContain('root.closest("[data-patterns-page]")');
    expect(src).toContain("hasMemberAccess(memberOrPayload, options)");
    expect(src).toContain("getViewerAccessState(memberOrPayload, options)");
    expect(src).toContain("resolvePatternsCatalogAudience(res)");
    expect(src).toContain("applyPatternsSalesPresentation(");
    expect(src).toContain('page.dataset.patternsAccess = "pending"');
    expect(src).toContain("revealSales: false");
    expect(src).not.toContain("gaugeDemoTouched");
  });

  it("shows sales content to visitors and hides the sleeve demonstration from members", () => {
    function presentation(audience: "loggedOut" | "loggedInNoAccess" | "member" | "pending") {
      const sales = { hidden: false };
      const intro = { hidden: true };
      const demo = { hidden: false };
      const dataset: Record<string, string> = {};
      const root = {
        dataset,
        matches: (selector: string) => selector === "[data-patterns-page]",
        querySelectorAll: (selector: string) => {
          if (selector === "[data-patterns-sales]") return [sales];
          if (selector === "[data-patterns-member-intro]") return [intro];
          if (selector === "[data-gauge-demo]") return [demo];
          return [];
        },
      };
      applyPatternsSalesPresentation(audience, root as unknown as ParentNode);
      return { dataset, sales, intro, demo };
    }

    const loggedOut = presentation("loggedOut");
    expect(loggedOut.dataset.patternsAccess).toBe("visitor");
    expect(loggedOut.sales.hidden).toBe(false);
    expect(loggedOut.demo.hidden).toBe(false);
    expect(loggedOut.intro.hidden).toBe(true);

    const signedIn = presentation("loggedInNoAccess");
    expect(signedIn.dataset.patternsAccess).toBe("visitor");
    expect(signedIn.demo.hidden).toBe(false);
    expect(signedIn.intro.hidden).toBe(true);

    const member = presentation("member");
    expect(member.dataset.patternsAccess).toBe("member");
    expect(member.sales.hidden).toBe(true);
    expect(member.demo.hidden).toBe(true);
    expect(member.intro.hidden).toBe(false);

    const pending = presentation("pending");
    expect(pending.dataset.patternsAccess).toBe("pending");
    expect(pending.sales.hidden).toBe(true);
    expect(pending.demo.hidden).toBe(true);
    expect(pending.intro.hidden).toBe(true);
  });
});
