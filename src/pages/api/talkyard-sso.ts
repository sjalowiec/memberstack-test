import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      hasSecret: !!import.meta.env.TALKYARD_API_SECRET
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};