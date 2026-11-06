import type { APIRoute } from "astro";
import { requireVerifiedMemberForRequest } from "../../../lib/admin/requireAdminRequest";
import {
  memberSubmissionAllowed,
  parseTestimonialDraft,
} from "../../../lib/testimonials/testimonialDraft";
import { deliverNewTestimonialStaffNotification } from "../../../lib/testimonials/testimonialStaffNotification";
import {
  countRecentMemberSubmissions,
  createMemberTestimonial,
} from "../../../lib/testimonials/testimonialStore";
import { verifyTurnstileToken } from "../../../../netlify/functions/lib/turnstile.js";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Enter the testimonial and a name." }, 400);
  const record = body as Record<string, unknown>;
  if (typeof record["bot-field"] === "string" && record["bot-field"].trim()) {
    return json({ ok: true });
  }
  if (record.agreement !== true) {
    return json({
      ok: false,
      error: "Agree that this testimonial may appear publicly with the name you entered.",
    }, 400);
  }

  const turnstile = await verifyTurnstileToken(
    typeof record.turnstileToken === "string" ? record.turnstileToken : "",
    clientIp(request),
  );
  if (!turnstile.ok) {
    const status = turnstile.reason === "missing_secret" ? 500 : 400;
    const error = turnstile.reason === "missing_secret"
      ? "Testimonials can't be submitted right now. Please try again later."
      : "We couldn't verify this submission. Please wait a moment and try again.";
    return json({ ok: false, error }, status);
  }

  const auth = await requireVerifiedMemberForRequest(request, cookies);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const parsed = parseTestimonialDraft(record);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  try {
    const recent = await countRecentMemberSubmissions(auth.member.id);
    if (!memberSubmissionAllowed(recent)) {
      return json({ ok: false, error: "Please wait a while before sending another testimonial." }, 429);
    }
    const saved = await createMemberTestimonial({
      memberstackMemberId: auth.member.id,
      attribution: parsed.value.attribution,
      quote: parsed.value.quote,
    });
    try {
      await deliverNewTestimonialStaffNotification({
        id: saved.id,
        origin: new URL(request.url).origin,
      });
    } catch (notifyError) {
      console.error(
        "[testimonials] Submission saved; staff notification failed",
        notifyError instanceof Error ? notifyError.message : "unknown",
      );
    }
    return json({ ok: true }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the testimonial.";
    return json({ ok: false, error: message }, 500);
  }
};
