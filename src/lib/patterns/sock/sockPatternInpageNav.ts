/**
 * Socks in-page section navigation items.
 * Order follows the generated instruction document so Toe Up and Cuff-to-Toe cannot drift.
 * Labels are the Pattern System jump names (not Quick Tips / videos).
 */

import type { PatternInpageNavItem } from "../patternInpageNav";
import type {
  SockInstructionDocument,
  SockInstructionSection,
  SockInstructionSectionId,
  SockOfPair,
} from "./sockInstructionModel";

export const SOCK_CUFF_TO_TOE_INPAGE_NAV_LABELS = [
  "Cuff",
  "Leg",
  "Ankle",
  "Heel",
  "Sole & Instep",
  "Toe",
  "Finishing",
] as const;

export const SOCK_TOE_UP_INPAGE_NAV_LABELS = [
  "Scrap On",
  "Toe",
  "Sole & Instep",
  "Heel",
  "Ankle",
  "Leg",
  "Finishing",
] as const;

const SOCK_INPAGE_NAV_LABEL_BY_SECTION_ID: Record<
  Exclude<SockInstructionSectionId, "cast-on">,
  string
> = {
  leg: "Leg",
  ankle: "Ankle",
  heel: "Heel",
  foot: "Sole & Instep",
  toe: "Toe",
  finishing: "Finishing",
};

export function sockPatternSectionAnchorId(
  sock: SockOfPair,
  sectionId: string,
): string {
  const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
  return `sock-${sock}-${sid}`;
}

export function sockPatternInpageNavLabel(
  section: Pick<SockInstructionSection, "id" | "title" | "constructionDirection">,
): string {
  if (section.id === "cast-on") {
    return section.constructionDirection === "toe-up" ? section.title : "Cuff";
  }
  return SOCK_INPAGE_NAV_LABEL_BY_SECTION_ID[section.id];
}

/** Build TOC items from the generated instruction sections, in knitting order. */
export function sockPatternInpageNavItems(
  doc: SockInstructionDocument,
): PatternInpageNavItem[] {
  return doc.sections.map((section) => ({
    label: sockPatternInpageNavLabel(section),
    ids: [sockPatternSectionAnchorId(doc.sock, section.id)],
  }));
}
