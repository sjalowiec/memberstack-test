/**
 * POST /.netlify/functions/custom-pattern-project-save
 * Create a saved Custom Pattern project from the current kbm_current_pattern payload.
 */
import {
  buildProjectRecord,
  getProjectsStore,
  jsonResponse,
  parseJsonBody,
  projectBlobKey,
  publicProject,
  resolveProjectUserId,
  upsertProjectSummaryInIndex,
  withCors,
} from "./lib/custom-pattern-projects-store.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "POST") {
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

  const built = buildProjectRecord(body.data, user.userId);
  if (!built.ok) {
    return withCors(jsonResponse({ ok: false, error: built.error }, 400));
  }

  const project = built.project;
  const key = projectBlobKey(project.family, user.userId, project.id);

  try {
    const store = getProjectsStore();
    await store.set(key, JSON.stringify(publicProject(project)), {
      metadata: {
        userId: user.userId,
        family: project.family,
        projectId: project.id,
        updatedAt: project.updatedAt,
      },
    });
    await upsertProjectSummaryInIndex(store, project.family, user.userId, project);
    return withCors(
      jsonResponse({
        ok: true,
        project: publicProject(project),
        authMode: user.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-save failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to save project." }, 500));
  }
};
