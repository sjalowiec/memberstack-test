/**
 * Member favorites API (verified Memberstack session).
 *
 * GET    /.netlify/functions/favorites?content_type=video
 * POST   /.netlify/functions/favorites  { content_type, content_id }
 * DELETE /.netlify/functions/favorites  { content_type, content_id }
 *
 * Single REST-style function (instead of three) so list/add/remove share one auth gate
 * and CORS surface. Member id is always derived from the verified token.
 */
import { requireMember } from "./lib/member-auth.js";
import {
  addFavorite,
  getFavoritesStore,
  isFavoriteContentType,
  jsonResponse,
  listFavorites,
  normalizeFavoriteContentId,
  removeFavorite,
  withCors,
} from "./lib/member-favorites-store.js";

/**
 * @param {Request} req
 * @returns {Promise<{ content_type: string, content_id: string } | { error: string, status: number }>}
 */
async function parseMutationBody(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return { error: "JSON body required.", status: 400 };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "JSON body required.", status: 400 };
  }

  const contentType = body.content_type;
  if (!isFavoriteContentType(contentType)) {
    return { error: "Invalid or unsupported content_type.", status: 400 };
  }

  const contentId = normalizeFavoriteContentId(body.content_id);
  if (!contentId) {
    return { error: "content_id is required.", status: 400 };
  }

  // Intentionally ignore body.member_id / any ownership field from the browser.
  return { content_type: contentType, content_id: contentId };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  const memberId = auth.member.id;

  try {
    const store = getFavoritesStore();

    if (req.method === "GET") {
      const url = new URL(req.url);
      const contentType = url.searchParams.get("content_type")?.trim() || "";
      if (!isFavoriteContentType(contentType)) {
        return withCors(jsonResponse({ ok: false, error: "Invalid or unsupported content_type." }, 400));
      }

      const favorites = await listFavorites(store, memberId, contentType);
      return withCors(
        jsonResponse({
          ok: true,
          content_type: contentType,
          favorites,
          authMode: auth.mode,
        }),
      );
    }

    if (req.method === "POST") {
      const parsed = await parseMutationBody(req);
      if ("error" in parsed) {
        return withCors(jsonResponse({ ok: false, error: parsed.error }, parsed.status));
      }

      const result = await addFavorite(store, memberId, parsed.content_type, parsed.content_id);
      if (!result.ok) {
        return withCors(jsonResponse({ ok: false, error: result.error }, result.status));
      }
      return withCors(
        jsonResponse({
          ok: true,
          favorite: result.favorite,
          created: result.created,
          authMode: auth.mode,
        }),
      );
    }

    if (req.method === "DELETE") {
      const parsed = await parseMutationBody(req);
      if ("error" in parsed) {
        return withCors(jsonResponse({ ok: false, error: parsed.error }, parsed.status));
      }

      const result = await removeFavorite(store, memberId, parsed.content_type, parsed.content_id);
      if (!result.ok) {
        return withCors(jsonResponse({ ok: false, error: result.error }, result.status));
      }
      return withCors(
        jsonResponse({
          ok: true,
          removed: result.removed,
          authMode: auth.mode,
        }),
      );
    }

    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  } catch (err) {
    console.error("favorites failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to update favorites." }, 500));
  }
};
