import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const thenGoTo = url.searchParams.get("thenGoTo") || "/";

  // For now, just bounce back to Talkyard.
  return Response.redirect(`https://knititnow.talkyard.net${thenGoTo}`, 302);
};