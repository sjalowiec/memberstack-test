/**
 * Registry of tools that can be embedded inside course lessons.
 *
 * This is now DERIVED from the canonical tool catalog in `data/tools.json`
 * (edited via the Tools Admin page at `/admin/embedded-tools`). A tool appears
 * here when `embeddable: true`; its embed availability comes from `embedStatus`.
 *
 * Keeping this module as the registry means existing consumers (course editor,
 * `EmbeddedTool.astro`) don't change: they still call `getEmbeddedToolByKey`,
 * `embeddedToolsForContext`, and `availableEmbeddedToolsForContext`.
 */
import toolsData from "../../../data/tools.json";
import {
  embedContextsOf,
  embedStatusOf,
  isEmbeddable,
  toolKeyOf,
  type EmbedStatus,
  type ToolRecord,
} from "./toolAdminFields";

export type EmbeddedToolStatus = EmbedStatus;

export type EmbeddedToolContext = "course";

export type EmbeddedToolEntry = {
  key: string;
  name: string;
  description: string;
  standalonePath: string;
  status: EmbeddedToolStatus;
  allowedContexts: EmbeddedToolContext[];
};

export const EMBEDDED_TOOL_REGISTRY: EmbeddedToolEntry[] = (
  toolsData as ToolRecord[]
)
  .filter(isEmbeddable)
  .map((tool) => ({
    key: toolKeyOf(tool),
    name: (tool.title ?? "").trim(),
    description: (tool.description ?? "").trim(),
    standalonePath: (tool.href ?? "").trim(),
    status: embedStatusOf(tool),
    allowedContexts: embedContextsOf(tool),
  }))
  .filter((entry) => entry.key.length > 0);

export function getEmbeddedToolByKey(key: string): EmbeddedToolEntry | undefined {
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  return EMBEDDED_TOOL_REGISTRY.find((entry) => entry.key === trimmed);
}

export function embeddedToolsForContext(
  context: EmbeddedToolContext,
): EmbeddedToolEntry[] {
  return EMBEDDED_TOOL_REGISTRY.filter((entry) =>
    entry.allowedContexts.includes(context),
  );
}

export function availableEmbeddedToolsForContext(
  context: EmbeddedToolContext,
): EmbeddedToolEntry[] {
  return embeddedToolsForContext(context).filter(
    (entry) => entry.status === "available",
  );
}

export function formatEmbeddedToolContexts(contexts: EmbeddedToolContext[]): string {
  return contexts.join(", ");
}
