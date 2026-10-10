import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: vi.fn().mockResolvedValue(false),
  waitForMemberstackReady: vi.fn().mockResolvedValue(undefined),
  resolveCurrentMemberIdForDraftGuard: vi.fn().mockResolvedValue(null),
}));

vi.mock("./patternEditGateDebug", () => ({
  logPatternEditGateDebug: vi.fn(),
}));

import { authHeadersForCustomPatternProjects, resolveCustomPatternProjectAuth } from "./customPatternProjectAuth";
import { resolvePatternMembershipGateDecision } from "./patternMembershipPageGate";
import { invalidateSleevelessUserAccessCache, resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import {
  isHostedSetInSleeveDevTesting,
  KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
  SET_IN_DEV_TEST_HEADER,
} from "./setInSleeveDevTesting";

function stubPage(hostname: string, pathname: string): void {
  vi.stubGlobal("window", {
    location: { hostname, pathname, search: "?allowDev=1&setInDevTest=1" },
  });
  invalidateSleevelessUserAccessCache();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  invalidateSleevelessUserAccessCache();
});

describe("hosted Set-In Sleeve dev testing", () => {
  it("opens only Set-In Sleeve pages on kin-dev", () => {
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "kin-dev.netlify.app",
        pathname: "/patterns/set-in-sleeve/builder",
      }),
    ).toBe(true);
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "deploy-preview-9--kin-dev.netlify.app",
        pathname: "/patterns/set-in-sleeve/pattern/",
      }),
    ).toBe(true);
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "kin-dev.netlify.app",
        pathname: "/patterns/drop-shoulder/builder",
      }),
    ).toBe(false);
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "kin-dev.netlify.app",
        pathname: "/patterns/sleeveless/builder",
      }),
    ).toBe(false);
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "knititnow.com",
        pathname: "/patterns/set-in-sleeve/builder",
      }),
    ).toBe(false);
    expect(
      isHostedSetInSleeveDevTesting({
        hostname: "www.knititnow.com",
        pathname: "/patterns/set-in-sleeve/pattern/",
      }),
    ).toBe(false);
  });

  it("ignores the dev-user environment flag and the URL query", async () => {
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "true");
    stubPage("knititnow.com", "/patterns/set-in-sleeve/builder");
    await expect(resolvePatternMembershipGateDecision()).resolves.toMatchObject({ state: "locked" });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: false,
      hasSystemAccess: false,
    });
  });

  it("unlocks the Set-In Sleeve page on kin-dev without a membership plan", async () => {
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "false");
    stubPage("kin-dev.netlify.app", "/patterns/set-in-sleeve/builder");
    const decision = await resolvePatternMembershipGateDecision();
    expect(decision.state).toBe("member");
    expect(decision.access.memberId).toBe(KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID);
    expect(decision.access.activePlanIds).toBeUndefined();
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      hasSystemAccess: true,
      memberId: KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
    });
  });

  it("leaves other builders locked on the same kin-dev host", async () => {
    stubPage("kin-dev.netlify.app", "/patterns/drop-shoulder/builder");
    await expect(resolvePatternMembershipGateDecision()).resolves.toMatchObject({ state: "locked" });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({ hasSystemAccess: false });
  });

  it("saves with the fixed test header and does not send a member token", async () => {
    stubPage("kin-dev.netlify.app", "/patterns/set-in-sleeve/pattern/");
    const auth = await resolveCustomPatternProjectAuth();
    expect(auth).toEqual({ mode: "dev", devUserId: KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID });
    expect(authHeadersForCustomPatternProjects(auth)).toEqual({
      [SET_IN_DEV_TEST_HEADER]: "1",
    });
  });
});
