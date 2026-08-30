/**
 * Finished Basic Socks Pattern page wiring.
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
import {
  buildBasicSockInstructionPair,
  type SockInstructionDocument,
} from "./sockInstructions";
import { buildSockPairInstructionTabsHtml } from "./sockPairInstructionTabs";

export const SOCK_FINISHED_PATTERN_MISSING_DRAFT_MESSAGE =
  "Create a socks pattern first, then come back to view your instructions.";

export const SOCK_FINISHED_PATTERN_INCOMPLETE_DRAFT_MESSAGE =
  SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE;

export type SockPatternPageReady = SockSummaryReady & {
  sock1: SockInstructionDocument;
  sock2: SockInstructionDocument;
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
    ["Foot Circumference", view.footCircumference],
    ["Foot Length", view.footLength],
    ["Leg Circumference", view.legCircumference],
    ["Leg Length", view.legLength],
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

export function renderSockPatternPairHtml(
  sock1: SockInstructionDocument,
  sock2: SockInstructionDocument,
): string {
  return buildSockPairInstructionTabsHtml(sock1, sock2);
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
  const pair = buildBasicSockInstructionPair(summary.calc);
  return {
    ...summary,
    sock1: pair.sock1,
    sock2: pair.sock2,
  };
}
