import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const contentId = url.searchParams.get("content_id");
  if (contentId == null || contentId === "") {
    return new Response(
      JSON.stringify({ error: "content_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  // DB lookup not wired yet — return 501 placeholder
  return new Response(
    JSON.stringify({
      embedUrl: null,
      message: "DB lookup not wired yet",
    }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
};
