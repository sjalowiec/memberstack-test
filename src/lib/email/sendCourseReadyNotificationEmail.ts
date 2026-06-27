import { escapeHtml } from "./escapeHtml";
import {
  isDevEnvironment,
  isResendTransportError,
  readResendConfig,
  type ResendConfig,
} from "./resendConfig";

export type CourseReadyNotificationPayload = {
  courseSlug: string;
  courseTitle: string;
  customerEmail: string;
  submittedAt?: string;
};

export type SendCourseReadyNotificationResult =
  | { ok: true }
  | { ok: false; reason: "config" | "resend" };

const NOTIFICATION_RECIPIENT = "sue@knititnow.com";

export function buildCourseReadyNotificationEmail(
  payload: CourseReadyNotificationPayload,
): { subject: string; text: string; html: string } {
  const submittedAt = payload.submittedAt ?? new Date().toISOString();
  const subject = `Course Ready Notification Request: ${payload.courseTitle}`;
  const text = `Someone requested notification when this course is ready.

Course:
${payload.courseTitle}

Slug:
${payload.courseSlug}

Customer Email:
${payload.customerEmail}

Submitted:
${submittedAt}
`;

  const html = `
    <p>Someone requested notification when this course is ready.</p>
    <p><strong>Course:</strong><br />${escapeHtml(payload.courseTitle)}</p>
    <p><strong>Slug:</strong><br />${escapeHtml(payload.courseSlug)}</p>
    <p><strong>Customer Email:</strong><br />${escapeHtml(payload.customerEmail)}</p>
    <p><strong>Submitted:</strong><br />${escapeHtml(submittedAt)}</p>
  `.trim();

  return { subject, text, html };
}

type SendCourseReadyNotificationOptions = {
  fetchImpl?: typeof fetch;
  config?: ResendConfig | null;
};

export async function sendCourseReadyNotificationEmail(
  payload: CourseReadyNotificationPayload,
  options: SendCourseReadyNotificationOptions = {},
): Promise<SendCourseReadyNotificationResult> {
  const config = options.config === undefined ? readResendConfig() : options.config;
  if (!config) {
    console.error(
      "[course-ready-notification] Missing RESEND_API_KEY or from address configuration",
    );
    return { ok: false, reason: "config" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const { subject, text, html } = buildCourseReadyNotificationEmail(payload);

  console.info("[course-ready-notification] Sending email via Resend", {
    from: config.fromAddress,
    to: NOTIFICATION_RECIPIENT,
  });

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: NOTIFICATION_RECIPIENT,
        subject,
        text,
        html,
        reply_to: payload.customerEmail || undefined,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[course-ready-notification] Resend API error:", response.status, errText, {
        from: config.fromAddress,
        to: NOTIFICATION_RECIPIENT,
      });
      return { ok: false, reason: "resend" };
    }

    console.info("[course-ready-notification] Resend email accepted", {
      to: NOTIFICATION_RECIPIENT,
    });

    return { ok: true };
  } catch (error) {
    if (isDevEnvironment() && isResendTransportError(error)) {
      console.warn(
        "[course-ready-notification] DEV: Resend unreachable (TLS/network). Request accepted without sending.",
        {
          from: config.fromAddress,
          to: NOTIFICATION_RECIPIENT,
          subject,
          courseSlug: payload.courseSlug,
          courseTitle: payload.courseTitle,
          customerEmail: payload.customerEmail,
        },
      );
      return { ok: true };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[course-ready-notification] Failed to send email:", message, error);
    return { ok: false, reason: "resend" };
  }
}
