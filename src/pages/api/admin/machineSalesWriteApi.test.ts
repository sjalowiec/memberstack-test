import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMachineSalesListings } from "../../../lib/machines/machineSalesListings";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const persistMachineSalesListings = vi.hoisted(() => vi.fn());
const persistMachineSalesImage = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/admin/requireAdminRequest", () => ({
  requireAdminForRequest,
}));

vi.mock("../../../lib/machines/machineSalesPersist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/machines/machineSalesPersist")>();
  return {
    ...actual,
    persistMachineSalesListings,
    persistMachineSalesImage,
  };
});

import { POST as savePost } from "./machine-sales";
import { POST as imagePost } from "./machine-sales-image";

const cookies = { get: () => undefined };

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Machines for Sale mutation auth", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    persistMachineSalesListings.mockReset();
    persistMachineSalesImage.mockReset();
    persistMachineSalesListings.mockImplementation(async (listings: unknown) => ({
      listings,
      persistedVia: "github",
      branch: "main",
      commitSha: "test-sha",
    }));
    persistMachineSalesImage.mockResolvedValue({
      filename: "probe.jpg",
      imageSrc: "/images/machines/probe.jpg",
      persistedVia: "github",
      branch: "main",
      commitSha: "img-sha",
    });
  });

  it("rejects an unauthorized listing save", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await savePost({
      request: jsonRequest("https://knititnow.com/api/admin/machine-sales", {
        mode: "edit",
        listing: { id: "x" },
      }),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(persistMachineSalesListings).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin listing save", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const response = await savePost({
      request: jsonRequest("https://knititnow.com/api/admin/machine-sales", {
        mode: "edit",
        listing: { id: "x" },
      }),
      cookies,
    } as never);
    expect(response.status).toBe(403);
    expect(persistMachineSalesListings).not.toHaveBeenCalled();
  });

  it("rejects unauthorized image upload and delete", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const imageRes = await imagePost({
      request: jsonRequest("https://knititnow.com/api/admin/machine-sales-image", {
        filename: "a.jpg",
        mimeType: "image/jpeg",
        dataBase64: "abc",
      }),
      cookies,
    } as never);
    const deleteRes = await savePost({
      request: jsonRequest("https://knititnow.com/api/admin/machine-sales", {
        mode: "delete",
        id: "taitexma-th160",
      }),
      cookies,
    } as never);
    expect(imageRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
    expect(persistMachineSalesImage).not.toHaveBeenCalled();
    expect(persistMachineSalesListings).not.toHaveBeenCalled();
  });

  it("accepts an authorized admin save to the production persist path", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: "admin@knititnow.com" },
      mode: "verified",
    });
    const current = readMachineSalesListings()[0];
    if (!current) throw new Error("expected a seeded listing");
    const response = await savePost({
      request: jsonRequest("https://knititnow.com/api/admin/machine-sales", {
        mode: "edit",
        listing: current,
      }),
      cookies,
    } as never);
    const data = (await response.json()) as { ok?: boolean; branch?: string };
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.branch).toBe("main");
    expect(persistMachineSalesListings).toHaveBeenCalledTimes(1);
    expect(persistMachineSalesListings.mock.calls[0]?.[1]).toMatchObject({
      hostname: "knititnow.com",
    });
  });
});
