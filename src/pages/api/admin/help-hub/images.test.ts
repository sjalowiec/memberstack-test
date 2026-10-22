import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const saveHelpHubImage = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../../lib/helpHub/imageStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/helpHub/imageStore")>();
  return { ...actual, saveHelpHubImage };
});

import { POST } from "./images";

const cookies = { get: () => undefined };

function request(body?: unknown): Request {
  return new Request("https://kin-dev.netlify.app/api/admin/help-hub/images", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Help Hub image upload API", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    saveHelpHubImage.mockReset();
  });

  it("rejects a signed-out upload before storing anything", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await POST({ request: request({ filename: "a.png", dataBase64: "aa" }), cookies } as never);
    expect(response.status).toBe(401);
    expect(saveHelpHubImage).not.toHaveBeenCalled();
  });

  it("stores an admin upload and returns the site address", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "admin", email: "admin@example.com" },
      mode: "verified",
    });
    saveHelpHubImage.mockResolvedValue({
      filename: "double_high.png",
      url: "/images/help-hub/double_high.png",
    });
    const response = await POST({
      request: request({ filename: "double_high.png", mimeType: "image/png", dataBase64: "aa" }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      filename: "double_high.png",
      url: "/images/help-hub/double_high.png",
    });
  });
});
