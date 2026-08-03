/**
 * Authentication + save-request behavior for the Custom Pattern project client.
 *
 * Regression coverage for the "Invalid or expired session." failure seen when a (newly registered)
 * member clicked Save Changes on the Edit Pattern page:
 *   - the update/create request must carry the *current* Memberstack Bearer token, read at send time;
 *   - a briefly-stale token (SDK still initialising) must be re-read and retried, not reused;
 *   - a genuinely expired/invalid session must be rejected with a clear re-sign-in message;
 *   - a failed update must NOT fall back to create (no silent duplicate) and must not touch the draft.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { testAccess } from "./patternAccessTestFixtures";

vi.mock("./sleevelessPatternSystemAccessClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessPatternSystemAccessClient")>();
  return {
    ...actual,
    resolveSleevelessUserAccessSnapshot: vi
      .fn()
      .mockResolvedValue(
        testAccess({ loggedIn: true, hasSystemAccess: true, freeClaimed: false }),
      ),
  };
});

import {
  listCustomPatternProjects,
  SESSION_EXPIRED_SAVE_MESSAGE,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import type {
  SaveCustomPatternProjectRequest,
  UpdateCustomPatternProjectRequest,
} from "./customPatternProjectTypes";

type MemberstackStub = {
  getCurrentMember?: () => Promise<unknown>;
  getMemberCookie?: () => string | null | Promise<string | null>;
  onReady?: Promise<unknown>;
};

function stubMemberstack(ms: MemberstackStub | undefined): void {
  vi.stubGlobal("window", { $memberstackDom: ms });
}

/** Signed-in member whose session cookie is immediately available. */
function loggedInMemberstack(token = "jwt-current-session"): MemberstackStub {
  return {
    getCurrentMember: async () => ({ data: { id: "mem_sb_123" } }),
    getMemberCookie: () => token,
    onReady: Promise.resolve(),
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function samplePattern(): SaveCustomPatternProjectRequest["pattern"] {
  return {
    id: "pattern-1",
    patternType: "sleeveless",
    style: { patternMode: "custom-build" },
    fit: { cbMeasurementOverrides: { chestBust: "40" } },
    yarnGauge: {},
    machine: {},
  } as unknown as SaveCustomPatternProjectRequest["pattern"];
}

function updatePayload(): UpdateCustomPatternProjectRequest {
  return {
    id: "proj-1",
    name: "Cm vest",
    notes: "",
    family: "sleeveless",
    source: "custom-build",
    pattern: samplePattern(),
    customOverrides: {},
  };
}

function savedProjectResponseBody() {
  return {
    ok: true,
    authMode: "member",
    project: {
      id: "proj-1",
      name: "Cm vest",
      family: "sleeveless",
      source: "custom-build",
      notes: "",
      pattern: samplePattern(),
      customOverrides: {},
      createdAt: "t1",
      updatedAt: "t2",
      version: 1,
    },
  };
}

describe("customPatternProjectClient authentication", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("1. an authenticated member can update an existing saved pattern", async () => {
    stubMemberstack(loggedInMemberstack());
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, savedProjectResponseBody()));
    vi.stubGlobal("fetch", fetchMock);

    const res = await updateCustomPatternProject(updatePayload());

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("custom-pattern-project-update");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("2. a newly authenticated member can update once the session cookie becomes available", async () => {
    // Simulate the SDK finishing session init: the first cookie read is empty, the next returns the JWT.
    let cookieReads = 0;
    const ms = loggedInMemberstack();
    ms.getMemberCookie = () => {
      cookieReads += 1;
      return cookieReads === 1 ? "" : "jwt-after-init";
    };
    stubMemberstack(ms);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, savedProjectResponseBody()));
    vi.stubGlobal("fetch", fetchMock);

    const res = await updateCustomPatternProject(updatePayload());

    expect(res.ok).toBe(true);
    expect(cookieReads).toBeGreaterThan(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer jwt-after-init",
    });
  });

  it("3. the update request includes the current Memberstack Bearer token and no member-id header", async () => {
    stubMemberstack(loggedInMemberstack("jwt-xyz"));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, savedProjectResponseBody()));
    vi.stubGlobal("fetch", fetchMock);

    await updateCustomPatternProject(updatePayload());

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-xyz");
    expect(headers["X-KBM-Member-Id"]).toBeUndefined();
  });

  it("4a. an unauthenticated (logged-out) session is rejected before any network call", async () => {
    // No member and dev fallback disabled -> resolves to mode "none".
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "false");
    stubMemberstack({ getCurrentMember: async () => null, onReady: Promise.resolve() });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await listCustomPatternProjects();

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sign in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("4b. a genuinely expired session (401 after token re-read) is rejected with a re-sign-in message", async () => {
    stubMemberstack(loggedInMemberstack());
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { ok: false, error: "Invalid or expired session." }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await listCustomPatternProjects();

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(SESSION_EXPIRED_SAVE_MESSAGE);
    // Retried exactly once with a freshly-read token before giving up.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("4c. a transiently-stale token succeeds after one automatic retry", async () => {
    stubMemberstack(loggedInMemberstack());
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { ok: false, error: "Invalid or expired session." }))
      .mockResolvedValueOnce(jsonResponse(200, savedProjectResponseBody()));
    vi.stubGlobal("fetch", fetchMock);

    const res = await updateCustomPatternProject(updatePayload());

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("5. a failed update preserves the draft edit and never falls back to create (no duplicate)", async () => {
    stubMemberstack(loggedInMemberstack());
    // The in-browser unsaved edit lives in the working draft; a failed save must not touch it.
    const draftBefore = JSON.stringify({ id: "pattern-1", edited: "chestBust=41cm" });
    localStorage.setItem("kbm_current_pattern", draftBefore);

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { ok: false, error: "Invalid or expired session." }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await updateCustomPatternProject(updatePayload());

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(SESSION_EXPIRED_SAVE_MESSAGE);

    // No request ever hit the create endpoint -> no silent duplicate.
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.every((url) => url.includes("custom-pattern-project-update"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("custom-pattern-project-save"))).toBe(false);

    // The unsaved edit is still in the browser.
    expect(localStorage.getItem("kbm_current_pattern")).toBe(draftBefore);
  });
});
