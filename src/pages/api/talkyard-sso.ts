import type { APIRoute } from "astro";

const TALKYARD_SECRET = process.env.TALKYARD_API_SECRET!;
const TALKYARD_BASE = "https://knititnow.talkyard.net";

export const GET: APIRoute = async ({ request }) => {
  const member = await fetch("https://member-test.netlify.app/api/member-check", {
    headers: {
      cookie: request.headers.get("cookie") || ""
    }
  });

  if (!member.ok) {
    return Response.redirect("https://member-test.netlify.app/login", 302);
  }

  const memberData = await member.json();

  const res = await fetch(
    `${TALKYARD_BASE}/-/v0/sso-upsert-user-generate-login-secret`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Secret": TALKYARD_SECRET
      },
      body: JSON.stringify({
        externalId: memberData.id,
        email: memberData.email,
        fullName: memberData.email
      })
    }
  );

  const data = await res.json();

  return Response.redirect(
    `${TALKYARD_BASE}/-/v0/login-with-secret?oneTimeSecret=${data.oneTimeSecret}`,
    302
  );
};