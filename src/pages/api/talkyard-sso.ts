import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async ({ request }) => {
  const TALKYARD_API_SECRET = import.meta.env.TALKYARD_API_SECRET;

  if (!TALKYARD_API_SECRET) {
    return new Response("Missing TALKYARD_API_SECRET", { status: 500 });
  }

  // Temporary clean test user
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

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status });
  }

  const data = await upstream.json();
  const loginSecret = data.loginSecret ?? data.ssoLoginSecret;

  if (!loginSecret) {
    return new Response("No login secret returned from Talkyard", {
      status: 502,
    });
  }

  const url = new URL(request.url);
  const thenGoTo = url.searchParams.get("thenGoTo") ?? "/roundtable";

  const redirectUrl =
    `${TALKYARD_BASE}/-/v0/login-with-secret` +
    `?oneTimeSecret=${encodeURIComponent(loginSecret)}` +
    `&thenGoTo=${encodeURIComponent(thenGoTo)}`;

  return new Response(null, {
    status: 302,
    headers: {
      location: redirectUrl,
    },
  });
};