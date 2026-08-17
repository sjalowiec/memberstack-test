import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
  applyPatternsCatalogPresentation,
  PATTERN_CATALOG_MEMBERSHIP_BODY,
  PATTERN_CATALOG_MORE_HEADING,
  PATTERNS_LANDING_BECOME_MEMBER_LABEL,
  PATTERNS_LANDING_LOGIN_LABEL,
  PATTERNS_LANDING_MEMBERSHIP_BODY,
  PATTERNS_LANDING_MEMBERSHIP_HEADING,
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
    expect(PATTERN_CATALOG_MORE_HEADING).toBe("More Pattern Builders");
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toBe(
      "Sweater pattern builders are included with an active Knit It Now membership.",
    );
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).not.toMatch(/Dynamic Patterns are included/i);
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).not.toMatch(/Explore the available patterns below/i);
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

  it("refreshes catalog presentation from the same paid-membership check as the CTA", () => {
    const src = readFileSync(resolve("src/lib/patterns/patternsLandingCta.ts"), "utf8");
    expect(src).toContain("applyPatternsCatalogPresentation(mode, page)");
    expect(src).toContain('root.closest("[data-patterns-page]")');
    expect(src).toContain("hasMemberAccess(memberOrPayload)");
  });
});
