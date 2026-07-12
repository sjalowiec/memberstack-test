import { describe, expect, it } from "vitest";

import {
  isWatsonApiRoute,
  isWatsonRoute,
  watsonApiUnauthorizedResponse,
} from "./watsonAccess";

describe("watsonAccess", () => {
  it("matches /watson and nested routes", () => {
    expect(isWatsonRoute("/watson")).toBe(true);
    expect(isWatsonRoute("/watson/current")).toBe(true);
    expect(isWatsonRoute("/watson/members/123")).toBe(true);
    expect(isWatsonRoute("/watson/login")).toBe(true);
    expect(isWatsonRoute("/watsonish")).toBe(false);
    expect(isWatsonRoute("/admin")).toBe(false);
  });

  it("matches Watson API routes", () => {
    expect(isWatsonApiRoute("/api/watson/login")).toBe(true);
    expect(isWatsonApiRoute("/api/watson/notes/1")).toBe(true);
    expect(isWatsonApiRoute("/api/watsonish")).toBe(false);
  });

  it("returns JSON unauthorized responses for API routes", async () => {
    const response = watsonApiUnauthorizedResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: false, error: "Sign in required." });
  });
});
