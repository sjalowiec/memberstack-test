import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessCourse } from "../lib/courseAccess";
import {
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
} from "../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../config/memberships";
import { kinCourseGateViewer } from "./kinCourseAccessGate";

const gateSource = readFileSync(
  resolve("src/scripts/kinCourseAccessGate.ts"),
  "utf8",
);

function payloadWithPlan(planId: string) {
  return {
    data: {
      id: "ms_member",
      auth: { email: "member@knititnow.com" },
      planConnections: [{ planId, status: "ACTIVE" }],
    },
  };
}

const loggedOutPayload = { data: { member: null } };
const loggedInNoPlan = {
  data: { id: "ms_nosub", auth: { email: "nosub@knititnow.com" }, planConnections: [] },
};

describe("kinCourseGateViewer", () => {
  it("treats a successful logged-out Memberstack payload as logged out, not signed-in", () => {
    expect(kinCourseGateViewer(false, loggedOutPayload)).toBe("loggedOut");
    expect(kinCourseGateViewer(false, null)).toBe("loggedOut");
  });

  it("shows the signed-in no-access card when a member has no course plan", () => {
    expect(kinCourseGateViewer(false, loggedInNoPlan)).toBe("loggedInNoAccess");
    expect(
      canAccessCourse("member", loggedInNoPlan, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
  });

  it("opens for Knit It Now membership and the SK840-only plan", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const sk840Only = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
    expect(canAccessCourse("member", member, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(
      true,
    );
    expect(
      canAccessCourse("member", sk840Only, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(kinCourseGateViewer(true, member)).toBe("open");
    expect(kinCourseGateViewer(true, sk840Only)).toBe("open");
  });
});

describe("KIN course gate live session refresh", () => {
  it("re-checks after Memberstack login and auth:updated", () => {
    expect(gateSource).toContain("isMemberLoggedIn");
    expect(gateSource).toContain('ms.on("member.login"');
    expect(gateSource).toContain('ms.on("member.logout"');
    expect(gateSource).toContain("auth:updated");
    expect(gateSource).not.toMatch(
      /unlocked \? "open" : res \? "loggedInNoAccess" : "loggedOut"/,
    );
  });
});
