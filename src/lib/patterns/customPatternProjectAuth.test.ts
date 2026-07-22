import { describe, expect, it } from "vitest";
import {
  authHeadersForCustomPatternProjects,
  DEFAULT_DEV_PATTERN_USER_ID,
  getOrCreateDevPatternUserId,
  isDevCustomPatternProjectsEnabled,
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
