import { describe, expect, it, vi } from "vitest";

import {
  EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
  mapSignupResultToRecord,
  recordEmailSignupQuietly,
  safeActiveCampaignErrorSummary,
} from "./emailSignupRecord";
import type { EmailListSignupHandlerResult } from "./emailListSignup";

describe("mapSignupResultToRecord", () => {
  it("maps created_and_subscribed to added", () => {
    const result: EmailListSignupHandlerResult = {
      ok: true,
      status: 200,
      message: "ok",
      messageKey: "subscribed",
      outcome: "created_and_subscribed",
    };
    expect(mapSignupResultToRecord({ email: "Ada@Example.com", result })).toEqual({
      email: "ada@example.com",
      source: EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
      status: "added",
      outcome: "created_and_subscribed",
      errorSummary: null,
    });
  });

  it("maps subscribed_existing to added (newly joining the KIN list)", () => {
    const result: EmailListSignupHandlerResult = {
      ok: true,
      status: 200,
      message: "ok",
      messageKey: "subscribed",
      outcome: "subscribed_existing",
    };
    expect(mapSignupResultToRecord({ email: "ada@example.com", result })?.status).toBe(
      "added",
    );
  });

  it("maps already_subscribed to already-subscribed", () => {
    const result: EmailListSignupHandlerResult = {
      ok: true,
      status: 200,
      message: "ok",
      messageKey: "already",
      outcome: "already_subscribed",
    };
    expect(mapSignupResultToRecord({ email: "ada@example.com", result })).toMatchObject({
      status: "already-subscribed",
      outcome: "already_subscribed",
    });
  });

  it("maps consent-protected outcomes to not-added with specific outcome", () => {
    for (const outcome of [
      "skipped_unsubscribed",
      "skipped_bounced",
      "skipped_unconfirmed",
      "skipped_unknown_status",
    ] as const) {
      const result: EmailListSignupHandlerResult = {
        ok: true,
        status: 200,
        message: "ok",
        messageKey: "already",
        outcome,
      };
      expect(mapSignupResultToRecord({ email: "ada@example.com", result })).toEqual({
        email: "ada@example.com",
        source: EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
        status: "not-added",
        outcome,
        errorSummary: null,
      });
    }
  });

  it("does not record honeypot or rate-limit decoys", () => {
    expect(
      mapSignupResultToRecord({
        email: "ada@example.com",
        result: {
          ok: true,
          status: 200,
          message: "ok",
          messageKey: "already",
          outcome: "honeypot",
        },
      }),
    ).toBeNull();
    expect(
      mapSignupResultToRecord({
        email: "ada@example.com",
        result: {
          ok: true,
          status: 200,
          message: "ok",
          messageKey: "already",
          outcome: "rate_limited",
        },
      }),
    ).toBeNull();
  });

  it("does not record validation failures", () => {
    expect(
      mapSignupResultToRecord({
        email: "ada@example.com",
        result: { ok: false, status: 400, error: "bad" },
      }),
    ).toBeNull();
  });

  it("maps server failures to failed with a safe summary", () => {
    expect(
      mapSignupResultToRecord({
        email: "ada@example.com",
        result: { ok: false, status: 502, error: "generic" },
        failureOutcome: "ac_request_failed",
        errorSummary: "ActiveCampaign request failed (HTTP 500)",
      }),
    ).toEqual({
      email: "ada@example.com",
      source: EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
      status: "failed",
      outcome: "ac_request_failed",
      errorSummary: "ActiveCampaign request failed (HTTP 500)",
    });
  });
});

describe("safeActiveCampaignErrorSummary", () => {
  it("keeps only the HTTP status, never response bodies", () => {
    expect(
      safeActiveCampaignErrorSummary(
        new Error("ActiveCampaign contact lookup failed (HTTP 500): secret-body"),
      ),
    ).toBe("ActiveCampaign request failed (HTTP 500)");
    expect(safeActiveCampaignErrorSummary(new Error("boom"))).toBe(
      "ActiveCampaign request failed",
    );
  });
});

describe("recordEmailSignupQuietly", () => {
  it("swallows recorder errors", async () => {
    const recorder = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(
      recordEmailSignupQuietly(
        {
          email: "ada@example.com",
          source: EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
          status: "added",
          outcome: "created_and_subscribed",
          errorSummary: null,
        },
        { recorder, onError: () => undefined },
      ),
    ).resolves.toBeUndefined();
    expect(recorder).toHaveBeenCalled();
  });

  it("skips persistence when no recorder is provided", async () => {
    await expect(
      recordEmailSignupQuietly({
        email: "ada@example.com",
        source: EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
        status: "added",
        outcome: "created_and_subscribed",
        errorSummary: null,
      }),
    ).resolves.toBeUndefined();
  });
});
