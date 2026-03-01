import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

function talkyardAuthHeader(secret: string) {
  return (
    "Basic " + Buffer.from(`tyid=2:${secret}`).toString("base64")
  );
}

async function upsertAndGetLoginSecret(args: {
  talkyardSecret: string;
  externalUserId: string;
  email: string;
  fullName: string;
}) {
  const upstream = await fetch(
    `${TALKYARD_BASE}/-/v0/sso-upsert-user-generate-login-secret`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: talkyardAuthHeader(args.talkyardSecret),
      },
      body: JSON.stringify({
        ssoId: args.externalUserId,
        primaryEmailAddress: args.email,
        isEmailAddressVerified: true,
        fullName: args.fullName,
      }),
    }
  );

  const raw = await upstream.text();
  if (!upstream.ok) {
    return { ok: false as const, status: upstream.status, raw };
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false as const, status: 502, raw: "Talkyard returned non-JSON" };
  }

  const loginSecret = data.loginSecret ?? data.ssoLoginSecret;
  if (!loginSecret) {
    return { ok: false as const, status: 502, raw: "No login secret returned" };
  }

  return { ok: true as const, loginSecret };
}

function redirectToTalkyard(loginSecret: string, thenGoTo: string) {
  const redirectUrl =
    `${TALKYARD_BASE}/-/v0/login-with-secret` +
    `?oneTimeSecret=${encodeURIComponent(loginSecret)}` +
    `&thenGoTo=${encodeURIComponent(thenGoTo || "/")}`;

  return new Response(null, {
    status: 302,
    headers: { location: redirectUrl },
  });
}

// ✅ GET stays as your working "test user" endpoint (so you can always confirm SSO works)
export const GET: APIRoute = async ({ request }) => {
  const TALKYARD_API_SECRET = import.meta.env.TALKYARD_API_SECRET;
  if (!TALKYARD_API_SECRET) {
    return new Response("Missing TALKYARD_API_SECRET", { status: 500 });
  }

  const url = new URL(request.url);
  const thenGoTo = url.searchParams.get("thenGoTo") ?? "/";

  // Temporary clean test user
  const externalUserId = "mem_test_user_2";
  const email = "test2@example.com";
  const fullName = "Test User 2";

  const result = await upsertAndGetLoginSecret({
    talkyardSecret: TALKYARD_API_SECRET,
    externalUserId,
    email,
    fullName,
  });

  if (!result.ok) return new Response(result.raw, { status: result.status });

  return redirectToTalkyard(result.loginSecret, thenGoTo);
};

// ✅ POST is the real production path: the browser sends the logged-in Memberstack user
export const POST: APIRoute = async ({ request }) => {
  const TALKYARD_API_SECRET = import.meta.env.TALKYARD_API_SECRET;
  if (!TALKYARD_API_SECRET) {
    return new Response("Missing TALKYARD_API_SECRET", { status: 500 });
  }

  const url = new URL(request.url);
  const thenGoTo = url.searchParams.get("thenGoTo") ?? "/";

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Expected JSON body", { status: 400 });
  }

  const externalUserId = String(body.externalUserId || "");
  const email = String(body.email || "");
  const fullName = String(body.fullName || "");

  if (!externalUserId || !email || !fullName) {
    return new Response(
      "Missing externalUserId/email/fullName",
      { status: 400 }
    );
  }

  const result = await upsertAndGetLoginSecret({
    talkyardSecret: TALKYARD_API_SECRET,
    externalUserId,
    email,
    fullName,
  });

  if (!result.ok) return new Response(result.raw, { status: result.status });

  return redirectToTalkyard(result.loginSecret, thenGoTo);
};