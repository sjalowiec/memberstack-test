/**
 * POST /.netlify/functions/custom-pattern-project-save
 * Create a saved Custom Pattern project from the current kbm_current_pattern payload.
 *
 * Auth: Bearer JWT + active membership (MEMBER_PLAN_IDS). Client entitlement flags ignored.
 */
import {
  buildProjectRecord,
  getProjectsStore,
  jsonResponse,
  parseJsonBody,
  projectBlobKey,
  publicProject,
  upsertProjectSummaryInIndex,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import { requirePatternProjectAccess } from "./lib/require-member-access.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "POST") {
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

  const built = buildProjectRecord(body.data, access.userId);
  if (!built.ok) {
    return withCors(jsonResponse({ ok: false, error: built.error }, 400));
  }

  const project = built.project;
  const store = getProjectsStore();
  const key = projectBlobKey(project.family, access.userId, project.id);

  try {
    await store.set(key, JSON.stringify(publicProject(project)), {
      metadata: {
        userId: access.userId,
        family: project.family,
        projectId: project.id,
        updatedAt: project.updatedAt,
      },
    });
    await upsertProjectSummaryInIndex(store, project.family, access.userId, project);
    return withCors(
      jsonResponse({
        ok: true,
        project: publicProject(project),
        authMode: access.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-save failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to save project." }, 500));
  }
};
