import { describe, expect, it, vi } from "vitest";

import { readWatsonJsonBody, requireWatsonSessionJson, watsonJsonResponse } from "./watsonApiAuth";

vi.mock("./watsonAuth", () => ({
  isWatsonSessionAuthenticated: vi.fn(),
}));

import { isWatsonSessionAuthenticated } from "./watsonAuth";

describe("watsonApiAuth", () => {
  it("returns JSON auth errors when the Watson session is missing", async () => {
    vi.mocked(isWatsonSessionAuthenticated).mockReturnValueOnce(false);

    const response = await requireWatsonSessionJson({
      request: new Request("https://example.com/api/watson/notes/1"),
      cookies: {
        get: () => undefined,
      },
    } as never);

    expect(response).toBeInstanceOf(Response);
    if (response instanceof Response) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        error: "Sign in required.",
      });
    }
  });

  it("allows requests with a valid Watson session", async () => {
    vi.mocked(isWatsonSessionAuthenticated).mockReturnValueOnce(true);

    const result = await requireWatsonSessionJson({
      request: new Request("https://example.com/api/watson/notes/1"),
      cookies: {
        get: () => ({ value: "session-token" }),
      },
    } as never);

    expect(result).toEqual({ ok: true });
  });

  it("rejects non-JSON request bodies", async () => {
    const response = await readWatsonJsonBody(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      }),
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.response.status).toBe(400);
    }
  });

  it("returns no-store JSON responses", async () => {
    const response = watsonJsonResponse({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
