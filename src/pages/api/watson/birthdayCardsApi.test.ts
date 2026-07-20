import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

describe("Watson birthday-cards API routes", () => {
  it("defines admin-gated year list and status update endpoints", () => {
    const api = fs.readFileSync(
      path.resolve("src/pages/api/watson/birthday-cards/index.ts"),
      "utf8",
    );

    expect(api).toContain("requireWatsonAdminJson");
    expect(api).toContain("export const GET");
    expect(api).toContain("export const PATCH");
    expect(api).toContain("listBirthdayCardStatusesForYear");
    expect(api).toContain("setBirthdayCardStatus");
    expect(api).toContain("export const prerender = false");
    expect(api).toContain("birthdayYear");
  });

  it("keeps birthday-cards under Watson API routes only", () => {
    const apiPath = path.resolve("src/pages/api/watson/birthday-cards/index.ts");
    expect(apiPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);
  });
});

describe("Watson birthday-cards authorization gate", () => {
  it("requires Watson admin session for GET", async () => {
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

    const { GET } = await import("./birthday-cards/index");
    const response = await GET({
      cookies: {},
      url: new URL("https://example.com/api/watson/birthday-cards?year=2026"),
    } as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/sign in/i);

    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });

  it("requires Watson admin session for PATCH", async () => {
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

    const { PATCH } = await import("./birthday-cards/index");
    const response = await PATCH({
      cookies: {},
      url: new URL("https://example.com/api/watson/birthday-cards"),
      request: new Request("https://example.com/api/watson/birthday-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: "M-1",
          birthdayYear: 2026,
          status: "sent",
        }),
      }),
    } as never);

    expect(response.status).toBe(401);

    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });
});
