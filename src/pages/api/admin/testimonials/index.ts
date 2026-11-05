import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { parseTestimonialDraft } from "../../../../lib/testimonials/testimonialDraft";
import {
  createAdminTestimonial,
  listTestimonialsForAdmin,
} from "../../../../lib/testimonials/testimonialStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  try {
    const result = await listTestimonialsForAdmin({
      q: url.searchParams.get("q") ?? "",
      status: status === "active" || status === "inactive" ? status : "all",
      limit: Number(url.searchParams.get("limit") ?? "40"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read testimonials.";
    return json({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  const parsed = parseTestimonialDraft(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  try {
    const testimonial = await createAdminTestimonial(parsed.value);
    return json({ ok: true, testimonial }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the testimonial.";
    return json({ ok: false, error: message }, 500);
  }
};
