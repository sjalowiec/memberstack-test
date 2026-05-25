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
  upsertProjectSummaryInIndex,
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

  if (body.data.workflowOnly === true) {
    const readingWorkflow = body.data.readingWorkflow;
    if (!readingWorkflow || typeof readingWorkflow !== "object" || Array.isArray(readingWorkflow)) {
      return withCors(
        jsonResponse({ ok: false, error: "readingWorkflow object is required for workflowOnly." }, 400),
      );
    }
    const project = {
      ...existing,
      readingWorkflow,
      updatedAt: existing.updatedAt,
      version: existing.version,
    };
    try {
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
      console.error("custom-pattern-project-update workflowOnly failed:", err);
      return withCors(jsonResponse({ ok: false, error: "Failed to update project." }, 500));
    }
  }

  const mergedInput = {
    ...body.data,
    createdAt: existing.createdAt,
    version: existing.version,
    family: existing.family ?? family,
    readingWorkflow: existing.readingWorkflow,
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
    await upsertProjectSummaryInIndex(store, project.family, user.userId, project);
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
