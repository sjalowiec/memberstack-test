import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async ({ request, locals }) => {
  const TALKYARD_API_SECRET = import.meta.env.TALKYARD_API_SECRET;
  if (!TALKYARD_API_SECRET) {
    return new Response("Missing TALKYARD_API_SECRET", { status: 500 });
  }

  const url = new URL(request.url);

  if (url.searchParams.get("debug") === "1") {
    return new Response(
      JSON.stringify({ hasMsToken: !!(locals as any).msToken }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ✅ Always safe default: land on Talkyard home after login
  const thenGoTo = url.searchParams.get("thenGoTo") ?? "/";

  // ✅ TEMP: clean test user (replace later with Memberstack user)
  const externalUserId = "mem_test_user_2";
  const primaryEmailAddress = "test2@example.com";
  const fullName = "Test User 2";

  const upstream = await fetch(
    `${TALKYARD_BASE}/-/v0/sso-upsert-user-generate-login-secret`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`tyid=2:${TALKYARD_API_SECRET}`).toString("base64"),
      },
      body: JSON.stringify({
        ssoId: externalUserId,
        primaryEmailAddress,
        isEmailAddressVerified: true,
        fullName,
      }),
    }
  );

  const raw = await upstream.text();

  if (!upstream.ok) {
    return new Response(raw, { status: upstream.status });
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response("Talkyard returned non-JSON response", { status: 502 });
  }

  const loginSecret = data.loginSecret ?? data.ssoLoginSecret;
  if (!loginSecret) {
    return new Response("No login secret returned from Talkyard", { status: 502 });
  }

  const redirectUrl =
    `${TALKYARD_BASE}/-/v0/login-with-secret` +
    `?oneTimeSecret=${encodeURIComponent(loginSecret)}` +
    `&thenGoTo=${encodeURIComponent(thenGoTo)}`;

  return new Response(null, {
    status: 302,
    headers: { location: redirectUrl },
  });
};