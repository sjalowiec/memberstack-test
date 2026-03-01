import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const returnTo = new URL(request.url).searchParams.get("returnTo") || "/";

  return new Response(null, {
    status: 302,
    headers: {
      Location: returnTo
    }
  });
};