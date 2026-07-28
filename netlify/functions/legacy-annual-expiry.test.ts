import { describe, expect, it, vi } from "vitest";

import type { MemberstackMember } from "../../src/lib/membership/membershipSummary";
import type { WatsonQueryFn } from "../../src/lib/watson/memberSearch";
import {
  LEGACY_ANNUAL_PLAN_ID,
  runLegacyAnnualExpiry,
  type MemberstackEmailResolution,
  type ResolveMemberstackMemberByEmail,
} from "../../src/lib/watson/legacyAnnualExpiry";
import {
  isConfirmedLive,
  isScheduledInvocation,
  isScheduledLiveEnabled,
  resolveExpiryExecution,
} from "./legacy-annual-expiry";

const SECRET = "s3cr3t-value";

describe("isScheduledLiveEnabled", () => {
  it("is false when the variable is absent", () => {
    expect(isScheduledLiveEnabled({})).toBe(false);
  });

  it("is false when the variable is not exactly \"true\"", () => {
    for (const value of ["false", "FALSE", "True", "TRUE", "1", " true ", "yes"]) {
      expect(
        isScheduledLiveEnabled({ LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED: value }),
      ).toBe(false);
    }
  });

  it("is true only when the variable is exactly \"true\"", () => {
    expect(
      isScheduledLiveEnabled({ LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED: "true" }),
    ).toBe(true);
  });
});

describe("resolveExpiryExecution - scheduled runs", () => {
  it("defaults to dry-run when the live variable is absent", () => {
    const decision = resolveExpiryExecution({
      scheduled: true,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: null,
      liveEnabled: isScheduledLiveEnabled({}),
    });
    expect(decision).toEqual({
      authorized: true,
      dryRun: true,
      triggerSource: "scheduled",
    });
  });

  it("is dry-run when the live variable is false", () => {
    const decision = resolveExpiryExecution({
      scheduled: true,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: null,
      liveEnabled: isScheduledLiveEnabled({
        LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED: "false",
      }),
    });
    expect(decision).toEqual({
      authorized: true,
      dryRun: true,
      triggerSource: "scheduled",
    });
  });

  it("is live only when the live variable is exactly true", () => {
    const decision = resolveExpiryExecution({
      scheduled: true,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: null,
      liveEnabled: isScheduledLiveEnabled({
        LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED: "true",
      }),
    });
    expect(decision).toEqual({
      authorized: true,
      dryRun: false,
      triggerSource: "scheduled",
    });
  });
});

describe("resolveExpiryExecution - manual runs", () => {
  it("defaults a plain manual request to dry-run", () => {
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: SECRET,
      liveEnabled: false,
    });
    expect(decision).toEqual({
      authorized: true,
      dryRun: true,
      triggerSource: "manual",
    });
  });

  it("rejects a live manual run when no secret is configured", () => {
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: SECRET,
      configuredSecret: null,
      liveEnabled: true,
    });
    expect(decision.authorized).toBe(false);
    if (!decision.authorized) {
      expect(decision.status).toBe(401);
    }
  });

  it("rejects a live manual run when the secret header is wrong", () => {
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: "wrong",
      configuredSecret: SECRET,
      liveEnabled: true,
    });
    expect(decision.authorized).toBe(false);
  });

  it("allows a live manual run with confirm=LIVE and the correct secret", () => {
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: SECRET,
      configuredSecret: SECRET,
      liveEnabled: false, // must NOT depend on the scheduled live flag
    });
    expect(decision).toEqual({
      authorized: true,
      dryRun: false,
      triggerSource: "manual",
    });
  });

  it("does not allow a live manual run from confirm=LIVE alone (no secret)", () => {
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: null,
      configuredSecret: SECRET,
      liveEnabled: true,
    });
    expect(decision.authorized).toBe(false);
  });
});

describe("request parsing helpers", () => {
  it("detects scheduled invocations by the next_run marker", () => {
    expect(isScheduledInvocation(JSON.stringify({ next_run: "2026-08-02T09:00:00Z" }))).toBe(
      true,
    );
    expect(isScheduledInvocation("")).toBe(false);
    expect(isScheduledInvocation("{}")).toBe(false);
    expect(isScheduledInvocation("not json")).toBe(false);
  });

  it("detects ?confirm=LIVE regardless of case", () => {
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-annual-expiry?confirm=LIVE")),
    ).toBe(true);
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-annual-expiry?confirm=live")),
    ).toBe(true);
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-annual-expiry")),
    ).toBe(false);
  });
});

describe("manual dry-run never removes plans", () => {
  it("does not call removeLegacyPlan for a dry-run manual execution", async () => {
    // A plain manual POST resolves to dry-run...
    const decision = resolveExpiryExecution({
      scheduled: false,
      confirmLive: false,
      providedSecret: null,
      configuredSecret: SECRET,
      liveEnabled: true,
    });
    expect(decision).toMatchObject({ authorized: true, dryRun: true });

    // ...and running in that mode must not modify Memberstack.
    const member: MemberstackMember = {
      id: "mem_test",
      auth: { email: "a@x.com" },
      planConnections: [{ planId: LEGACY_ANNUAL_PLAN_ID, active: true }],
    };
    const removeLegacyPlan = vi.fn(async () => {});
    const queryFn = (async () => [
      { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
    ]) as unknown as WatsonQueryFn;
    const resolver: ResolveMemberstackMemberByEmail = async () =>
      ({ status: "unique", member }) satisfies MemberstackEmailResolution;

    const result = await runLegacyAnnualExpiry({
      now: new Date("2026-07-28T19:00:00Z"),
      dryRun: (decision as { dryRun: boolean }).dryRun,
      triggerSource: "manual",
      queryFn,
      resolveMemberstackMemberByEmail: resolver,
      removeLegacyPlan,
    });

    expect(result.dryRun).toBe(true);
    expect(result.legacyPlansRemoved).toBe(1);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });
});
