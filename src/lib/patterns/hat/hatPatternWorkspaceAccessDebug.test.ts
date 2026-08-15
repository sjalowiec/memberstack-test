import { afterEach, describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../../config/memberships";
import {
  buildHatPatternAccessDebugReport,
  hatPatternAccessDiagnosticsEnabled,
  noteHatPatternKinMemberAccessEvent,
  noteHatPatternMemberstackPayload,
  resetHatPatternAccessDebugState,
} from "./hatPatternWorkspaceAccessDebug";

describe("Hat finished-pattern access diagnostics (temporary, non-production)", () => {
  afterEach(() => {
    resetHatPatternAccessDebugState();
  });

  it("runs on localhost and Netlify dev, not on production hosts", () => {
    expect(
      hatPatternAccessDiagnosticsEnabled({
        hostname: "localhost",
        isViteDev: true,
        publicSiteEnv: null,
      }),
    ).toBe(true);
    expect(
      hatPatternAccessDiagnosticsEnabled({
        hostname: "kin-dev.netlify.app",
        isViteDev: false,
        publicSiteEnv: "dev",
      }),
    ).toBe(true);
    expect(
      hatPatternAccessDiagnosticsEnabled({
        hostname: "knititnow.com",
        isViteDev: false,
        publicSiteEnv: "production",
      }),
    ).toBe(false);
  });

  it("redacts member ids and never includes an email address", () => {
    noteHatPatternKinMemberAccessEvent("memberAccess");
    noteHatPatternMemberstackPayload({
      data: {
        id: "mem_abc123xyz",
        auth: { email: "secret.member@example.com" },
        planConnections: [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE", active: true },
        ],
      },
    });

    const report = buildHatPatternAccessDebugReport("memberAccess");
    expect(report.memberstackMemberFound).toBe(true);
    expect(report.memberIdPresent).toBe(true);
    expect(report.memberIdRedacted).toBe("mem_…yz");
    expect(report.emailPresent).toBe(true);
    expect(report.hatWorkspace).toBe("member");
    expect(report.saveAllowed).toBe(true);
    expect(JSON.stringify(report)).not.toContain("secret.member@example.com");
    expect(report).not.toHaveProperty("email");
    expect(report).not.toHaveProperty("memberEmail");
  });
});
