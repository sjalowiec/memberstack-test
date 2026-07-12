import { describe, expect, it, vi } from "vitest";

import { readWatsonJsonBody, requireWatsonAdminJson, watsonJsonResponse } from "./watsonApiAuth";

vi.mock("../admin/requireAdminRequest", () => ({
  requireAdminForRequest: vi.fn(),
}));

import { requireAdminForRequest } from "../admin/requireAdminRequest";

describe("watsonApiAuth", () => {
  it("returns JSON auth errors when admin check fails", async () => {
    vi.mocked(requireAdminForRequest).mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "You don't have admin access to Watson.",
    });

    const response = await requireWatsonAdminJson({
      request: new Request("https://example.com/api/watson/notes/1"),
      cookies: {
        get: () => undefined,
      },
    } as never);

    expect(response).toBeInstanceOf(Response);
    if (response instanceof Response) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        ok: false,
        error: "You don't have admin access to Watson.",
      });
    }
  });

  it("returns admin member when auth succeeds", async () => {
    vi.mocked(requireAdminForRequest).mockResolvedValueOnce({
      ok: true,
      member: { id: "admin-1", email: "sue@example.com" },
      mode: "verified",
    });

    const result = await requireWatsonAdminJson({
      request: new Request("https://example.com/api/watson/notes/1"),
      cookies: {
        get: () => undefined,
      },
    } as never);

    expect(result).toEqual({
      ok: true,
      member: { id: "admin-1", email: "sue@example.com" },
    });
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
