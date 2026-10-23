/**
 * Finished Christmas Stocking Pattern page wiring.
 * Pipeline: SocksDraft → {@link buildSockSummaryFromDraft} → instruction generator → renderer.
 * Does not recalculate garment geometry or rebuild short-row / Magic Formula math.
 */

import { BASIC_SOCK_PATTERN_NAME } from "./sockDraft";
import type { SockDraft } from "./sockDraft";
import type { SockSizingAdapter } from "./sockSizing";
import {
  SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
  buildSockSummaryFromDraft,
  type SockSummaryFailure,
  type SockSummaryReady,
} from "./sockPatternFromDraft";
import type { SockInstructionDocument } from "../sock/sockInstructions";
import {
  buildChristmasStockingInstructions,
  renderChristmasStockingInstructionsHtml,
} from "./christmasStockingInstructions";

export const SOCK_FINISHED_PATTERN_MISSING_DRAFT_MESSAGE =
  "Create a Christmas stocking pattern first, then come back to view your instructions.";

export const SOCK_FINISHED_PATTERN_INCOMPLETE_DRAFT_MESSAGE =
  SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE;

export type SockPatternPageReady = SockSummaryReady & {
  instructions: SockInstructionDocument;
  instructionsHtml: string;
};

export type SockPatternPageResult = SockPatternPageReady | SockSummaryFailure;

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Screen + print-at-a-glance summary. Finished measurements only — no derived ankle/heel/toe. */
export function buildSockPatternSummaryDlHtml(
  view: SockSummaryReady["view"],
  opts?: { inline?: boolean },
): string {
  const rows: Array<[string, string]> = [
    ["Pattern", view.patternName || BASIC_SOCK_PATTERN_NAME],
    ["Size", view.sizeLabel],
    ["Construction", view.constructionLabel],
    ["Leg Length", view.legLength],
    ["Foot Circumference", view.footCircumference],
    ["Foot Length", view.footLength],
    ["Gauge", view.gaugeLabel],
  ];
  const cls = opts?.inline
    ? "print-summary-dl print-summary-dl--inline"
    : "print-summary-dl";
  const pairs = rows
    .map(
      ([term, def]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(def)}</dd></div>`,
    )
    .join("");
  return `<dl class="${cls}">${pairs}</dl>`;
}

export function buildSockPatternFromDraft(
  draft: SockDraft | null | undefined,
  adapter: SockSizingAdapter,
): SockPatternPageResult {
  const summary = buildSockSummaryFromDraft(draft, adapter);
  if (!summary.ok) {
    if (summary.reason === "missing") {
      return { ...summary, message: SOCK_FINISHED_PATTERN_MISSING_DRAFT_MESSAGE };
    }
    return summary;
  }
  const instructions = buildChristmasStockingInstructions(summary.calc);
  return {
    ...summary,
    instructions,
    instructionsHtml: renderChristmasStockingInstructionsHtml(summary.calc),
  };
}
