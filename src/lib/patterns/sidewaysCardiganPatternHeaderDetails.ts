/**
 * Concise on-screen details for the Sideways saved-pattern header.
 * Reads stored choices only. Does not calculate stitches, rows, or instructions.
 */

import { formatGaugeIntroPhrase } from "./sleevelessPrintBasicsSummaryHtml";
import {
  SLEEVELESS_CHART_AUDIENCE_LABELS,
  type SleevelessChartAudience,
} from "./patternStorage";
import {
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
  parseSidewaysCardiganGarmentStyle,
  parseSidewaysCardiganSleeveDirection,
  readSavedSidewaysCardiganSleeveLengthChoice,
} from "./sidewaysCardiganConstructionIdentity";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function audienceLabel(style: Record<string, unknown>, fit: Record<string, unknown>): string {
  const raw = String(style.recipientCategory ?? fit.sizingChart ?? "")
    .trim()
    .toLowerCase();
  if (raw && raw in SLEEVELESS_CHART_AUDIENCE_LABELS) {
    return SLEEVELESS_CHART_AUDIENCE_LABELS[raw as SleevelessChartAudience];
  }
  return "";
}

function fitLabel(fit: Record<string, unknown>): string {
  const raw = String(fit.fitChoice ?? fit.easeChoice ?? "")
    .trim()
    .toLowerCase();
  if (raw === "close") return "Close";
  if (raw === "standard") return "Standard";
  if (raw === "relaxed") return "Relaxed";
  return "";
}

function sleeveLabel(style: Record<string, unknown>): string {
  const direction = parseSidewaysCardiganSleeveDirection(style.sleeveDirection);
  const length = readSavedSidewaysCardiganSleeveLengthChoice(style.sleeveLength);
  const parts = [
    direction ? SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[direction] : "",
    length ? SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS[length] : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Inline label/value list for the shared pattern header. Empty when nothing is saved. */
export function buildSidewaysCardiganPatternHeaderDetailsHtml(
  pattern: Record<string, unknown>,
): string {
  const style = section(pattern.style);
  const fit = section(pattern.fit);
  const yarnGauge = section(pattern.yarnGauge);
  const yarnGaugeMachine = section(pattern.yarnGaugeMachine);
  const rows: Array<[string, string]> = [];

  const garment = parseSidewaysCardiganGarmentStyle(style.garmentStyle ?? style.frontStyle);
  if (garment) rows.push(["Style", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[garment]]);

  const audience = audienceLabel(style, fit);
  if (audience) rows.push(["Audience", audience]);

  const size = String(fit.selectedSize ?? "").trim();
  if (size) rows.push(["Size", `Chart size ${size}`]);

  const fitText = fitLabel(fit);
  if (fitText) rows.push(["Fit", fitText]);

  const sleeves = sleeveLabel(style);
  if (sleeves) rows.push(["Sleeves", sleeves]);

  const gauge = formatGaugeIntroPhrase(yarnGaugeMachine, yarnGauge);
  if (gauge) rows.push(["Gauge", gauge]);

  if (rows.length === 0) return "";

  const pairs = rows
    .map(
      ([term, def]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(def)}</dd></div>`,
    )
    .join("");
  return `<dl class="print-summary-dl print-summary-dl--inline">${pairs}</dl>`;
}
