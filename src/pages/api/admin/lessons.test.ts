import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadLessonsForAdmin = vi.hoisted(() => vi.fn());
const saveNewLesson = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/admin/requireAdminRequest")>();
  return {
    ...actual,
    requireAdminForRequest,
  };
});

vi.mock("../../../lib/lessons/loadLessons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/lessons/loadLessons")>();
  return {
    ...actual,
    loadLessonsForAdmin,
    saveNewLesson,
  };
});

import { GET, POST } from "./lessons";

const cookies = { get: () => undefined };

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Lesson admin collection API auth", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    loadLessonsForAdmin.mockReset();
    saveNewLesson.mockReset();
    loadLessonsForAdmin.mockResolvedValue([]);
  });

  it("rejects unauthorized GET", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await GET({
      request: jsonRequest("https://knititnow.com/api/admin/lessons", "GET"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(loadLessonsForAdmin).not.toHaveBeenCalled();
  });

  it("rejects signed-in non-admin POST", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/lessons", "POST", {
        title: "T",
        slug: "t",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(403);
    expect(saveNewLesson).not.toHaveBeenCalled();
  });

  it("creates a draft for an admin and ignores a client-supplied id", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const lesson = {
      id: 5004,
      slug: "new-member-lesson",
      status: "draft",
      title: "New Member Lesson",
    };
    saveNewLesson.mockResolvedValue(lesson);
    loadLessonsForAdmin.mockResolvedValueOnce([]).mockResolvedValue([lesson]);
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/lessons", "POST", {
        id: 1,
        title: "New Member Lesson",
        slug: "new-member-lesson",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.lesson.status).toBe("draft");
    const bodyArg = saveNewLesson.mock.calls[0][0] as Record<string, unknown>;
    expect(bodyArg.id).toBeUndefined();
  });

  it("rejects a duplicate slug", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    loadLessonsForAdmin.mockResolvedValue([
      { id: 5002, slug: "tuck-on-the-lk150", status: "published" },
    ]);
    const response = await POST({
      request: jsonRequest("https://knititnow.com/api/admin/lessons", "POST", {
        title: "Dup",
        slug: "Tuck-on-the-lk150",
        status: "draft",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(saveNewLesson).not.toHaveBeenCalled();
  });
});
