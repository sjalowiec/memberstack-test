import { describe, expect, it, vi } from "vitest";
import { handleCourseReadyNotificationRequest } from "./courseReadyNotificationHandler";
import {
  buildCourseReadyNotificationEmail,
  sendCourseReadyNotificationEmail,
} from "./sendCourseReadyNotificationEmail";

describe("buildCourseReadyNotificationEmail", () => {
  it("includes the server-side course title and customer email", () => {
    const email = buildCourseReadyNotificationEmail({
      courseSlug: "lk-150-quick-start",
      courseTitle: "LK-150 Quick Start",
      customerEmail: "customer@example.com",
      submittedAt: "2026-06-27T12:00:00.000Z",
    });

    expect(email.subject).toBe(
      "Course Ready Notification Request: LK-150 Quick Start",
    );
    expect(email.text).toContain("LK-150 Quick Start");
    expect(email.text).toContain("lk-150-quick-start");
    expect(email.text).toContain("customer@example.com");
    expect(email.text).toContain("2026-06-27T12:00:00.000Z");
  });
});

describe("sendCourseReadyNotificationEmail", () => {
  it("sends to support with reply_to set to the customer email", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.to).toBe("support@knititnow.com");
      expect(body.reply_to).toBe("customer@example.com");
      expect(body.subject).toContain("LK-150 Quick Start");
      return new Response("{}", { status: 200 });
    });

    const result = await sendCourseReadyNotificationEmail(
      {
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
        customerEmail: "customer@example.com",
        submittedAt: "2026-06-27T12:00:00.000Z",
      },
      {
        fetchImpl,
        config: { apiKey: "test-key", fromAddress: "Knit It Now <hello@knititnow.com>" },
      },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("handleCourseReadyNotificationRequest", () => {
  it("rejects invalid emails", async () => {
    const result = await handleCourseReadyNotificationRequest({
      email: "not-an-email",
      courseSlug: "lk-150-quick-start",
      courseTitle: "Ignored Client Title",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Please enter a valid email address.",
    });
  });

  it("uses the server-side course title for a known slug", async () => {
    const sendEmail = vi.fn(async (payload) => {
      expect(payload.courseTitle).toBe("LK-150 Quick Start");
      expect(payload.courseSlug).toBe("lk-150-quick-start");
      expect(payload.customerEmail).toBe("customer@example.com");
      return { ok: true as const };
    });

    const result = await handleCourseReadyNotificationRequest(
      {
        email: "customer@example.com",
        courseSlug: "lk-150-quick-start",
        courseTitle: "Ignored Client Title",
      },
      { sendEmail },
    );

    expect(result).toEqual({ ok: true, status: 200 });
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});
