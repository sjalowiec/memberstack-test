import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");

  // If no returnTo, go home
  if (!returnTo) {
    return Response.redirect("https://member-test.netlify.app/");
  }

  // Redirect back to Talkyard test page for now
  return Response.redirect(
    `https://knititnow.talkyard.net${returnTo}`
  );
};