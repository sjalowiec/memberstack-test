import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/watson/watsonApiAuth", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/watson/watsonApiAuth")>(
    "../../../lib/watson/watsonApiAuth",
  );
  return {
    ...actual,
    requireWatsonSessionJson: vi.fn(async () =>
      actual.watsonJsonResponse({ ok: false, error: "Sign in required." }, 401),
    ),
  };
});

import { GET as listGet, POST as listPost } from "./vendors/index";
import { GET as itemGet, PATCH as itemPatch } from "./vendors/[id]";
import { requireWatsonSessionJson } from "../../../lib/watson/watsonApiAuth";

function apiContext(url: string, params: Record<string, string> = {}, method = "GET") {
  return {
    request: new Request(url, { method }),
    cookies: { get: () => undefined },
    params,
    url: new URL(url),
  } as never;
}

describe("Watson vendors API routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("gates list, create, get, and update routes with Watson session auth", () => {
    const listApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/vendors/index.ts"),
      "utf8",
    );
    const itemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/vendors/[id].ts"),
      "utf8",
    );

    expect(listApi).toContain("requireWatsonSessionJson");
    expect(listApi).toContain("export const GET");
    expect(listApi).toContain("export const POST");
    expect(listApi).toContain("createVendor");
    expect(listApi).toContain("export const prerender = false");
    expect(listApi).not.toContain("export const DELETE");

    expect(itemApi).toContain("requireWatsonSessionJson");
    expect(itemApi).toContain("export const GET");
    expect(itemApi).toContain("export const PATCH");
    expect(itemApi).toContain("updateVendor");
    expect(itemApi).not.toContain("export const DELETE");
    expect(itemApi).not.toMatch(/DELETE FROM watson_vendors/i);
  });

  it("rejects unauthorized access to vendor APIs", async () => {
    vi.mocked(requireWatsonSessionJson).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Sign in required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const listResponse = await listGet(
      apiContext("https://example.com/api/watson/vendors"),
    );
    expect(listResponse.status).toBe(401);

    const createResponse = await listPost(
      apiContext("https://example.com/api/watson/vendors", {}, "POST"),
    );
    expect(createResponse.status).toBe(401);

    const itemResponse = await itemGet(
      apiContext("https://example.com/api/watson/vendors/vendor-1", { id: "vendor-1" }),
    );
    expect(itemResponse.status).toBe(401);

    const patchResponse = await itemPatch(
      apiContext(
        "https://example.com/api/watson/vendors/vendor-1",
        { id: "vendor-1" },
        "PATCH",
      ),
    );
    expect(patchResponse.status).toBe(401);

    const body = await listResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/sign in/i);
  });
});
