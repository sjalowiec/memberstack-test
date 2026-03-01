import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async () => {
  const secret = import.meta.env.TALKYARD_API_SECRET;

  const auth = Buffer.from(`talkyardId=2:${secret}`).toString("base64");

  const res = await fetch(`${TALKYARD_BASE}/-/v0/ping`, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  return new Response(
    JSON.stringify({
      status: res.status,
      ok: res.ok
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};