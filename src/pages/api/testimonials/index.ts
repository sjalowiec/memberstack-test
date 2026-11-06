import type { APIRoute } from "astro";
import {
  ensurePublicTestimonialOrderSeed,
  listPublicTestimonials,
} from "../../../lib/testimonials/testimonialStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const seed = ensurePublicTestimonialOrderSeed(cookies, url.protocol === "https:");
  try {
    const batch = await listPublicTestimonials({
      seed,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return json({ ok: true, ...batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stories could not be loaded.";
    return json({ ok: false, error: message }, 500);
  }
};
