import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const listTestimonialsForAdmin = vi.hoisted(() => vi.fn());
const createAdminTestimonial = vi.hoisted(() => vi.fn());
const setTestimonialActive = vi.hoisted(() => vi.fn());
const updateTestimonialDisplay = vi.hoisted(() => vi.fn());
const getTestimonialForAdmin = vi.hoisted(() => vi.fn());
const deleteTestimonial = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("../../../../lib/testimonials/testimonialStore", () => ({
  listTestimonialsForAdmin,
  createAdminTestimonial,
  setTestimonialActive,
  updateTestimonialDisplay,
  deleteTestimonial,
  getTestimonialForAdmin,
}));

import { GET, POST } from "./index";
import { PATCH, DELETE } from "./[id]";

const cookies = { get: () => undefined };

describe("testimonial admin API", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    listTestimonialsForAdmin.mockReset();
    createAdminTestimonial.mockReset();
    setTestimonialActive.mockReset();
    updateTestimonialDisplay.mockReset();
    deleteTestimonial.mockReset();
    getTestimonialForAdmin.mockReset();
  });

  it("rejects a signed-out reader before loading testimonials", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await GET({
      request: new Request("https://knititnow.test/api/admin/testimonials"),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(listTestimonialsForAdmin).not.toHaveBeenCalled();
  });

  it("passes the legacy collection filter into the admin list", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    listTestimonialsForAdmin.mockResolvedValue({ rows: [], total: 0 });
    const response = await GET({
      request: new Request(
        "https://knititnow.test/api/admin/testimonials?q=ada&status=inactive&sort=active&includeUnpublished=1&offset=40",
      ),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(listTestimonialsForAdmin).toHaveBeenCalledWith({
      q: "ada",
      status: "inactive",
      sort: "active",
      includeUnpublishedLegacy: true,
      limit: 40,
      offset: 40,
    });
  });

  it("rejects a non-admin activation", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "This account does not have admin access.",
    });
    const response = await PATCH({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(403);
    expect(setTestimonialActive).not.toHaveBeenCalled();
  });

  it("saves an email testimonial as inactive", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: "admin@example.com" },
      mode: "verified",
    });
    createAdminTestimonial.mockResolvedValue({ id: "row-2", active: false });
    const response = await POST({
      request: new Request("https://knititnow.test/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attribution: "Pat",
          quote: "I sent this note by email after finishing a sweater.",
          active: true,
        }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(201);
    expect(createAdminTestimonial).toHaveBeenCalledWith({
      attribution: "Pat",
      quote: "I sent this note by email after finishing a sweater.",
      reviewDate: null,
      rating: null,
    });
  });

  it("refuses a status-only change that would ignore unsaved editor text", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    const response = await PATCH({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(setTestimonialActive).not.toHaveBeenCalled();
    expect(updateTestimonialDisplay).not.toHaveBeenCalled();
  });

  it("saves the highlight and activation together", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    getTestimonialForAdmin.mockResolvedValue({
      id: "row-1",
      displayQuote: null,
      displayHighlightStart: null,
      displayHighlightEnd: null,
    });
    updateTestimonialDisplay.mockResolvedValue({ id: "row-1", active: true });
    const response = await PATCH({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayQuote: "I love the lessons.",
          displayAttribution: "Ada",
          highlight: { start: 2, end: 6 },
          active: true,
        }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(updateTestimonialDisplay).toHaveBeenCalledWith("row-1", {
      displayQuote: "I love the lessons.",
      displayAttribution: "Ada",
      highlight: { start: 2, end: 6 },
      active: true,
    });
    expect(setTestimonialActive).not.toHaveBeenCalled();
  });

  it("does not activate when the highlight no longer matches", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    getTestimonialForAdmin.mockResolvedValue({
      id: "row-1",
      displayQuote: "I love the lessons.",
      displayHighlightStart: 2,
      displayHighlightEnd: 6,
    });
    const response = await PATCH({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayQuote: "I lost the lessons.",
          displayAttribution: "Ada",
          highlight: { start: 2, end: 6 },
          active: true,
        }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(updateTestimonialDisplay).not.toHaveBeenCalled();
    expect(setTestimonialActive).not.toHaveBeenCalled();
  });

  it("rejects a non-admin delete before removing a testimonial", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "This account does not have admin access.",
    });
    const response = await DELETE({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", { method: "DELETE" }),
      cookies,
    } as never);
    expect(response.status).toBe(403);
    expect(deleteTestimonial).not.toHaveBeenCalled();
  });

  it("deletes one testimonial for an admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    deleteTestimonial.mockResolvedValue({ legacyRatingId: 572 });
    const response = await DELETE({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", { method: "DELETE" }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(deleteTestimonial).toHaveBeenCalledWith("row-1");
  });

  it("refuses a stale highlight instead of emphasizing different words", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_admin", email: null },
      mode: "verified",
    });
    getTestimonialForAdmin.mockResolvedValue({
      id: "row-1",
      displayQuote: "I love the lessons.",
      displayHighlightStart: 2,
      displayHighlightEnd: 6,
    });
    const response = await PATCH({
      params: { id: "row-1" },
      request: new Request("https://knititnow.test/api/admin/testimonials/row-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayQuote: "I lost the lessons.",
          displayAttribution: "Ada",
          highlight: { start: 2, end: 6 },
        }),
      }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(updateTestimonialDisplay).not.toHaveBeenCalled();
  });
});
