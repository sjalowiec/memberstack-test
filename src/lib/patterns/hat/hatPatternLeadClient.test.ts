import { describe, expect, it, vi } from "vitest";
import {
  buildHatPatternLeadPayload,
  submitHatPatternLeadRequest,
} from "./hatPatternLeadClient";
import {
  HAT_PATTERN_LEAD_ENDPOINT,
  HAT_PATTERN_LEAD_MESSAGES,
} from "./hatPatternLeadShared";

describe("buildHatPatternLeadPayload", () => {
  it("requires a valid email and does not require a first name", () => {
    expect(buildHatPatternLeadPayload({ email: "" })).toEqual({
      error: HAT_PATTERN_LEAD_MESSAGES.invalidEmail,
    });
    expect(buildHatPatternLeadPayload({ email: "ada@example.com" })).toEqual({
      email: "ada@example.com",
      "bot-field": "",
    });
  });

  it("trims values and includes an empty honeypot field", () => {
    expect(
      buildHatPatternLeadPayload({
        email: "  ada@example.com  ",
        firstName: "  Ada  ",
      }),
    ).toEqual({
      email: "ada@example.com",
      firstName: "Ada",
      "bot-field": "",
    });
  });
});

describe("submitHatPatternLeadRequest", () => {
  it("posts to the Hat endpoint and continues on success", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: HAT_PATTERN_LEAD_MESSAGES.success,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await submitHatPatternLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: true,
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      HAT_PATTERN_LEAD_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ email: "ada@example.com", "bot-field": "" });
    expect(JSON.stringify(body)).not.toContain("lead: Hat Pattern");
  });

  it("still continues when the server reports an ActiveCampaign failure", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: HAT_PATTERN_LEAD_MESSAGES.genericFailure,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await submitHatPatternLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: true,
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
  });

  it("returns a friendly error on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const result = await submitHatPatternLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: false,
      error: HAT_PATTERN_LEAD_MESSAGES.genericFailure,
    });
  });
});
