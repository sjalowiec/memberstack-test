import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: "This endpoint has been replaced. Use /api/jumplinks/{content_id}.json",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    }
  );
};
