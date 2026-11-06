import { escapeHtml } from "../email/escapeHtml";
import { readResendConfig, type ResendConfig } from "../email/resendConfig";
import { readStaffNotificationRecipient } from "../email/staffNotificationRecipient";
import { queryTestimonials } from "./testimonialQuery";
import type { WatsonQueryFn } from "../watson/memberSearch";

const NOTIFICATION_ERROR_MAX = 500;

export function clipNotificationError(value: string): string {
  const trimmed = value.trim() || "Staff notification email was not sent";
  return trimmed.length > NOTIFICATION_ERROR_MAX ? trimmed.slice(0, NOTIFICATION_ERROR_MAX) : trimmed;
}

export function buildTestimonialStaffNotification(input: {
  attribution: string;
  quote: string;
  adminUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "New testimonial submission";
  const text = `A member sent a testimonial.

Name:
${input.attribution}

Quote:
${input.quote}

Open in admin:
${input.adminUrl}
`;
  const html = `
    <p>A member sent a testimonial.</p>
    <p><strong>Name:</strong><br />${escapeHtml(input.attribution)}</p>
    <p><strong>Quote:</strong></p>
    <p style="white-space:pre-wrap;">${escapeHtml(input.quote)}</p>
    <p><a href="${escapeHtml(input.adminUrl)}">Open this submission in admin</a></p>
  `.trim();
  return { subject, text, html };
}

export const CLAIM_TESTIMONIAL_NOTIFICATION_SQL = `
UPDATE testimonials
SET staff_notification_claimed_at = NOW()
WHERE id = $1
  AND source = 'member_submission'
  AND staff_notified_at IS NULL
  AND (
    staff_notification_claimed_at IS NULL
    OR staff_notification_claimed_at < NOW() - INTERVAL '2 minutes'
  )
RETURNING id, original_attribution, original_quote
`.trim();

const RECORD_NOTIFICATION_SUCCESS_SQL = `
UPDATE testimonials
SET staff_notified_at = NOW(),
    staff_notification_error = NULL,
    staff_notification_claimed_at = NULL
WHERE id = $1
  AND staff_notified_at IS NULL
`.trim();

const RECORD_NOTIFICATION_FAILURE_SQL = `
UPDATE testimonials
SET staff_notification_error = $2,
    staff_notification_claimed_at = NULL
WHERE id = $1
  AND staff_notified_at IS NULL
`.trim();

type Query = WatsonQueryFn;

export type TestimonialNotificationResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "recipient" | "config" | "resend" };

type SendOptions = {
  fetchImpl?: typeof fetch;
  config?: ResendConfig | null;
  recipient?: string | null;
  query?: Query;
};

export async function deliverNewTestimonialStaffNotification(
  input: { id: string; origin: string },
  options: SendOptions = {},
): Promise<TestimonialNotificationResult> {
  const query = options.query ?? queryTestimonials;
  const id = input.id.trim();
  if (!id) return { ok: true, skipped: true };

  const claimed = await query<{ id: string; original_attribution: string; original_quote: string }>(
    CLAIM_TESTIMONIAL_NOTIFICATION_SQL,
    [id],
  );
  const row = claimed[0];
  if (!row) return { ok: true, skipped: true };

  const recipient = options.recipient === undefined ? readStaffNotificationRecipient() : options.recipient;
  if (!recipient) {
    await query(RECORD_NOTIFICATION_FAILURE_SQL, [id, "Staff notification recipient is not configured"]);
    return { ok: false, reason: "recipient" };
  }

  const config = options.config === undefined ? readResendConfig() : options.config;
  if (!config) {
    await query(RECORD_NOTIFICATION_FAILURE_SQL, [id, "Email service is not configured"]);
    return { ok: false, reason: "config" };
  }

  const origin = input.origin.replace(/\/$/, "");
  const adminUrl = `${origin}/admin/testimonials?id=${encodeURIComponent(id)}`;
  const message = buildTestimonialStaffNotification({
    attribution: String(row.original_attribution ?? ""),
    quote: String(row.original_quote ?? ""),
    adminUrl,
  });
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: recipient,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      await query(RECORD_NOTIFICATION_FAILURE_SQL, [
        id,
        clipNotificationError(`Email service returned ${response.status}`),
      ]);
      return { ok: false, reason: "resend" };
    }
    await query(RECORD_NOTIFICATION_SUCCESS_SQL, [id]);
    return { ok: true, skipped: false };
  } catch {
    await query(RECORD_NOTIFICATION_FAILURE_SQL, [id, "Staff notification email was not sent"]);
    return { ok: false, reason: "resend" };
  }
}
