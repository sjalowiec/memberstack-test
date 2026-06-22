/** Accordion layout: optional intro richText + exerciseAccordion in one block. */

import {
  richTextHasVisibleContent,
  sortedBlockComponents,
} from "./courseTextVideoLayout";

export { richTextHasVisibleContent, sortedBlockComponents };

export const ACCORDION_INTRO_ROLE = "accordionIntro";

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type AccordionLayoutParts = {
  introText: ComponentLike | null;
  accordion: ComponentLike;
};

function accordionComponents(block: BlockLike): ComponentLike[] {
  return sortedBlockComponents(block).filter((c) => c.type === "exerciseAccordion");
}

function nonAccordionComponents(block: BlockLike): ComponentLike[] {
  return sortedBlockComponents(block).filter((c) => c.type !== "exerciseAccordion");
}

/** True when a block is an accordion item (accordion alone, or intro richText + accordion). */
export function isAccordionLayoutBlock(block: BlockLike): boolean {
  const accordions = accordionComponents(block);
  if (accordions.length !== 1) return false;

  const others = nonAccordionComponents(block);
  if (others.length === 0) return true;

  return others.length === 1 && others[0]!.type === "richText";
}

function resolveIntroText(
  block: BlockLike,
  accordion: ComponentLike,
): ComponentLike | null {
  const richTexts = nonAccordionComponents(block).filter((c) => c.type === "richText");
  if (richTexts.length === 0) return null;

  const byRole = richTexts.find((rt) => rt.layoutRole === ACCORDION_INTRO_ROLE);
  if (byRole) return byRole;

  if (richTexts.length === 1) return richTexts[0]!;

  const accordionOrder = Number(accordion.order ?? 0);
  const ordered = [...richTexts].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );
  return ordered.find((rt) => Number(rt.order ?? 0) < accordionOrder) ?? ordered[0]!;
}

export function getAccordionLayoutParts(block: BlockLike): AccordionLayoutParts | null {
  if (!isAccordionLayoutBlock(block)) return null;
  const accordion = accordionComponents(block)[0];
  if (!accordion) return null;

  return {
    introText: resolveIntroText(block, accordion),
    accordion,
  };
}

export function accordionLayoutSummary(parts: AccordionLayoutParts): string {
  const sections = Array.isArray(parts.accordion.sections) ? parts.accordion.sections : [];
  const sectionLabel = `${sections.length} section${sections.length === 1 ? "" : "s"}`;
  const introHtml = parts.introText ? String(parts.introText.html ?? "") : "";
  if (richTextHasVisibleContent(introHtml)) {
    const text = introHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    return `${preview} · ${sectionLabel}`;
  }
  return sectionLabel;
}
