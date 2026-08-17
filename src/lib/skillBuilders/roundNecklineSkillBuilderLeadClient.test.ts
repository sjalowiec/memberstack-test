import { describe, expect, it, vi } from "vitest";
import {
  buildRoundNecklineLeadPayload,
  submitRoundNecklineLeadRequest,
} from "./roundNecklineSkillBuilderLeadClient";
import {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_ENDPOINT,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
} from "./roundNecklineSkillBuilderLeadShared";

describe("buildRoundNecklineLeadPayload", () => {
  it("requires a valid email and does not require a first name", () => {
    expect(buildRoundNecklineLeadPayload({ email: "" })).toEqual({
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.invalidEmail,
    });
    expect(buildRoundNecklineLeadPayload({ email: "ada@example.com" })).toEqual({
      email: "ada@example.com",
      "bot-field": "",
    });
  });

  it("trims values and includes an empty honeypot field", () => {
    expect(
      buildRoundNecklineLeadPayload({
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

describe("submitRoundNecklineLeadRequest", () => {
  it("posts to the first-party endpoint and continues on success", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await submitRoundNecklineLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: true,
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      ROUND_NECKLINE_SKILL_BUILDER_LEAD_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ email: "ada@example.com", "bot-field": "" });
  });

  it("still continues when the server reports an ActiveCampaign failure", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.genericFailure,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await submitRoundNecklineLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: true,
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
  });

  it("still blocks invalid emails before calling the server", () => {
    expect(buildRoundNecklineLeadPayload({ email: "not-an-email" })).toEqual({
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.invalidEmail,
    });
  });

  it("returns a friendly error on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const result = await submitRoundNecklineLeadRequest(
      { email: "ada@example.com", "bot-field": "" },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: false,
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.genericFailure,
    });
  });
});
