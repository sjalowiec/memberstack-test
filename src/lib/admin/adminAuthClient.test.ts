import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_SIGN_IN_REQUIRED_MESSAGE,
  fetchAdminHtml,
  getAdminAuthHeaders,
  htmlLooksLikeAdminPreviewBootstrap,
  readMemberstackBearerToken,
} from "./adminAuthClient";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value";

describe("adminAuthClient", () => {
  it("reads a fresh Memberstack JWT for Authorization Bearer", async () => {
    const token = await readMemberstackBearerToken({
      memberstack: { getMemberCookie: () => JWT },
      attempts: 1,
    });
    expect(token).toBe(JWT);
  });

  it("sends Authorization Bearer on authenticated HTML preview fetch", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>course</html>", { status: 200 }));
    const result = await fetchAdminHtml("/courses/86?preview=true", {
      method: "GET",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getHeaders: async () => ({ Authorization: `Bearer ${JWT}` }),
    });
    expect(result.ok).toBe(true);
    expect(result.html).toContain("course");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/courses/86?preview=true",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        headers: expect.objectContaining({ Authorization: `Bearer ${JWT}` }),
      }),
    );
  });

  it("does not fetch HTML preview without a token outside local dev bypass", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchAdminHtml("/courses/86?preview=true", {
      method: "GET",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getHeaders: async () => ({}),
      allowMissingToken: false,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.needsSignIn).toBe(true);
    expect(result.error).toBe(ADMIN_SIGN_IN_REQUIRED_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("detects the unpublished preview bootstrap shell so it is never treated as course HTML", () => {
    expect(htmlLooksLikeAdminPreviewBootstrap('<body data-kin-admin-preview-bootstrap>')).toBe(
      true,
    );
    expect(htmlLooksLikeAdminPreviewBootstrap("<html><body>Course home</body></html>")).toBe(
      false,
    );
  });

  it("exports getAdminAuthHeaders for the Help Hub / report admin pattern", () => {
    expect(typeof getAdminAuthHeaders).toBe("function");
  });
});
