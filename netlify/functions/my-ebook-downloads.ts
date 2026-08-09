/**
 * Customer My Downloads API — approved legacy ebook entitlements for the
 * verified Memberstack session email (no membership required).
 *
 * GET /.netlify/functions/my-ebook-downloads
 *
 * Auth: requireMember (Bearer JWT). Email is taken only from the verified
 * session — query/body email parameters are ignored.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { resolveLegacyEbookEntitlementsForEmail } from "../../src/lib/legacy/legacyEbookOwnership";

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  // Intentionally ignore any client-supplied email (query or body).
  const email = auth.member.email;

  try {
    const ebooks = resolveLegacyEbookEntitlementsForEmail(email);
    return withCors(
      jsonResponse({
        ok: true,
        ebooks,
        authMode: auth.mode,
      }),
    );
  } catch (err) {
    console.error("my-ebook-downloads failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Failed to load ebook downloads." }, 500),
    );
  }
};
