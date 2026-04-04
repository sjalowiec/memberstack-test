import raw from "../ready-set-knit.json" assert { type: "json" };
import type { RskPhase, RskProject, RskResourceLink, RskStep } from "./hat-project";

const PHASES: RskPhase[] = ["ready", "set", "knit"];

export interface ReadySetKnitDownload {
  label: string;
  url: string;
}

export interface ReadySetKnitStepJson {
  order: number;
  title: string;
  summary: string;
  content?: string | null;
  videoUrl?: string | null;
  checklist?: string[];
  downloads?: ReadySetKnitDownload[];
  notes?: string | null;
  published?: boolean;
}

export interface ReadySetKnitStageJson {
  id: string;
  title: string;
  order: number;
  steps: ReadySetKnitStepJson[];
}

export interface ReadySetKnitProjectJson {
  title: string;
  slug: string;
  description: string;
  heroImage?: string | null;
  status?: string | null;
  published?: boolean;
  stages: ReadySetKnitStageJson[];
}

export interface ReadySetKnitFile {
  projects: ReadySetKnitProjectJson[];
}

function isPhase(id: string): id is RskPhase {
  return PHASES.includes(id as RskPhase);
}

function defaultPhaseTitle(phase: RskPhase): string {
  if (phase === "ready") return "Ready";
  if (phase === "set") return "Set";
  if (phase === "knit") return "Knit";
  return phase;
}

function normalizeDownloads(
  downloads: ReadySetKnitDownload[] | undefined
): RskResourceLink[] {
  if (!downloads?.length) return [];
  return downloads
    .filter((d) => d && typeof d.label === "string" && typeof d.url === "string")
    .map((d) => ({ label: d.label.trim(), url: d.url.trim() }))
    .filter((d) => d.label && d.url);
}

/** Published projects only, for static routes. */
export function listPublishedReadySetKnitSlugs(): string[] {
  const file = raw as ReadySetKnitFile;
  return (file.projects || [])
    .filter((p) => p.published !== false)
    .map((p) => p.slug)
    .filter(Boolean);
}

function jsonProjectToRskProject(json: ReadySetKnitProjectJson): RskProject {
  const stages = [...(json.stages || [])].sort((a, b) => a.order - b.order);

  const flat: RskStep[] = [];

  for (const stage of stages) {
    if (!isPhase(stage.id)) continue;

    const stageSteps = [...(stage.steps || [])]
      .filter((s) => s.published !== false)
      .sort((a, b) => a.order - b.order);

    for (const step of stageSteps) {
      const id = `${stage.id}-${step.order}`;
      const actions = Array.isArray(step.checklist)
        ? step.checklist.map((t) => String(t).trim()).filter(Boolean)
        : [];

      flat.push({
        id,
        phase: stage.id,
        phaseTitle: stage.title,
        navLabel: "",
        title: step.title,
        intro: step.summary,
        actions,
        nextButtonText: "",
        content: step.content ?? null,
        videoUrl: step.videoUrl ?? null,
        downloads: normalizeDownloads(step.downloads),
        notes: step.notes ?? null,
        showVideoPlaceholder: false,
      });
    }
  }

  for (let i = 0; i < flat.length; i++) {
    const phaseTitle =
      flat[i].phaseTitle?.trim() || defaultPhaseTitle(flat[i].phase);
    flat[i].navLabel = `${phaseTitle} • ${i + 1}`;
  }

  for (let i = 0; i < flat.length; i++) {
    const next = flat[i + 1];
    if (next) {
      flat[i].nextButtonText = `Next: ${next.title}`;
    } else {
      flat[i].nextButtonText = "Open Help Hub";
    }
  }

  return {
    slug: json.slug,
    title: json.title,
    intro: json.description,
    heroImage: json.heroImage ?? null,
    status: json.status ?? null,
    steps: flat,
  };
}

/** Returns a walkthrough-ready project, or undefined if missing or not published. */
export function getReadySetKnitProject(slug: string): RskProject | undefined {
  const file = raw as ReadySetKnitFile;
  const json = (file.projects || []).find((p) => p.slug === slug);
  if (!json || json.published === false) return undefined;
  return jsonProjectToRskProject(json);
}
