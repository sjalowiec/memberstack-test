import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadHelpHubCategoriesForAdmin = vi.hoisted(() => vi.fn());
const createManagedHelpHubCategory = vi.hoisted(() => vi.fn());
const renameManagedHelpHubCategory = vi.hoisted(() => vi.fn());
const deleteManagedHelpHubCategory = vi.hoisted(() => vi.fn());
const reorderManagedHelpHubCategories = vi.hoisted(() => vi.fn());
const retireManagedHelpHubCategory = vi.hoisted(() => vi.fn());

vi.mock("../../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../../../lib/helpHub/loadCategories", () => ({
  loadHelpHubCategoriesForAdmin,
  createManagedHelpHubCategory,
  renameManagedHelpHubCategory,
  deleteManagedHelpHubCategory,
  reorderManagedHelpHubCategories,
  retireManagedHelpHubCategory,
}));

import { GET, POST } from "./index";
import { DELETE, PUT } from "./[id]";
import { PUT as reorder } from "./reorder";
import { POST as retire } from "./[id]/retire";

const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Help Hub category admin API auth", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    loadHelpHubCategoriesForAdmin.mockReset();
    createManagedHelpHubCategory.mockReset();
    renameManagedHelpHubCategory.mockReset();
    deleteManagedHelpHubCategory.mockReset();
    reorderManagedHelpHubCategories.mockReset();
    retireManagedHelpHubCategory.mockReset();
  });

  it("rejects unauthorized category GET and does not return catalog data", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await GET({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories", "GET"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(loadHelpHubCategoriesForAdmin).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.categories).toBeUndefined();
    expect(body.ok).toBe(false);
  });

  it("rejects unauthorized category mutations", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const post = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories", "POST", {
        label: "Ribber",
      }),
      cookies,
    } as never);
    const del = await DELETE({
      params: { id: "3" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories/3", "DELETE"),
      cookies,
    } as never);
    const retireRes = await retire({
      params: { id: "2" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories/2/retire", "POST", {
        confirm: true,
        replacementKey: "machine-not-working",
      }),
      cookies,
    } as never);
    expect(post.status).toBe(403);
    expect(del.status).toBe(403);
    expect(retireRes.status).toBe(403);
    expect(createManagedHelpHubCategory).not.toHaveBeenCalled();
    expect(deleteManagedHelpHubCategory).not.toHaveBeenCalled();
    expect(retireManagedHelpHubCategory).not.toHaveBeenCalled();
  });

  it("creates a category for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const created = { id: 10, key: "ribber", label: "Ribber", sortOrder: 100, retiredAt: null };
    createManagedHelpHubCategory.mockResolvedValue({ categories: [created], created });
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories", "POST", {
        label: "Ribber",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.category.key).toBe("ribber");
    expect(createManagedHelpHubCategory).toHaveBeenCalledWith("Ribber", {
      id: "mem_sue",
      email: "sue@knititnow.com",
    });
  });

  it("renames and reorders for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    renameManagedHelpHubCategory.mockResolvedValue([]);
    reorderManagedHelpHubCategories.mockResolvedValue([]);
    const renamed = await PUT({
      params: { id: "8" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories/8", "PUT", {
        label: "Swatches",
      }),
      cookies,
    } as never);
    const reordered = await reorder({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/categories/reorder", "PUT", {
        ids: [1, 8, 7],
      }),
      cookies,
    } as never);
    expect(renamed.status).toBe(200);
    expect(reordered.status).toBe(200);
    expect(renameManagedHelpHubCategory).toHaveBeenCalledWith(8, "Swatches", expect.any(Object));
    expect(reorderManagedHelpHubCategories).toHaveBeenCalledWith([1, 8, 7], expect.any(Object));
  });
});
