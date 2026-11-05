import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVerifiedMemberForRequest = vi.hoisted(() => vi.fn());
const verifyTurnstileToken = vi.hoisted(() => vi.fn());
const countRecentMemberSubmissions = vi.hoisted(() => vi.fn());
const createMemberTestimonial = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/admin/requireAdminRequest")>();
  return { ...actual, requireVerifiedMemberForRequest };
});

vi.mock("../../../../netlify/functions/lib/turnstile.js", () => ({
  verifyTurnstileToken,
}));

vi.mock("../../../lib/testimonials/testimonialStore", () => ({
  countRecentMemberSubmissions,
  createMemberTestimonial,
}));

import { POST } from "./submit";

const cookies = { get: () => undefined };

function request(body: unknown) {
  return new Request("https://knititnow.test/api/testimonials/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer jwt-member" },
    body: JSON.stringify(body),
  });
}

const quote = "Machine knitting is clearer with the lessons and tools on this site.";

describe("member testimonial submission", () => {
  beforeEach(() => {
    requireVerifiedMemberForRequest.mockReset();
    verifyTurnstileToken.mockReset();
    countRecentMemberSubmissions.mockReset();
    createMemberTestimonial.mockReset();
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    countRecentMemberSubmissions.mockResolvedValue(0);
    createMemberTestimonial.mockResolvedValue({ id: "row-1", active: false });
    requireVerifiedMemberForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_verified", email: "member@example.com" },
      mode: "verified",
    });
  });

  it("stores the verified member id and starts inactive", async () => {
    const response = await POST({
      request: request({
        attribution: "Ada",
        quote,
        agreement: true,
        memberstackMemberId: "mem_from_browser",
        email: "other@example.com",
        active: true,
      }),
      cookies,
    } as never);
    expect(response.status).toBe(201);
    expect(createMemberTestimonial).toHaveBeenCalledWith({
      memberstackMemberId: "mem_verified",
      attribution: "Ada",
      quote,
    });
  });

  it("does not store a signed-out submission", async () => {
    requireVerifiedMemberForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const response = await POST({
      request: request({ attribution: "Ada", quote, agreement: true }),
      cookies,
    } as never);
    expect(response.status).toBe(401);
    expect(createMemberTestimonial).not.toHaveBeenCalled();
  });

  it("requires agreement before saving", async () => {
    const response = await POST({
      request: request({ attribution: "Ada", quote, agreement: false }),
      cookies,
    } as never);
    expect(response.status).toBe(400);
    expect(createMemberTestimonial).not.toHaveBeenCalled();
  });

  it("does not store a honeypot submission", async () => {
    const response = await POST({
      request: request({ attribution: "Ada", quote, agreement: true, "bot-field": "bot" }),
      cookies,
    } as never);
    expect(response.status).toBe(200);
    expect(createMemberTestimonial).not.toHaveBeenCalled();
    expect(requireVerifiedMemberForRequest).not.toHaveBeenCalled();
  });
});
