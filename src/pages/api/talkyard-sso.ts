import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  // Talkyard sends one of these (we’ll handle either)
  const path =
    url.searchParams.get("thenGoTo") ||
    url.searchParams.get("returnTo") ||
    "/-/sso-test";

  return Response.redirect(`https://knititnow.talkyard.net${path}`, 302);
};