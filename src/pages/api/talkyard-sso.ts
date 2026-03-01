import type { APIRoute } from "astro";

const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const thenGoTo = url.searchParams.get("thenGoTo") || "/-/sso-test";

  // TODO in a later step: replace this with real Memberstack member info
  const externalId = "mem_test_user";
  const email = "test@example.com";
  const fullName = "Test User";

  const secret = (import.meta.env.TALKYARD_API_SECRET || "").trim();
  const auth = Buffer.from(`tyid=2:${secret}`).toString("base64");

  const upsertRes = await fetch(
    `${TALKYARD_BASE}/-/v0/sso-upsert-user-generate-login-secret`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        externalUserId: externalId,
        primaryEmailAddress: email,
        isEmailAddressVerified: true,
        fullName
      })
    }
  );

  const upsertText = await upsertRes.text();
  if (!upsertRes.ok) {
    return new Response(
      `Talkyard upsert failed: ${upsertRes.status}\n${upsertText}`,
      { status: 500 }
    );
  }

  return new Response(upsertText, {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

  return Response.redirect(
    `${TALKYARD_BASE}/-/v0/login-with-secret?oneTimeSecret=${encodeURIComponent(
      oneTimeSecret
    )}&thenGoTo=${encodeURIComponent(thenGoTo)}`,
    302
  );
};