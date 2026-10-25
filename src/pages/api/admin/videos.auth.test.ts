import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

import { isAdminProtectedPath } from "../../../lib/admin/adminPageGate";
import { GET, POST } from "./videos";
import { POST as saveAccessLevels } from "./videos/access-levels";
import { POST as saveVideo } from "./videos/save";
import { GET as videoStatus } from "./videos/status";
import { GET as vimeoThumbnail } from "./videos/vimeo-thumbnail";

const here = dirname(fileURLToPath(import.meta.url));
const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("video admin authorization", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
  });

  it("keeps the admin pages, preview, and APIs behind the existing admin allowlist gate", () => {
    for (const path of [
      "/admin/videos-admin",
      "/admin/videos-edit",
      "/admin/videos-preview/5003",
      "/api/admin/videos",
      "/api/admin/videos/save",
      "/api/admin/videos/status",
    ]) {
      expect(isAdminProtectedPath(path)).toBe(true);
    }
    const editPage = readFileSync(join(here, "..", "..", "admin", "videos-edit.astro"), "utf8");
    // GitHub credentials stay on the server.
    expect(editPage).not.toContain("GITHUB_TOKEN");
    expect(editPage).not.toContain("videoCatalogGithub");
  });

  it("rejects an unsigned catalog read and does not return videos", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await GET({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos", "GET"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.videos).toBeUndefined();
  });

  it("rejects unsigned catalog writes", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const save = await POST({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos", "POST", []),
      cookies,
    } as never);
    const access = await saveAccessLevels({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos/access-levels", "POST", {
        updates: [],
      }),
      cookies,
    } as never);
    const thumbnail = await vimeoThumbnail({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos/vimeo-thumbnail?vimeo_id=151859846", "GET"),
      cookies,
      url: new URL("https://kin-dev.netlify.app/api/admin/videos/vimeo-thumbnail?vimeo_id=151859846"),
    } as never);
    const record = await saveVideo({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos/save", "POST", {
        action: "create",
        status: "draft",
        video: { title: "x" },
      }),
      cookies,
    } as never);
    const status = await videoStatus({
      request: jsonRequest("https://kin-dev.netlify.app/api/admin/videos/status?content_id=5003", "GET"),
      cookies,
      url: new URL("https://kin-dev.netlify.app/api/admin/videos/status?content_id=5003"),
    } as never);
    expect(save.status).toBe(401);
    expect(access.status).toBe(401);
    expect(thumbnail.status).toBe(401);
    expect(record.status).toBe(401);
    expect(status.status).toBe(401);
    expect((await save.json()).videos).toBeUndefined();
  });
});
