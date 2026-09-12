import { afterEach, describe, expect, it, vi } from "vitest";
import { looksLikeJwt } from "../admin/requireAdminRequest";
import {
  KIN_ADMIN_PREVIEW_COOKIE,
  KIN_ADMIN_PREVIEW_MAX_AGE_SEC,
  KIN_ADMIN_PREVIEW_PATH,
  createKinAdminPreviewGrant,
  persistKinCourseAdminPreviewCookie,
  verifyKinAdminPreviewGrant,
} from "./adminPreviewGrant";

const ENV = { MEMBERSTACK_SECRET_KEY: "test-admin-preview-secret" };

describe("kin admin preview grant cookie", () => {
  afterEach(() => {
    delete process.env.MEMBERSTACK_SECRET_KEY;
  });

  it("creates a short-lived HMAC grant that is not a Memberstack JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value";
    const grant = createKinAdminPreviewGrant("mem_admin", { env: ENV });
    expect(grant).toBeTruthy();
    expect(grant?.split(".").length).toBe(2);
    expect(looksLikeJwt(grant!)).toBe(false);
    expect(grant).not.toContain(jwt);
    expect(grant).not.toContain("signature-value");
    expect(verifyKinAdminPreviewGrant(grant, { env: ENV })).toBe(true);
  });

  it("rejects expired, tampered, JWT-shaped, and unsigned values", () => {
    const grant = createKinAdminPreviewGrant("mem_admin", {
      env: ENV,
      now: Date.now() - KIN_ADMIN_PREVIEW_MAX_AGE_SEC * 1000 - 1000,
    });
    expect(verifyKinAdminPreviewGrant(grant, { env: ENV })).toBe(false);
    expect(verifyKinAdminPreviewGrant("not-a-grant", { env: ENV })).toBe(false);
    expect(
      verifyKinAdminPreviewGrant("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value", {
        env: ENV,
      }),
    ).toBe(false);

    const valid = createKinAdminPreviewGrant("mem_admin", { env: ENV })!;
    const tampered = `${valid.slice(0, -2)}aa`;
    expect(verifyKinAdminPreviewGrant(tampered, { env: ENV })).toBe(false);
    expect(createKinAdminPreviewGrant("mem_admin", { env: {} })).toBeNull();
    expect(createKinAdminPreviewGrant("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.sig", { env: ENV })).toBeNull();
  });

  it("sets httpOnly, HTTPS-only Secure, SameSite=Lax, /courses path, and 15-minute maxAge after persist", () => {
    process.env.MEMBERSTACK_SECRET_KEY = ENV.MEMBERSTACK_SECRET_KEY;
    const set = vi.fn();
    persistKinCourseAdminPreviewCookie(
      { get: () => undefined, set },
      new URL("https://www.knititnow.com/courses/86?preview=true"),
      "mem_admin",
    );
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, options] = set.mock.calls[0];
    expect(name).toBe(KIN_ADMIN_PREVIEW_COOKIE);
    expect(looksLikeJwt(value)).toBe(false);
    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: KIN_ADMIN_PREVIEW_PATH,
      maxAge: KIN_ADMIN_PREVIEW_MAX_AGE_SEC,
    });
  });

  it("does not set Secure on http localhost", () => {
    const set = vi.fn();
    process.env.MEMBERSTACK_SECRET_KEY = ENV.MEMBERSTACK_SECRET_KEY;
    persistKinCourseAdminPreviewCookie(
      { get: () => undefined, set },
      new URL("http://localhost:4321/courses/86?preview=true"),
      "mem_admin",
    );
    expect(set).toHaveBeenCalledWith(
      KIN_ADMIN_PREVIEW_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: "lax", path: "/courses" }),
    );
  });
});
