/**
 * Shared field helpers for the Tools Admin editor (`/admin/embedded-tools`),
 * the tools save API (`/api/admin/tools`), and the embedded-tool registry.
 *
 * The canonical data source for every tool is `data/tools.json`. This module is
 * framework-agnostic (no `node:fs`) so it can be imported on the server, in the
 * browser bundle (course editor), and in tests.
 */

/** Overall public status of a tool (derived from `active` + `status`). */
export type ToolStatus = "live" | "coming-soon" | "hidden";

/**
 * Embed-specific status. Only tools with `embeddable: true` and
 * `embedStatus: "available"` are offered in the course editor dropdown.
 */
export type EmbedStatus = "available" | "planned" | "draft" | "hidden";

/** Contexts a tool can be embedded in. Currently only course lessons. */
export type EmbedContext = "course";

/**
 * A single row in `data/tools.json`. Only the fields the admin/registry care
 * about are typed; unknown legacy fields are preserved via the index signature.
 */
export type ToolRecord = {
  id?: number;
  title?: string;
  href?: string;
  icon?: string;
  description?: string;
  membersonly?: boolean;
  helpID?: number | string | null;
  category?: string;
  help_text?: string;
  active?: boolean;
  /** Legacy public status token, e.g. "coming-soon". */
  status?: string;
  /** Stable key used when embedding this tool (defaults to the href slug). */
  toolKey?: string;
  embeddable?: boolean;
  embedContexts?: EmbedContext[];
  embedStatus?: EmbedStatus;
  [key: string]: unknown;
};

export const TOOL_STATUS_OPTIONS: ToolStatus[] = ["live", "coming-soon", "hidden"];
export const EMBED_STATUS_OPTIONS: EmbedStatus[] = [
  "available",
  "planned",
  "draft",
  "hidden",
];
export const EMBED_CONTEXT_OPTIONS: EmbedContext[] = ["course"];

const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  live: "Live",
  "coming-soon": "Coming soon",
  hidden: "Hidden",
};

const EMBED_STATUS_LABELS: Record<EmbedStatus, string> = {
  available: "Available",
  planned: "Planned",
  draft: "Draft",
  hidden: "Hidden",
};

export function toolStatusLabel(status: ToolStatus): string {
  return TOOL_STATUS_LABELS[status] ?? status;
}

export function embedStatusLabel(status: EmbedStatus): string {
  return EMBED_STATUS_LABELS[status] ?? status;
}

export function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Turn an href like "/tools/yarn-estimator" or "bands.cfm" into a slug key. */
export function slugFromHref(href: unknown): string {
  const raw = asString(href).trim();
  if (!raw) return "";
  const last = raw.split("/").filter(Boolean).pop() ?? raw;
  return last
    .replace(/\.(cfm|astro|html?)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable embed key for a tool: explicit `toolKey`, else derived from href. */
export function toolKeyOf(tool: ToolRecord): string {
  const explicit = asString(tool.toolKey).trim();
  return explicit || slugFromHref(tool.href);
}

/**
 * Derive the public status token from the legacy `active` / `status` fields so
 * the admin can present a single dropdown without breaking the public tools
 * index (which still reads `active` and `status`).
 */
export function toolStatusOf(tool: ToolRecord): ToolStatus {
  if (tool.active === true) return "live";
  if (asString(tool.status) === "coming-soon") return "coming-soon";
  return "hidden";
}

/** Write a chosen ToolStatus back onto the legacy `active` / `status` fields. */
export function applyToolStatus(tool: ToolRecord, status: ToolStatus): void {
  if (status === "live") {
    tool.active = true;
    delete tool.status;
  } else if (status === "coming-soon") {
    tool.active = false;
    tool.status = "coming-soon";
  } else {
    tool.active = false;
    delete tool.status;
  }
}

export function isEmbeddable(tool: ToolRecord): boolean {
  return tool.embeddable === true;
}

export function embedContextsOf(tool: ToolRecord): EmbedContext[] {
  if (!Array.isArray(tool.embedContexts)) return [];
  return tool.embedContexts.filter(
    (ctx): ctx is EmbedContext => ctx === "course",
  );
}

export function embedStatusOf(tool: ToolRecord): EmbedStatus {
  const value = asString(tool.embedStatus).trim();
  return (EMBED_STATUS_OPTIONS as string[]).includes(value)
    ? (value as EmbedStatus)
    : "hidden";
}

export function isMemberOnly(tool: ToolRecord): boolean {
  return tool.membersonly === true;
}

/** Human-readable list of embed contexts, e.g. "course" or "-". */
export function formatEmbedContexts(contexts: EmbedContext[]): string {
  return contexts.length ? contexts.join(", ") : "";
}

/**
 * Normalize a single tool record for persistence: coerce embed fields to
 * consistent types and keep the legacy status fields in sync. Unknown fields
 * are preserved. Returns a new object; does not mutate the input.
 */
export function normalizeToolForSave(input: unknown): ToolRecord {
  const tool: ToolRecord =
    input && typeof input === "object" ? { ...(input as ToolRecord) } : {};

  tool.title = asString(tool.title).trim();
  tool.href = asString(tool.href).trim();
  tool.category = asString(tool.category).trim();
  tool.description = asString(tool.description);
  tool.membersonly = tool.membersonly === true;

  // `active` (live) and `status` (legacy label, e.g. "coming-soon") are
  // independent editable columns in Tools Admin, so preserve them as-is rather
  // than re-deriving one from the other.
  tool.active = tool.active === true;
  const statusToken = asString(tool.status).trim();
  if (statusToken) tool.status = statusToken;
  else delete tool.status;

  // A tool cannot be both live and "coming soon"; live wins.
  if (tool.active === true && tool.status === "coming-soon") {
    delete tool.status;
  }

  const embeddable = tool.embeddable === true;
  tool.embeddable = embeddable;

  if (embeddable) {
    const key = toolKeyOf(tool);
    if (key) tool.toolKey = key;
    tool.embedContexts = embedContextsOf(tool);
    tool.embedStatus = embedStatusOf(tool);
  } else {
    delete tool.embedContexts;
    delete tool.embedStatus;
    // Leave any existing toolKey in place; harmless when not embeddable.
  }

  return tool;
}
