import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import { hasKinVideoAccess } from "./kinVideoAccess";

describe("hasKinVideoAccess", () => {
  it("returns false for logged-in members with no plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          id: "ms_nosub",
          auth: { email: "nosub@knititnow.com" },
          planConnections: [],
          customFields: { "kin-access": "true" },
        },
      }),
    ).toBe(false);
  });

  it("returns true for active basic plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.basicMonthly.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns true for active premium plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.premiumAnnual.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns false for beta plan only", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(false);
  });

  it("returns false for inactive basic plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.basicMonthly.memberstackPlanId, status: "CANCELED" },
          ],
        },
      }),
    ).toBe(false);
  });

  it("returns true when member record is passed directly", () => {
    expect(
      hasKinVideoAccess({
        planConnections: [
          { planId: MEMBERSHIPS.basicAnnual.memberstackPlanId, status: "TRIALING" },
        ],
      }),
    ).toBe(true);
  });

  it("returns false for empty payload", () => {
    expect(hasKinVideoAccess(null)).toBe(false);
    expect(hasKinVideoAccess(undefined)).toBe(false);
  });
});
