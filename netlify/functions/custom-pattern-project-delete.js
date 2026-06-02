/**
 * DELETE /.netlify/functions/custom-pattern-project-delete
 * Deletes a saved Custom Pattern project.
 */
import {
  deleteProjectAndUpdateIndex,
  FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE,
  getProjectsStore,
  isFreeSleevelessPatternDeleteBlocked,
  jsonResponse,
  listProjectSummaries,
  parseJsonBody,
  projectBlobKey,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "DELETE" && req.method !== "POST") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }

  let body;
  try {
    body = parseJsonBody(await req.json());
  } catch {
    return withCors(jsonResponse({ ok: false, error: "Invalid JSON body." }, 400));
  }
  if (!body.ok) {
    return withCors(jsonResponse({ ok: false, error: body.error }, 400));
  }

  const id = typeof body.data.id === "string" ? body.data.id.trim() : "";
  const family = typeof body.data.family === "string" && body.data.family.trim()
    ? body.data.family.trim()
    : "sleeveless";
  if (!id) {
    return withCors(jsonResponse({ ok: false, error: "id is required." }, 400));
  }

  try {
    const store = getProjectsStore();
    const key = projectBlobKey(family, user.userId, id);
    const meta = await store.getMetadata(key);
    if (!meta) {
      return withCors(jsonResponse({ ok: false, error: "Project not found." }, 404));
    }

    // Free-pattern delete protection (defense-in-depth; the client also gates the UI + delete call).
    // TODO: verify these entitlement flags server-side via Memberstack once an admin read is wired;
    // they are currently client-asserted, matching the existing X-KBM-Member-Id trust model.
    const freeClaim =
      body.data.freeClaim &&
      typeof body.data.freeClaim === "object" &&
      !Array.isArray(body.data.freeClaim)
        ? body.data.freeClaim
        : null;
    if (freeClaim) {
      const hasSystemAccess = freeClaim.hasSystemAccess === true;
      const freeClaimed = freeClaim.freeClaimed === true;
      const claimedId =
        typeof freeClaim.freeClaimedPatternId === "string"
          ? freeClaim.freeClaimedPatternId.trim()
          : "";

      // Only the unknown-id fallback needs the live count; compute it from the user's own blobs.
      let totalSavedCount = Number.POSITIVE_INFINITY;
      if (freeClaimed && !hasSystemAccess && !claimedId) {
        const summaries = await listProjectSummaries(store, family, user.userId);
        totalSavedCount = Array.isArray(summaries) ? summaries.length : 1;
      }

      if (
        isFreeSleevelessPatternDeleteBlocked({
          hasSystemAccess,
          freeClaimed,
          freeClaimedPatternId: claimedId,
          projectId: id,
          totalSavedCount,
        })
      ) {
        return withCors(
          jsonResponse({ ok: false, error: FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE }, 403),
        );
      }
    }

    await deleteProjectAndUpdateIndex(store, family, user.userId, id);

    return withCors(
      jsonResponse({
        ok: true,
        authMode: user.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-delete failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to delete project." }, 500));
  }
};

