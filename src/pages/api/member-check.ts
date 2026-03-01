import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie") || "";

  // Just return a placeholder for now
  return new Response(
    JSON.stringify({
      id: "mem_test_user",
      email: "test@example.com"
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};