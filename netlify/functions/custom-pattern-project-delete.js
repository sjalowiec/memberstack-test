/**
 * DELETE /.netlify/functions/custom-pattern-project-delete
 * Deletes a saved Custom Pattern project.
 *
 * Auth: Bearer JWT + active membership. Client free-claim / entitlement flags ignored.
 * Ownership: blob key scoped to verified member id (404 if not owned).
 */
import {
  deleteProjectAndUpdateIndex,
  getProjectsStore,
  jsonResponse,
  parseJsonBody,
  projectBlobKey,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import { requirePatternProjectAccess } from "./lib/require-member-access.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "DELETE" && req.method !== "POST") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const access = await requirePatternProjectAccess(req);
  if (!access.ok) {
    return withCors(jsonResponse({ ok: false, error: access.error }, access.status));
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
  const family =
    typeof body.data.family === "string" && body.data.family.trim()
      ? body.data.family.trim()
      : "sleeveless";
  if (!id) {
    return withCors(jsonResponse({ ok: false, error: "id is required." }, 400));
  }

  try {
    const store = getProjectsStore();
    const key = projectBlobKey(family, access.userId, id);
    const meta = await store.getMetadata(key);
    if (!meta) {
      return withCors(jsonResponse({ ok: false, error: "Project not found." }, 404));
    }

    await deleteProjectAndUpdateIndex(store, family, access.userId, id);

    return withCors(
      jsonResponse({
        ok: true,
        authMode: access.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-delete failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to delete project." }, 500));
  }
};
