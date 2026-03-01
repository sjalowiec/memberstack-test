import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async () => {
  const secret = (import.meta.env.TALKYARD_API_SECRET || "").trim();
  const user = "tyid2"; // sysbot user, per Talkyard docs/examples

  const auth = Buffer.from(`${user}:${secret}`).toString("base64");

  const res = await fetch(`${TALKYARD_BASE}/-/v0/ping`, {
    headers: { Authorization: `Basic ${auth}` }
  });

  const text = await res.text();

  return new Response(
    JSON.stringify(
      {
        status: res.status,
        ok: res.ok,
        usingUser: user,
        secretLength: secret.length,
        secretStartsWith: secret.slice(0, 4),
        secretEndsWith: secret.slice(-4),
        talkyardResponse: text.slice(0, 200)
      },
      null,
      2
    ),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};