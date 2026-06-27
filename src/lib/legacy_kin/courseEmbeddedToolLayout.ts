/** Embedded tool layout: optional intro richText + embeddedTool in one block. */

import {
  richTextHasVisibleContent,
  sortedBlockComponents,
} from "./courseTextVideoLayout";

export { richTextHasVisibleContent, sortedBlockComponents };

export const EMBEDDED_TOOL_INTRO_ROLE = "embeddedToolIntro";

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type EmbeddedToolLayoutParts = {
  introText: ComponentLike | null;
  tool: ComponentLike;
};

function embeddedToolComponents(block: BlockLike): ComponentLike[] {
  return sortedBlockComponents(block).filter((c) => c.type === "embeddedTool");
}

function nonEmbeddedToolComponents(block: BlockLike): ComponentLike[] {
  return sortedBlockComponents(block).filter((c) => c.type !== "embeddedTool");
}

/** True when a block is an embedded tool item (tool alone, or intro richText + tool). */
export function isEmbeddedToolLayoutBlock(block: BlockLike): boolean {
  const tools = embeddedToolComponents(block);
  if (tools.length !== 1) return false;

  const others = nonEmbeddedToolComponents(block);
  if (others.length === 0) return true;

  return others.length === 1 && others[0]!.type === "richText";
}

function resolveIntroText(
  block: BlockLike,
  tool: ComponentLike,
): ComponentLike | null {
  const richTexts = nonEmbeddedToolComponents(block).filter((c) => c.type === "richText");
  if (richTexts.length === 0) return null;

  const byRole = richTexts.find((rt) => rt.layoutRole === EMBEDDED_TOOL_INTRO_ROLE);
  if (byRole) return byRole;

  if (richTexts.length === 1) return richTexts[0]!;

  const toolOrder = Number(tool.order ?? 0);
  const ordered = [...richTexts].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );
  return ordered.find((rt) => Number(rt.order ?? 0) < toolOrder) ?? ordered[0]!;
}

export function getEmbeddedToolLayoutParts(
  block: BlockLike,
): EmbeddedToolLayoutParts | null {
  if (!isEmbeddedToolLayoutBlock(block)) return null;
  const tool = embeddedToolComponents(block)[0];
  if (!tool) return null;

  return {
    introText: resolveIntroText(block, tool),
    tool,
  };
}

export function embeddedToolLayoutSummary(parts: EmbeddedToolLayoutParts): string {
  const toolKey = String(parts.tool.toolKey ?? "").trim();
  const toolLabel = toolKey || "Embedded tool";
  const introHtml = parts.introText ? String(parts.introText.html ?? "") : "";
  if (richTextHasVisibleContent(introHtml)) {
    const text = introHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    return `${preview} · ${toolLabel}`;
  }
  return toolLabel;
}
