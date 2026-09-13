import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const loadLessonsForAdmin = vi.hoisted(() => vi.fn());
const saveExistingLesson = vi.hoisted(() => vi.fn());
const removeLesson = vi.hoisted(() => vi.fn());
const loadLessonById = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return {
    ...actual,
    requireAdminForRequest,
  };
});

vi.mock("../../../../lib/lessons/loadLessons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/lessons/loadLessons")>();
  return {
    ...actual,
    loadLessonsForAdmin,
    saveExistingLesson,
    removeLesson,
    loadLessonById,
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

describe("Lesson admin item API", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    loadLessonsForAdmin.mockReset();
    saveExistingLesson.mockReset();
    removeLesson.mockReset();
    loadLessonById.mockReset();
  });

  it("rejects unauthorized PUT", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await PUT({
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "PUT", {
        title: "Tuck",
        slug: "tuck-on-the-lk150",
        status: "published",
      }),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(saveExistingLesson).not.toHaveBeenCalled();
  });

  it("publishes and unpublishes for an admin, including repeated save", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    const existing = {
      id: 5002,
      slug: "tuck-on-the-lk150",
      status: "draft",
      title: "Tuck on the LK150",
      intro: "this is the intro",
    };
    loadLessonsForAdmin.mockResolvedValue([existing]);
    loadLessonById.mockResolvedValue(existing);
    saveExistingLesson.mockImplementation(async (_id, _body, required) => ({
      ...existing,
      status: required.status,
    }));

    const published = await PUT({
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "PUT", {
        ...existing,
        status: "published",
      }),
      cookies,
    } as never);
    expect(published.status).toBe(200);
    expect((await published.json()).lesson.status).toBe("published");

    const unpublished = await PUT({
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "PUT", {
        ...existing,
        status: "draft",
      }),
      cookies,
    } as never);
    expect((await unpublished.json()).lesson.status).toBe("draft");

    const again = await PUT({
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "PUT", {
        ...existing,
        status: "draft",
        intro: "edited again",
      }),
      cookies,
    } as never);
    expect(again.status).toBe(200);
    expect(saveExistingLesson).toHaveBeenCalledTimes(3);
  });

  it("soft-deletes for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_sue", email: "sue@knititnow.com" },
      mode: "verified",
    });
    removeLesson.mockResolvedValue(true);
    loadLessonsForAdmin.mockResolvedValue([]);
    const response = await DELETE({
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "DELETE"),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(removeLesson).toHaveBeenCalledWith(5002, {
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
      params: { id: "5002" },
      request: jsonRequest("https://knititnow.com/api/admin/lessons/5002", "DELETE"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(removeLesson).not.toHaveBeenCalled();
  });
});
