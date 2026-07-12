export function isWatsonRoute(pathname: string): boolean {
  return pathname === "/watson" || pathname.startsWith("/watson/");
}

export function isWatsonApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/watson/");
}

export function watsonApiUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Sign in required." }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
