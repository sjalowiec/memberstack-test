import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadHelpHubTipsForAdmin = vi.hoisted(() => vi.fn());
const saveNewHelpHubTip = vi.hoisted(() => vi.fn());
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
    saveNewHelpHubTip,
    saveExistingHelpHubTip,
    removeHelpHubTip,
    loadHelpHubTipById,
  };
});

import { GET, POST } from "./index";

const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Help Hub admin collection API auth", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    loadHelpHubTipsForAdmin.mockReset();
    saveNewHelpHubTip.mockReset();
    loadHelpHubTipsForAdmin.mockResolvedValue([]);
  });

  it("rejects unauthorized GET", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await GET({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub", "GET"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(loadHelpHubTipsForAdmin).not.toHaveBeenCalled();
  });

  it("rejects signed-in non-admin POST", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub", "POST", {
        title: "T",
        slug: "t",
        category: "getting-started",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(403);
    expect(saveNewHelpHubTip).not.toHaveBeenCalled();
  });

  it("creates a draft for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const tip = {
      id: 1011,
      slug: "new-tip",
      status: "draft",
      title: "New",
        category: "getting-started",
    };
    saveNewHelpHubTip.mockResolvedValue(tip);
    loadHelpHubTipsForAdmin.mockResolvedValueOnce([]).mockResolvedValue([tip]);
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub", "POST", {
        title: "New",
        slug: "new-tip",
        category: "getting-started",
        status: "draft",
        question: "New?",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.tip.status).toBe("draft");
    expect(saveNewHelpHubTip).toHaveBeenCalled();
  });

  it("ignores a client-supplied id and creates with a server id", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const tip = {
      id: 1011,
      slug: "server-id",
      status: "draft",
      title: "New",
        category: "getting-started",
    };
    saveNewHelpHubTip.mockResolvedValue(tip);
    loadHelpHubTipsForAdmin.mockResolvedValueOnce([]).mockResolvedValue([tip]);
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub", "POST", {
        id: 1,
        title: "New",
        slug: "server-id",
        category: "getting-started",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    const bodyArg = saveNewHelpHubTip.mock.calls[0][0] as Record<string, unknown>;
    expect(bodyArg.id).toBeUndefined();
  });

  it("rejects a duplicate slug", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    loadHelpHubTipsForAdmin.mockResolvedValue([
      { id: 1001, slug: "cut-and-sew-shaping", status: "published" },
    ]);
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/help-hub", "POST", {
        title: "Dup",
        slug: "Cut-and-Sew-Shaping",
        category: "getting-started",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(saveNewHelpHubTip).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toMatch(/already in use/i);
  });
});
