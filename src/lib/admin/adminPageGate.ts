import { adminAuthErrorBody, type RequireAdminResult } from "./requireAdminRequest";

/**
 * Paths that used to depend on the Netlify Basic-Auth header, plus the admin
 * APIs those pages call. Public site routes are not included.
 */
export function isAdminProtectedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

/**
 * Server response for a failed admin check. `null` means the request may continue.
 * Page responses stay plain text so a denied visitor does not receive admin HTML.
 */
export function adminGateResponse(
  auth: RequireAdminResult,
  pathname: string,
): Response | null {
  if (auth.ok) return null;

  const status =
    auth.status === 401 || auth.status === 403 || auth.status === 500 ? auth.status : 401;
  const headers = { "Cache-Control": "no-store" };

  if (isAdminApiPath(pathname)) {
    return new Response(JSON.stringify(adminAuthErrorBody({ ...auth, status })), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const message =
    status === 403
      ? "Admin access required."
      : status === 500
        ? "Admin access is unavailable."
        : "Sign in required.";
  return new Response(message, {
    status,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}
