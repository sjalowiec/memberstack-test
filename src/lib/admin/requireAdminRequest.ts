type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export type AdminAuthDiagnostics = {
  env: {
    ADMIN_MEMBER_IDS: boolean;
    ADMIN_MEMBER_EMAILS: boolean;
    MEMBERSTACK_SECRET_KEY: boolean;
    MEMBERSTACK_SANDBOX_SECRET_KEY: boolean;
  };
  claimKeys: string[];
  subjectExists: boolean;
  emailExists: boolean;
  allowlist: { idMatched: boolean; emailMatched: boolean };
};

export type RequireAdminResult =
  | { ok: true; member: { id: string; email: string | null }; mode: "verified" | "dev" }
  | { ok: false; status: number; error: string; diagnostics?: AdminAuthDiagnostics };

/**
 * Astro SSR inlines only literal `import.meta.env.*` at build time. Help Hub APIs run
 * in that runtime, so allowlists must be read here — `process.env.ADMIN_MEMBER_*` inside
 * the bundled Netlify function lib is not enough on kin-dev.
 */
export function astroServerAdminEnv(): NodeJS.ProcessEnv {
  const fromAstro: Record<string, unknown> = {
    ADMIN_MEMBER_IDS: import.meta.env.ADMIN_MEMBER_IDS,
    ADMIN_MEMBER_EMAILS: import.meta.env.ADMIN_MEMBER_EMAILS,
    MEMBERSTACK_SECRET_KEY: import.meta.env.MEMBERSTACK_SECRET_KEY,
    MEMBERSTACK_SANDBOX_SECRET_KEY: import.meta.env.MEMBERSTACK_SANDBOX_SECRET_KEY,
  };
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(fromAstro)) {
    if (typeof value === "string" && value.trim()) env[key] = value;
  }
  return env;
}

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

  const cookieNames = [
    "memberstack",
    "memberstack_access_token",
    "_ms_cookie",
    "_ms-mid",
    "_ms_mid",
  ];
  for (const name of cookieNames) {
    const value = cookies.get(name)?.value?.trim() || "";
    if (looksLikeJwt(value)) return value;
  }
  return null;
}

function looksLikeJwt(value: string): boolean {
  return value.split(".").length === 3 && value.length > 20;
}

export function adminAuthErrorBody(auth: Extract<RequireAdminResult, { ok: false }>) {
  const body: Record<string, unknown> = { ok: false, error: auth.error };
  if (auth.diagnostics) body.diagnostics = auth.diagnostics;
  return body;
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
  return requireAdmin(authRequest, astroServerAdminEnv()) as Promise<RequireAdminResult>;
}

export async function requireVerifiedMemberForRequest(
  request: Request,
  cookies?: CookieStore,
): Promise<RequireAdminResult> {
  const token = memberstackTokenFromRequest(request, cookies);
  const authRequest = requestWithBearerToken(request, token);
  const { requireVerifiedMember } = await import("../../../netlify/functions/lib/admin-auth.js");
  return requireVerifiedMember(authRequest, astroServerAdminEnv()) as Promise<RequireAdminResult>;
}
