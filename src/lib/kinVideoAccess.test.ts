import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import {
  activeVideoPlanIdsFromMemberPayload,
  hasKinVideoAccess,
  VIDEO_MEMBERSHIP_PLAN_IDS,
} from "./kinVideoAccess";

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
          auth: { email: "membertest@knititnow.com" },
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
          auth: { email: "sue@knititnow.com" },
          planConnections: [
            { planId: MEMBERSHIPS.premiumAnnual.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns true for active beta plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          auth: { email: "betatest@knititnow.com" },
          planConnections: [
            { planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns true for legacy annual basic plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.legacyBasicAnnual.memberstackPlanId, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns true when plan connection uses active=true without status", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.basicMonthly.memberstackPlanId, active: true },
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns true for nested data.member payloads from getCurrentMember", () => {
    expect(
      hasKinVideoAccess({
        data: {
          member: {
            auth: { email: "member@example.com" },
            planConnections: [
              { planId: MEMBERSHIPS.premiumMonthly.memberstackPlanId, status: "ACTIVE" },
            ],
          },
        },
      }),
    ).toBe(true);
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

  it("returns false for empty payload", () => {
    expect(hasKinVideoAccess(null)).toBe(false);
    expect(hasKinVideoAccess(undefined)).toBe(false);
  });
});

describe("activeVideoPlanIdsFromMemberPayload", () => {
  it("reads plan ids from plan, id, or planId fields", () => {
    expect(
      activeVideoPlanIdsFromMemberPayload({
        data: {
          planConnections: [{ plan: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }],
        },
      }),
    ).toEqual([MEMBERSHIPS.beta.memberstackPlanId]);
  });

  it("lists every configured video membership plan id", () => {
    expect(VIDEO_MEMBERSHIP_PLAN_IDS).toEqual([
      MEMBERSHIPS.beta.memberstackPlanId,
      MEMBERSHIPS.basicMonthly.memberstackPlanId,
      MEMBERSHIPS.basicAnnual.memberstackPlanId,
      MEMBERSHIPS.premiumMonthly.memberstackPlanId,
      MEMBERSHIPS.premiumAnnual.memberstackPlanId,
      MEMBERSHIPS.legacyBasicAnnual.memberstackPlanId,
    ]);
  });
});
