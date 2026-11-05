import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { parseDisplayCorrection, HIGHLIGHT_RESELECT_MESSAGE, highlightWasInvalidated } from "../../../../lib/testimonials/testimonialDraft";
import {
  deleteTestimonial,
  getTestimonialForAdmin,
  setTestimonialActive,
  updateTestimonialDisplay,
} from "../../../../lib/testimonials/testimonialStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const id = params.id?.trim() || "";
  if (!id) return json({ ok: false, error: "Missing testimonial." }, 400);
  try {
    const testimonial = await getTestimonialForAdmin(id);
    if (!testimonial) return json({ ok: false, error: "Testimonial not found." }, 404);
    return json({ ok: true, testimonial });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the testimonial.";
    return json({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const id = params.id?.trim() || "";
  if (!id) return json({ ok: false, error: "Missing testimonial." }, 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Invalid testimonial update." }, 400);
  const record = body as Record<string, unknown>;
  try {
    if (typeof record.active === "boolean") {
      const testimonial = await setTestimonialActive(id, record.active);
      if (!testimonial) return json({ ok: false, error: "Testimonial not found." }, 404);
      return json({ ok: true, testimonial });
    }
    const display = parseDisplayCorrection(record);
    if (!display.ok) return json({ ok: false, error: display.error }, 400);
    const existing = await getTestimonialForAdmin(id);
    if (!existing) return json({ ok: false, error: "Testimonial not found." }, 404);
    if (
      highlightWasInvalidated(
        existing.displayQuote,
        existing.displayHighlightStart == null || existing.displayHighlightEnd == null
          ? null
          : { start: existing.displayHighlightStart, end: existing.displayHighlightEnd },
        display.displayQuote,
        display.highlight,
      )
    ) {
      return json({ ok: false, error: HIGHLIGHT_RESELECT_MESSAGE }, 400);
    }
    const testimonial = await updateTestimonialDisplay(id, display);
    if (!testimonial) return json({ ok: false, error: "Testimonial not found." }, 404);
    return json({ ok: true, testimonial });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the testimonial.";
    return json({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const id = params.id?.trim() || "";
  if (!id) return json({ ok: false, error: "Missing testimonial." }, 400);
  try {
    const removed = await deleteTestimonial(id);
    if (!removed) return json({ ok: false, error: "Testimonial not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the testimonial.";
    return json({ ok: false, error: message }, 500);
  }
};
