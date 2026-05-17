/**
 * GET /.netlify/functions/custom-pattern-project-load?id=...&family=sleeveless
 */
import {
  getProjectsStore,
  jsonResponse,
  projectBlobKey,
  publicProject,
  readProjectJson,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const family = url.searchParams.get("family")?.trim() || "sleeveless";
  if (!id) {
    return withCors(jsonResponse({ ok: false, error: "id query parameter is required." }, 400));
  }

  try {
    const store = getProjectsStore();
    const key = projectBlobKey(family, user.userId, id);
    const project = await readProjectJson(store, key);
    if (!project) {
      return withCors(jsonResponse({ ok: false, error: "Project not found." }, 404));
    }
    return withCors(
      jsonResponse({
        ok: true,
        project: publicProject(project),
        authMode: user.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-load failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to load project." }, 500));
  }
};
