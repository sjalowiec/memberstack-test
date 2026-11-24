import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const memory = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../lib/supportVideos/customerHelpVideoStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/supportVideos/customerHelpVideoStore")>();
  return {
    ...actual,
    customerHelpBlobForRuntime: () => actual.memoryCustomerHelpBlob(memory),
  };
});

import { GET, POST } from "./support-videos";

const cookies = { get: () => undefined };
const admin = {
  ok: true as const,
  member: { id: "mem_admin", email: "sue@knititnow.com" },
  mode: "verified" as const,
};

describe("support video admin API", () => {
  beforeEach(() => {
    memory.clear();
    requireAdminForRequest.mockReset();
  });

  it("rejects a signed-out save", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await POST({
      request: new Request("https://kin-dev.netlify.app/api/admin/support-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Cast on", vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34" }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(memory.size).toBe(0);
  });

  it("saves a video and returns the customer path without the privacy code", async () => {
    requireAdminForRequest.mockResolvedValue(admin);
    const response = await POST({
      request: new Request("https://kin-dev.netlify.app/api/admin/support-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "How to load a DesignaKnit file",
          vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34",
        }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      created: true,
      video: {
        slug: "how-to-load-a-designaknit-file",
        path: "/video-help/how-to-load-a-designaknit-file/",
        unlisted: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain("Ab12cd34");

    const list = await GET({
      request: new Request("https://kin-dev.netlify.app/api/admin/support-videos"),
      cookies,
    } as never);
    const listed = await list.json();
    expect(listed.videos.map((video: { slug: string }) => video.slug)).toEqual([
      "save-designaknit-file",
      "how-to-load-a-designaknit-file",
    ]);
  });
});
