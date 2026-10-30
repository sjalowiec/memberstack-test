import { describe, expect, it, vi } from "vitest";

describe("member thank-you API authorization", () => {
  it("requires a Watson session before saving a checkbox", async () => {
    vi.resetModules();
    vi.doMock("../../../lib/watson/watsonApiAuth", async () => {
      const actual = await vi.importActual<typeof import("../../../lib/watson/watsonApiAuth")>(
        "../../../lib/watson/watsonApiAuth",
      );
      return {
        ...actual,
        requireWatsonAdminJson: vi.fn(async () =>
          actual.watsonJsonResponse({ ok: false, error: "Sign in required." }, 401),
        ),
      };
    });

    const { PATCH } = await import("./member-thank-yous");
    const response = await PATCH({
      cookies: {},
      request: new Request("https://example.com/api/watson/member-thank-yous", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripeChargeId: "ch_annual1",
          field: "video",
          sent: true,
        }),
      }),
    } as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });
});
