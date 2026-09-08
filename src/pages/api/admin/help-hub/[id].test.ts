import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadHelpHubTipsForAdmin = vi.hoisted(() => vi.fn());
const saveExistingHelpHubTip = vi.hoisted(() => vi.fn());
const removeHelpHubTip = vi.hoisted(() => vi.fn());
const loadHelpHubTipById = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return {
    ...actual,
    requireAdminForRequest,
  };
});

vi.mock("../../../../lib/helpHub/loadTips", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/helpHub/loadTips")>();
  return {
    ...actual,
    loadHelpHubTipsForAdmin,
    saveExistingHelpHubTip,
    removeHelpHubTip,
    loadHelpHubTipById,
  };
});

import { DELETE, PUT } from "./[id]";

const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Help Hub admin item API", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    loadHelpHubTipsForAdmin.mockReset();
    saveExistingHelpHubTip.mockReset();
    removeHelpHubTip.mockReset();
    loadHelpHubTipById.mockReset();
  });

  it("rejects unauthorized PUT", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await PUT({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "PUT", {
        title: "T",
        slug: "patterns-for-lk150",
        category: "pattern-design-confusion",
        status: "published",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(saveExistingHelpHubTip).not.toHaveBeenCalled();
  });

  it("publishes and unpublishes for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const existing = {
      id: 1008,
      slug: "patterns-for-lk150",
      status: "draft",
      title: "Where can I find patterns for my LK150?",
      category: "pattern-design-confusion",
      relatedLessons: [259, 368],
    };
    loadHelpHubTipsForAdmin.mockResolvedValue([existing]);
    loadHelpHubTipById.mockResolvedValue(existing);
    saveExistingHelpHubTip.mockImplementation(async (_id, _body, required) => ({
      ...existing,
      status: required.status,
    }));

    const published = await PUT({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "PUT", {
        ...existing,
        status: "published",
      }),
      cookies,
    } as never);
    expect(published.status).toBe(200);
    expect((await published.json()).tip.status).toBe("published");

    const unpublished = await PUT({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "PUT", {
        ...existing,
        status: "draft",
      }),
      cookies,
    } as never);
    expect((await unpublished.json()).tip.status).toBe("draft");
  });

  it("soft-deletes for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    removeHelpHubTip.mockResolvedValue(true);
    loadHelpHubTipsForAdmin.mockResolvedValue([]);
    const response = await DELETE({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "DELETE"),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(removeHelpHubTip).toHaveBeenCalledWith(1008, {
      id: "mem_sue",
      email: "sue@knititnow.com",
    });
  });

  it("rejects unauthorized DELETE", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await DELETE({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "DELETE"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(removeHelpHubTip).not.toHaveBeenCalled();
  });

  it("rejects a duplicate slug on update", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    loadHelpHubTipsForAdmin.mockResolvedValue([
      {
        id: 1008,
        slug: "patterns-for-lk150",
        status: "draft",
        title: "Where can I find patterns for my LK150?",
        category: "pattern-design-confusion",
      },
      {
        id: 1001,
        slug: "cut-and-sew-shaping",
        status: "published",
        title: "Cut and Sew",
        category: "getting-started",
      },
    ]);
    const response = await PUT({
      params: { id: "1008" },
      request: jsonRequest("https://knititnow.com/api/admin/help-hub/1008", "PUT", {
        title: "Where can I find patterns for my LK150?",
        slug: "cut-and-sew-shaping",
        category: "pattern-design-confusion",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(saveExistingHelpHubTip).not.toHaveBeenCalled();
  });
});
