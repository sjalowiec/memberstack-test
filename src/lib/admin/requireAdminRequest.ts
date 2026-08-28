type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export type RequireAdminResult =
  | { ok: true; member: { id: string; email: string | null }; mode: "verified" | "dev" }
  | { ok: false; status: number; error: string };

export function memberstackTokenFromRequest(
  request: Request,
  cookies?: CookieStore,
): string | null {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    return bearer;
  }

  if (!cookies) {
    return null;
  }

  return (
    cookies.get("memberstack")?.value ||
    cookies.get("memberstack_access_token")?.value ||
    null
  );
}

export function requestWithBearerToken(request: Request, token: string | null): Request {
  if (!token) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

export async function requireAdminForRequest(
  request: Request,
  cookies?: CookieStore,
): Promise<RequireAdminResult> {
  const token = memberstackTokenFromRequest(request, cookies);
  const authRequest = requestWithBearerToken(request, token);
  const { requireAdmin } = await import("../../../netlify/functions/lib/admin-auth.js");
  return requireAdmin(authRequest) as Promise<RequireAdminResult>;
}

export async function requireVerifiedMemberForRequest(
  request: Request,
  cookies?: CookieStore,
): Promise<RequireAdminResult> {
  const token = memberstackTokenFromRequest(request, cookies);
  const authRequest = requestWithBearerToken(request, token);
  const { requireVerifiedMember } = await import("../../../netlify/functions/lib/admin-auth.js");
  return requireVerifiedMember(authRequest) as Promise<RequireAdminResult>;
}
