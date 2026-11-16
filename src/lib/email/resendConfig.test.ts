import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MISSING_CONTACT_FROM_MESSAGE,
  RESEND_TESTING_FROM_MESSAGE,
  VERIFIED_CONTACT_FROM_EMAIL,
  isResendTestingSender,
  readResendConfig,
  resolveContactFromAddress,
} from "./resendConfig";

describe("resolveContactFromAddress", () => {
  const previousFrom = process.env.CONTACT_FROM_EMAIL;
  const previousKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (previousFrom == null) delete process.env.CONTACT_FROM_EMAIL;
    else process.env.CONTACT_FROM_EMAIL = previousFrom;
    if (previousKey == null) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    vi.restoreAllMocks();
  });

  it("uses the verified Knit It Now sender", () => {
    expect(resolveContactFromAddress(VERIFIED_CONTACT_FROM_EMAIL)).toEqual({
      ok: true,
      fromAddress: VERIFIED_CONTACT_FROM_EMAIL,
    });
  });

  it("refuses a missing sender instead of falling back", () => {
    expect(resolveContactFromAddress("  ")).toEqual({
      ok: false,
      reason: MISSING_CONTACT_FROM_MESSAGE,
    });
  });

  it("refuses the Resend testing address in any display format", () => {
    expect(isResendTestingSender("onboarding@resend.dev")).toBe(true);
    expect(resolveContactFromAddress("Knit It Now <onboarding@resend.dev>")).toEqual({
      ok: false,
      reason: RESEND_TESTING_FROM_MESSAGE,
    });
    expect(resolveContactFromAddress("Onboarding@Resend.dev")).toEqual({
      ok: false,
      reason: RESEND_TESTING_FROM_MESSAGE,
    });
  });

  it("reads CONTACT_FROM_EMAIL from the environment and does not substitute the testing address", () => {
    process.env.CONTACT_FROM_EMAIL = VERIFIED_CONTACT_FROM_EMAIL;
    process.env.RESEND_API_KEY = "test-key";
    expect(readResendConfig()).toEqual({
      apiKey: "test-key",
      fromAddress: VERIFIED_CONTACT_FROM_EMAIL,
    });

    process.env.CONTACT_FROM_EMAIL = "Knit It Now <onboarding@resend.dev>";
    expect(readResendConfig()).toBeNull();
  });
});
