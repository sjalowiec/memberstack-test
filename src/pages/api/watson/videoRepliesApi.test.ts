import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

describe("Watson video-replies API routes", () => {
  it("defines admin-gated list, create, and update endpoints", () => {
    const listApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/video-replies/index.ts"),
      "utf8",
    );
    const itemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/video-replies/[id].ts"),
      "utf8",
    );

    expect(listApi).toContain("requireWatsonAdminJson");
    expect(listApi).toContain("export const GET");
    expect(listApi).toContain("export const POST");
    expect(listApi).toContain("listVideoReplies");
    expect(listApi).toContain("saveVideoReply");
    expect(listApi).toContain("export const prerender = false");
    expect(listApi).toContain("watsonJsonResponse");

    expect(itemApi).toContain("requireWatsonAdminJson");
    expect(itemApi).toContain("export const GET");
    expect(itemApi).toContain("export const PATCH");
    expect(itemApi).toContain("markVideoReplySent");
    expect(itemApi).toContain("disableVideoReply");
    expect(itemApi).toContain("updateVideoReplyFields");
  });

  it("keeps video-replies under Watson API routes only", () => {
    const listPath = path.resolve("src/pages/api/watson/video-replies/index.ts");
    expect(listPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);
  });
});

describe("Watson video-replies authorization gate", () => {
  it("requires Watson admin session for the list endpoint", async () => {
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

    const { GET } = await import("./video-replies/index");
    const response = await GET({
      cookies: {},
      url: new URL("https://example.com/api/watson/video-replies"),
    } as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/sign in/i);

    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });

  it("requires Watson admin session for create", async () => {
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

    const { POST } = await import("./video-replies/index");
    const response = await POST({
      cookies: {},
      url: new URL("https://example.com/api/watson/video-replies"),
      request: new Request("https://example.com/api/watson/video-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(response.status).toBe(401);

    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });
});
