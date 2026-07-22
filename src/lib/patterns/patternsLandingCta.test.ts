import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
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
});
