import { describe, expect, it } from "vitest";

import {
  isConfirmedLive,
  isScheduledInvocation,
  isScheduledLiveEnabled,
  resolveReminderExecution,
} from "../legacy-renewal-reminders";

const SECRET = "renewal-s3cr3t";

describe("isScheduledLiveEnabled", () => {
  it("is false when the variable is absent", () => {
    expect(isScheduledLiveEnabled({})).toBe(false);
  });

  it('is false unless the variable is exactly "true"', () => {
    for (const value of ["false", "FALSE", "True", "TRUE", "1", " true ", "yes"]) {
      expect(
        isScheduledLiveEnabled({ LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: value }),
      ).toBe(false);
    }
    expect(
      isScheduledLiveEnabled({ LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: "true" }),
    ).toBe(true);
  });
});

describe("resolveReminderExecution — scheduled runs", () => {
  it("defaults to dry-run when the live variable is absent", () => {
    expect(
      resolveReminderExecution({
        scheduled: true,
        confirmLive: false,
        providedSecret: null,
        configuredSecret: null,
        liveEnabled: isScheduledLiveEnabled({}),
      }),
    ).toEqual({ authorized: true, dryRun: true, triggerSource: "scheduled" });
  });

  it("is live only when the live variable is exactly true", () => {
    expect(
      resolveReminderExecution({
        scheduled: true,
        confirmLive: false,
        providedSecret: null,
        configuredSecret: null,
        liveEnabled: isScheduledLiveEnabled({
          LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: "true",
        }),
      }),
    ).toEqual({ authorized: true, dryRun: false, triggerSource: "scheduled" });
  });
});

describe("resolveReminderExecution — manual runs", () => {
  it("defaults a plain manual request to dry-run", () => {
    expect(
      resolveReminderExecution({
        scheduled: false,
        confirmLive: false,
        providedSecret: null,
        configuredSecret: SECRET,
        liveEnabled: false,
      }),
    ).toEqual({ authorized: true, dryRun: true, triggerSource: "manual" });
  });

  it("rejects a live manual run when no secret is configured", () => {
    const decision = resolveReminderExecution({
      scheduled: false,
      confirmLive: true,
      providedSecret: SECRET,
      configuredSecret: null,
      liveEnabled: true,
    });
    expect(decision.authorized).toBe(false);
    if (!decision.authorized) expect(decision.status).toBe(401);
  });

  it("rejects a live manual run when the secret header is wrong", () => {
    expect(
      resolveReminderExecution({
        scheduled: false,
        confirmLive: true,
        providedSecret: "wrong",
        configuredSecret: SECRET,
        liveEnabled: true,
      }).authorized,
    ).toBe(false);
  });

  it("allows a live manual run with confirm=LIVE and the correct secret", () => {
    expect(
      resolveReminderExecution({
        scheduled: false,
        confirmLive: true,
        providedSecret: SECRET,
        configuredSecret: SECRET,
        liveEnabled: false,
      }),
    ).toEqual({ authorized: true, dryRun: false, triggerSource: "manual" });
  });

  it("does not allow a live manual run from confirm=LIVE alone (no secret)", () => {
    expect(
      resolveReminderExecution({
        scheduled: false,
        confirmLive: true,
        providedSecret: null,
        configuredSecret: SECRET,
        liveEnabled: true,
      }).authorized,
    ).toBe(false);
  });
});

describe("request parsing helpers", () => {
  it("detects scheduled invocations by the next_run marker", () => {
    expect(
      isScheduledInvocation(JSON.stringify({ next_run: "2026-08-02T09:00:00Z" })),
    ).toBe(true);
    expect(isScheduledInvocation("")).toBe(false);
    expect(isScheduledInvocation("{}")).toBe(false);
    expect(isScheduledInvocation("not json")).toBe(false);
  });

  it("detects ?confirm=LIVE regardless of case", () => {
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-renewal-reminders?confirm=LIVE")),
    ).toBe(true);
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-renewal-reminders?confirm=live")),
    ).toBe(true);
    expect(
      isConfirmedLive(new URL("https://x/.netlify/functions/legacy-renewal-reminders")),
    ).toBe(false);
  });
});
