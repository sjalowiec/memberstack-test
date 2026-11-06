import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../../lib/admin/requireAdminRequest";
import { deliverNewTestimonialStaffNotification } from "../../../../../lib/testimonials/testimonialStaffNotification";
import { getTestimonialForAdmin } from "../../../../../lib/testimonials/testimonialStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const id = params.id?.trim() || "";
  if (!id) return json({ ok: false, error: "Missing testimonial." }, 400);
  try {
    const existing = await getTestimonialForAdmin(id);
    if (!existing) return json({ ok: false, error: "Testimonial not found." }, 404);
    if (existing.staffNotifiedAt) return json({ ok: true, alreadySent: true });
    const result = await deliverNewTestimonialStaffNotification({
      id,
      origin: new URL(request.url).origin,
    });
    if (result.ok && result.skipped) {
      return json(
        { ok: false, error: "A notification is already being sent. Try again in a few minutes." },
        409,
      );
    }
    if (!result.ok) {
      return json({ ok: false, error: "The submission is saved. The staff notification was not sent." }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the notification.";
    return json({ ok: false, error: message }, 500);
  }
};
