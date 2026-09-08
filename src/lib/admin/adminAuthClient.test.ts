import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SIGN_IN_REQUIRED_MESSAGE,
  fetchAdminJson,
  readMemberstackBearerToken,
  waitForMemberstackDom,
  type MemberstackDomLike,
} from "./adminAuthClient";
import { saveSucceeded } from "../helpHub/adminEditorClient";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("waitForMemberstackDom", () => {
  it("waits until Memberstack initializes instead of reading a missing SDK", async () => {
    let ready: MemberstackDomLike | undefined;
    const now = vi.fn(() => ready);
    const sleep = vi.fn(async () => {
      ready = {
        getCurrentMember: async () => ({ data: { id: "mem_sue" } }),
        getMemberCookie: async () => "jwt-after-init",
        onReady: Promise.resolve(),
      };
    });

    const ms = await waitForMemberstackDom({
      maxAttempts: 4,
      intervalMs: 1,
      now,
      sleep,
    });
    expect(ms?.getMemberCookie).toBeTypeOf("function");
    expect(sleep).toHaveBeenCalled();
  });
});

describe("readMemberstackBearerToken", () => {
  it("retries until a delayed JWT appears", async () => {
    let calls = 0;
    const memberstack: MemberstackDomLike = {
      getCurrentMember: async () => ({ data: { id: "mem_sue" } }),
      getMemberCookie: async () => {
        calls += 1;
        return calls < 3 ? "" : "jwt-fresh";
      },
      onReady: Promise.resolve(),
    };
    const token = await readMemberstackBearerToken({
      memberstack,
      attempts: 5,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(token).toBe("jwt-fresh");
    expect(calls).toBe(3);
  });

  it("returns null when the session is missing", async () => {
    const token = await readMemberstackBearerToken({
      memberstack: {
        getCurrentMember: async () => ({ data: null }),
        getMemberCookie: async () => null,
        onReady: Promise.resolve(),
      },
      attempts: 3,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(token).toBeNull();
  });
});

describe("fetchAdminJson", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { $memberstackDom: undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a fresh bearer token with a signed-in admin Save", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, tip: { status: "draft" } }));
    const result = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: { status: "draft" },
      fetchImpl,
      getHeaders: async () => ({ Authorization: "Bearer jwt-sue" }),
      allowMissingToken: false,
    });
    expect(result.ok).toBe(true);
    expect(saveSucceeded(result)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = (fetchImpl.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe("Bearer jwt-sue");
  });

  it("does not call the API when the session token is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: { status: "draft" },
      fetchImpl,
      getHeaders: async () => ({}),
      allowMissingToken: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.needsSignIn).toBe(true);
    expect(result.status).toBe(401);
    expect(result.error).toBe(ADMIN_SIGN_IN_REQUIRED_MESSAGE);
    expect(saveSucceeded(result)).toBe(false);
  });

  it("treats an expired or missing token 401 as sign-in required, not success", async () => {
    const result = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: {},
      fetchImpl: async () => jsonResponse(401, { ok: false, error: "Sign in required." }),
      getHeaders: async () => ({ Authorization: "Bearer expired" }),
      allowMissingToken: false,
    });
    expect(result.ok).toBe(false);
    expect(result.needsSignIn).toBe(true);
    expect(saveSucceeded(result)).toBe(false);
  });

  it("surfaces 403 without treating the Save as successful", async () => {
    const result = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: {},
      fetchImpl: async () => jsonResponse(403, { ok: false, error: "Admin access required." }),
      getHeaders: async () => ({ Authorization: "Bearer jwt-member" }),
      allowMissingToken: false,
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
    expect(saveSucceeded(result)).toBe(false);
  });

  it("reads a new token for every Save in the same editor session", async () => {
    const tokens = ["jwt-one", "jwt-two"];
    const getHeaders = vi.fn(async () => ({ Authorization: `Bearer ${tokens.shift()}` }));
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, tip: { id: 1008 } }));
    const first = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: { status: "draft" },
      fetchImpl,
      getHeaders,
      allowMissingToken: false,
    });
    const second = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: { status: "draft" },
      fetchImpl,
      getHeaders,
      allowMissingToken: false,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(getHeaders).toHaveBeenCalledTimes(2);
    expect(
      (fetchImpl.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers.Authorization,
    ).toBe("Bearer jwt-one");
    expect(
      (fetchImpl.mock.calls[1]?.[1] as { headers: Record<string, string> }).headers.Authorization,
    ).toBe("Bearer jwt-two");
  });

  it("shows Save success only after a confirmed successful API response", async () => {
    const rejected = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: {},
      fetchImpl: async () => jsonResponse(200, { ok: false, error: "slug is already in use." }),
      getHeaders: async () => ({ Authorization: "Bearer jwt-sue" }),
      allowMissingToken: false,
    });
    expect(saveSucceeded(rejected)).toBe(false);

    const accepted = await fetchAdminJson("/api/admin/help-hub/1008", {
      method: "PUT",
      body: {},
      fetchImpl: async () => jsonResponse(200, { ok: true, tip: { slug: "patterns-for-lk150" } }),
      getHeaders: async () => ({ Authorization: "Bearer jwt-sue" }),
      allowMissingToken: false,
    });
    expect(saveSucceeded(accepted)).toBe(true);
  });
});

describe("readMemberstackBearerToken freshness", () => {
  it("does not reuse a previous JWT when the cookie is later empty", async () => {
    let token: string | null = "jwt-first";
    const memberstack = {
      getCurrentMember: async () => ({ data: { id: "mem_sue" } }),
      getMemberCookie: async () => token,
      onReady: Promise.resolve(),
    };
    const first = await readMemberstackBearerToken({
      memberstack,
      attempts: 1,
      sleep: async () => undefined,
    });
    token = null;
    const second = await readMemberstackBearerToken({
      memberstack,
      attempts: 2,
      intervalMs: 1,
      sleep: async () => undefined,
    });
    expect(first).toBe("jwt-first");
    expect(second).toBeNull();
  });
});
