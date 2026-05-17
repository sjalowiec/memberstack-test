/**
 * PUT /.netlify/functions/custom-pattern-project-update
 * Update an existing saved Custom Pattern project.
 */
import {
  buildProjectRecord,
  getProjectsStore,
  jsonResponse,
  parseJsonBody,
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
  if (req.method !== "PUT" && req.method !== "POST") {
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
  if (!id) {
    return withCors(jsonResponse({ ok: false, error: "id is required for update." }, 400));
  }

  const family =
    typeof body.data.family === "string" && body.data.family.trim()
      ? body.data.family.trim()
      : "sleeveless";
  const key = projectBlobKey(family, user.userId, id);
  const store = getProjectsStore();
  const existing = await readProjectJson(store, key);
  if (!existing) {
    return withCors(jsonResponse({ ok: false, error: "Project not found." }, 404));
  }

  const mergedInput = {
    ...body.data,
    createdAt: existing.createdAt,
    version: existing.version,
    family: existing.family ?? family,
  };

  const built = buildProjectRecord(mergedInput, user.userId, id);
  if (!built.ok) {
    return withCors(jsonResponse({ ok: false, error: built.error }, 400));
  }

  const project = built.project;

  try {
    await store.set(key, JSON.stringify(publicProject(project)), {
      metadata: {
        userId: user.userId,
        family: project.family,
        projectId: project.id,
        updatedAt: project.updatedAt,
      },
    });
    return withCors(
      jsonResponse({
        ok: true,
        project: publicProject(project),
        authMode: user.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-update failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to update project." }, 500));
  }
};
