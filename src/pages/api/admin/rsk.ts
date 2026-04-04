import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const prerender = false;

const RSK_JSON_PATH = join(process.cwd(), "src", "data", "ready-set-knit.json");

const EDIT_SLUG = "hat";

type RskStep = {
  order: number;
  title: string;
  summary: string;
  content?: string | null;
  videoUrl?: string | null;
  checklist?: string[];
  downloads?: unknown[];
  notes?: string | null;
  published?: boolean;
};

type RskStage = {
  id: string;
  title: string;
  order: number;
  steps: RskStep[];
};

type RskProject = {
  title: string;
  slug: string;
  description: string;
  heroImage?: string | null;
  status?: string | null;
  published?: boolean;
  stages: RskStage[];
};

type RskFile = { projects: RskProject[] };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readRskFile(): RskFile {
  const raw = readFileSync(RSK_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("ready-set-knit.json must be a JSON object.");
  }
  const projects = (data as { projects?: unknown }).projects;
  if (!Array.isArray(projects)) {
    throw new Error("ready-set-knit.json must have a projects array.");
  }
  return data as RskFile;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function mergeProjectFromEditor(existing: RskProject, edited: RskProject): RskProject {
  const stages = existing.stages.map((est) => {
    const edSt = edited.stages.find((s) => s.id === est.id);
    if (!edSt) return est;
    // Match steps by array index so edited `order` values do not remap the wrong row.
    const steps = est.steps.map((estStep, i) => {
      const edStep = edSt.steps[i];
      if (!edStep) return estStep;
      const order =
        typeof edStep.order === "number" && Number.isFinite(edStep.order)
          ? Math.trunc(edStep.order)
          : estStep.order;
      return {
        ...estStep,
        title: typeof edStep.title === "string" ? edStep.title : estStep.title,
        summary: typeof edStep.summary === "string" ? edStep.summary : estStep.summary,
        order,
        published: edStep.published !== false,
      };
    });
    const stOrder =
      typeof edSt.order === "number" && Number.isFinite(edSt.order)
        ? Math.trunc(edSt.order)
        : est.order;
    return {
      ...est,
      title: typeof edSt.title === "string" ? edSt.title : est.title,
      order: stOrder,
      steps,
    };
  });

  return {
    ...existing,
    title: typeof edited.title === "string" ? edited.title : existing.title,
    slug: existing.slug,
    description:
      typeof edited.description === "string" ? edited.description : existing.description,
    published: edited.published !== false,
    stages,
  };
}

function parseProjectBody(raw: unknown): RskProject | null {
  if (!isRecord(raw)) return null;
  const p = raw.project;
  if (!isRecord(p)) return null;
  const title = p.title;
  const slug = p.slug;
  const description = p.description;
  const published = p.published;
  if (typeof title !== "string" || typeof slug !== "string" || typeof description !== "string") {
    return null;
  }
  if (slug !== EDIT_SLUG) return null;
  if (!Array.isArray(p.stages)) return null;

  const stages: RskStage[] = [];
  for (const s of p.stages) {
    if (!isRecord(s)) return null;
    const id = s.id;
    const stTitle = s.title;
    const order = s.order;
    if (typeof id !== "string" || typeof stTitle !== "string") return null;
    if (typeof order !== "number" || !Number.isFinite(order)) return null;
    if (!Array.isArray(s.steps)) return null;
    const steps: RskStep[] = [];
    for (const st of s.steps) {
      if (!isRecord(st)) return null;
      const o = st.order;
      const t = st.title;
      const sum = st.summary;
      if (typeof o !== "number" || !Number.isFinite(o)) return null;
      if (typeof t !== "string" || typeof sum !== "string") return null;
      steps.push({
        order: Math.trunc(o),
        title: t,
        summary: sum,
        content: st.content as string | null | undefined,
        videoUrl: st.videoUrl as string | null | undefined,
        checklist: Array.isArray(st.checklist) ? (st.checklist as string[]) : [],
        downloads: Array.isArray(st.downloads) ? st.downloads : [],
        notes: st.notes as string | null | undefined,
        published: st.published !== false,
      });
    }
    stages.push({
      id,
      title: stTitle,
      order: Math.trunc(order),
      steps,
    });
  }

  return {
    title,
    slug,
    description,
    published: published !== false,
    stages,
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const edited = parseProjectBody(body);
  if (!edited) {
    return jsonResponse(
      { ok: false, error: "Invalid body: expected { project } with slug hat and valid stages/steps." },
      400
    );
  }

  let file: RskFile;
  try {
    file = readRskFile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read ready-set-knit.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const idx = file.projects.findIndex((p) => p.slug === EDIT_SLUG);
  if (idx === -1) {
    return jsonResponse({ ok: false, error: `Project "${EDIT_SLUG}" not found.` }, 404);
  }

  const existing = file.projects[idx];
  const merged = mergeProjectFromEditor(existing, edited);
  const next: RskFile = {
    ...file,
    projects: [...file.projects],
  };
  next.projects[idx] = merged;

  try {
    writeFileSync(RSK_JSON_PATH, JSON.stringify(next, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write ready-set-knit.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, project: merged });
};
