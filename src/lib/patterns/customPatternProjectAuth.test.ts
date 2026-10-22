import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  authHeadersForCustomPatternProjects,
  DEFAULT_DEV_PATTERN_USER_ID,
  getOrCreateDevPatternUserId,
  isDevCustomPatternProjectsEnabled,
  resolveCustomPatternProjectAuth,
} from "./customPatternProjectAuth";

describe("customPatternProjectAuth", () => {
  it("uses a stable default dev pattern user id", () => {
    expect(DEFAULT_DEV_PATTERN_USER_ID).toBe("dev_local_pattern_user");
  });

  it("is enabled in vitest (import.meta.env.DEV)", () => {
    expect(isDevCustomPatternProjectsEnabled()).toBe(true);
  });

  it("getOrCreateDevPatternUserId returns the default without localStorage", () => {
    expect(getOrCreateDevPatternUserId()).toBe(DEFAULT_DEV_PATTERN_USER_ID);
  });

  it("sends Authorization Bearer for member mode and never X-KBM-Member-Id", () => {
    const headers = authHeadersForCustomPatternProjects({
      mode: "member",
      memberId: "mem_spoofable",
      bearerToken: "jwt-abc",
    });
    expect(headers).toEqual({ Authorization: "Bearer jwt-abc" });
    expect(headers["X-KBM-Member-Id"]).toBeUndefined();
  });

  it("does not send member headers without a bearer token", () => {
    expect(
      authHeadersForCustomPatternProjects({
        mode: "member",
        memberId: "mem_1",
      }),
    ).toEqual({});
  });

  it("sends only the dev user header in local-dev mode", () => {
    expect(
      authHeadersForCustomPatternProjects({
        mode: "dev",
        devUserId: "dev_local_pattern_user",
      }),
    ).toEqual({ "X-KBM-Dev-User-Id": "dev_local_pattern_user" });
  });
});

function stubAuthWindow(
  hostname: string,
  memberstack: {
    getCurrentMember: () => Promise<unknown>;
    getMemberCookie: () => string;
    onReady: Promise<unknown>;
  },
): void {
  vi.stubGlobal("window", {
    location: { hostname, search: "" },
    $memberstackDom: memberstack,
  });
}

function signedInMemberstack(id: string, token: string) {
  return {
    getCurrentMember: vi.fn(async () => ({ data: { id } })),
    getMemberCookie: vi.fn(() => token),
    onReady: Promise.resolve(),
  };
}

describe("resolveCustomPatternProjectAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the same local dev user on localhost and does not send a Memberstack token", async () => {
    stubLocalStorage();
    const memberstack = signedInMemberstack("mem_nosub", "jwt-nosub");
    stubAuthWindow("localhost", memberstack);

    const auth = await resolveCustomPatternProjectAuth();

    expect(auth).toEqual({ mode: "dev", devUserId: DEFAULT_DEV_PATTERN_USER_ID });
    expect(authHeadersForCustomPatternProjects(auth)).toEqual({
      "X-KBM-Dev-User-Id": DEFAULT_DEV_PATTERN_USER_ID,
    });
    expect(memberstack.getCurrentMember).not.toHaveBeenCalled();
    expect(memberstack.getMemberCookie).not.toHaveBeenCalled();
  });

  it("uses that same local dev user on 127.0.0.1", async () => {
    stubLocalStorage();
    stubAuthWindow("127.0.0.1", signedInMemberstack("mem_nosub", "jwt-nosub"));

    const auth = await resolveCustomPatternProjectAuth();

    expect(auth).toEqual({ mode: "dev", devUserId: DEFAULT_DEV_PATTERN_USER_ID });
  });

  it("keeps Memberstack bearer auth when the host is not local pattern testing", async () => {
    stubAuthWindow("knititnow.com", signedInMemberstack("mem_paid", "jwt-paid"));

    const auth = await resolveCustomPatternProjectAuth();

    expect(auth).toEqual({
      mode: "member",
      memberId: "mem_paid",
      bearerToken: "jwt-paid",
    });
    const headers = authHeadersForCustomPatternProjects(auth);
    expect(headers).toEqual({ Authorization: "Bearer jwt-paid" });
    expect(headers["X-KBM-Dev-User-Id"]).toBeUndefined();
  });

  it("keeps Memberstack bearer auth on localhost when local pattern testing is turned off", async () => {
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "false");
    stubAuthWindow("localhost", signedInMemberstack("mem_paid", "jwt-paid"));

    const auth = await resolveCustomPatternProjectAuth();

    expect(auth.mode).toBe("member");
    expect(authHeadersForCustomPatternProjects(auth)).toEqual({
      Authorization: "Bearer jwt-paid",
    });
  });
});
