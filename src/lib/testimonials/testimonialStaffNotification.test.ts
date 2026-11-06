import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESTABLISHED_STAFF_NOTIFICATION_RECIPIENT, readStaffNotificationRecipient } from "../email/staffNotificationRecipient";
import {
  CLAIM_TESTIMONIAL_NOTIFICATION_SQL,
  buildTestimonialStaffNotification,
  deliverNewTestimonialStaffNotification,
} from "./testimonialStaffNotification";

describe("testimonial staff notification", () => {
  it("uses the contact form recipient unless an override is configured", () => {
    const previous = process.env.STAFF_NOTIFICATION_EMAIL;
    delete process.env.STAFF_NOTIFICATION_EMAIL;
    expect(readStaffNotificationRecipient()).toBe(ESTABLISHED_STAFF_NOTIFICATION_RECIPIENT);
    expect(readFileSync("netlify/functions/contact.js", "utf8")).toContain(
      `const to = "${ESTABLISHED_STAFF_NOTIFICATION_RECIPIENT}"`,
    );
    process.env.STAFF_NOTIFICATION_EMAIL = "sandbox@example.com";
    expect(readStaffNotificationRecipient()).toBe("sandbox@example.com");
    if (previous == null) delete process.env.STAFF_NOTIFICATION_EMAIL;
    else process.env.STAFF_NOTIFICATION_EMAIL = previous;
  });

  it("escapes the quote and links the admin submission", () => {
    const message = buildTestimonialStaffNotification({
      attribution: "Ada <b>",
      quote: `<script>alert("hi")</script>`,
      adminUrl: "https://kin-dev.netlify.app/admin/testimonials?id=row-1",
    });
    expect(message.subject).toBe("New testimonial submission");
    expect(message.html).toContain("Ada &lt;b&gt;");
    expect(message.html).toContain("&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain('href="https://kin-dev.netlify.app/admin/testimonials?id=row-1"');
    expect(message.text).toContain("Ada <b>");
    expect(message.html).not.toMatch(/memberstack|@example\.com/i);
  });

  it("sends one staff email and records success", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (sql.includes("staff_notification_claimed_at = NOW()")) {
        return [{ id: "row-1", original_attribution: "Ada", original_quote: "A long enough note." }];
      }
      return [];
    };
    let posted: { to?: string; html?: string; subject?: string } | null = null;
    const result = await deliverNewTestimonialStaffNotification(
      { id: "row-1", origin: "https://kin-dev.netlify.app" },
      {
        query,
        recipient: "sue@knititnow.com",
        config: { apiKey: "test-key", fromAddress: "Knit It Now <hello@knititnow.com>" },
        fetchImpl: async (_url, init) => {
          posted = JSON.parse(String(init?.body));
          return new Response("{}", { status: 200 });
        },
      },
    );
    expect(result).toEqual({ ok: true, skipped: false });
    expect(posted?.to).toBe("sue@knititnow.com");
    expect(posted?.subject).toBe("New testimonial submission");
    expect(posted?.html).toContain("/admin/testimonials?id=row-1");
    expect(calls[0]?.sql).toBe(CLAIM_TESTIMONIAL_NOTIFICATION_SQL);
    expect(calls[0]?.sql).toContain("source = 'member_submission'");
    expect(calls[0]?.sql).toContain("staff_notified_at IS NULL");
    expect(calls[1]?.sql).toContain("staff_notified_at = NOW()");
  });

  it("keeps the row and records a failure without a second send while one is claimed", async () => {
    const query = async (sql: string) => {
      if (sql.includes("staff_notification_claimed_at = NOW()")) {
        return [{ id: "row-1", original_attribution: "Ada", original_quote: "A long enough note." }];
      }
      return [];
    };
    const failed = await deliverNewTestimonialStaffNotification(
      { id: "row-1", origin: "https://kin-dev.netlify.app" },
      {
        query,
        recipient: "sue@knititnow.com",
        config: { apiKey: "test-key", fromAddress: "Knit It Now <hello@knititnow.com>" },
        fetchImpl: async () => new Response("nope", { status: 500 }),
      },
    );
    expect(failed).toEqual({ ok: false, reason: "resend" });

    const skipped = await deliverNewTestimonialStaffNotification(
      { id: "row-9", origin: "https://kin-dev.netlify.app" },
      {
        query: async () => [],
        recipient: "sue@knititnow.com",
        config: { apiKey: "test-key", fromAddress: "Knit It Now <hello@knititnow.com>" },
        fetchImpl: async () => {
          throw new Error("should not send");
        },
      },
    );
    expect(skipped).toEqual({ ok: true, skipped: true });
  });

  it("records a missing recipient and does not send", async () => {
    let sent = false;
    const errors: unknown[] = [];
    const result = await deliverNewTestimonialStaffNotification(
      { id: "row-1", origin: "https://kin-dev.netlify.app" },
      {
        recipient: null,
        query: async (sql: string, params?: unknown[]) => {
          if (sql.includes("staff_notification_error")) errors.push(params?.[1]);
          if (sql.includes("staff_notification_claimed_at = NOW()")) {
            return [{ id: "row-1", original_attribution: "Ada", original_quote: "A long enough note." }];
          }
          return [];
        },
        config: { apiKey: "test-key", fromAddress: "Knit It Now <hello@knititnow.com>" },
        fetchImpl: async () => {
          sent = true;
          return new Response("{}", { status: 200 });
        },
      },
    );
    expect(result).toEqual({ ok: false, reason: "recipient" });
    expect(sent).toBe(false);
    expect(errors).toContain("Staff notification recipient is not configured");
  });
});
