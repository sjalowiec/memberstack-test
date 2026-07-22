import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  MEMBER_PLAN_IDS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../config/memberships";
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

  it("returns false for the removed annual Basic plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          auth: { email: "membertest@knititnow.com" },
          planConnections: [
            { planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" },
          ],
        },
      }),
    ).toBe(false);
  });

  it("returns true for active membership plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          auth: { email: "sue@knititnow.com" },
          planConnections: [
            { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
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

  it("returns true for remaining legacy monthly Basic plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
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
            { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, active: true },
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
              { planId: LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId, status: "ACTIVE" },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  it("returns false for inactive membership plan", () => {
    expect(
      hasKinVideoAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "CANCELED" },
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
    expect(VIDEO_MEMBERSHIP_PLAN_IDS).toEqual([...MEMBER_PLAN_IDS]);
  });
});
