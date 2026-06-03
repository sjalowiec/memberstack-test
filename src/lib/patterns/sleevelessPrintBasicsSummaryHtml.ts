/**
 * Shared HTML for the sleeveless “At a glance” basics summary (size, body style, garment type, neckline, gauge).
 * Used by the dedicated print route, the pattern tab print layout, and the on-screen pattern intro metadata block.
 */

import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveDiagramFinishedHipInches } from "./customBuildEffectiveFinishedHip";
import { resolveEffectiveSleevelessBodyShapePhrase } from "./sleevelessAlineShaping";
import { SLEEVELESS_CHART_AUDIENCE_LABELS } from "./patternStorage.ts";

const AUDIENCE_LABELS = SLEEVELESS_CHART_AUDIENCE_LABELS;

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** First character uppercased for short labels (“Straight body”, “Pullover front”). */
function sentenceCaseDisplay(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatGaugeFromBuilderExact(ygm: Record<string, unknown>, yg: Record<string, unknown>): string {
  const literal =
    (ygm && ygm.gaugeDisplayText != null ? String(ygm.gaugeDisplayText) : "") ||
    (yg && yg.gaugeDisplayText != null ? String(yg.gaugeDisplayText) : "");
  const literalTrimmed = literal.trim();
  if (literalTrimmed) return literalTrimmed;

  const rawS =
    (ygm && ygm.gaugeStitchRaw != null ? String(ygm.gaugeStitchRaw) : "") ||
    (yg && yg.gaugeStitchRaw != null ? String(yg.gaugeStitchRaw) : "");
  const rawR =
    (ygm && ygm.gaugeRowRaw != null ? String(ygm.gaugeRowRaw) : "") ||
    (yg && yg.gaugeRowRaw != null ? String(yg.gaugeRowRaw) : "");
  const ts = rawS.trim();
  const tr = rawR.trim();
  const unit =
    (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";
  if (ts && tr) {
    const over = unit === "cm" ? "10 cm" : "4 in";
    return `${ts} sts / ${tr} rows over ${over}`;
  }
  return "";
}

/**
 * Pattern intro / on-screen metadata gauge line: whole-number display, user swatch basis (4" vs 10 cm),
 * same rules as the yarn-gauge wizard step.
 */
export function formatGaugeIntroPhrase(
  ygm: Record<string, unknown>,
  yg: Record<string, unknown>,
): string {
  const rawS =
    (ygm && ygm.gaugeStitchRaw != null ? String(ygm.gaugeStitchRaw) : "") ||
    (yg && yg.gaugeStitchRaw != null ? String(yg.gaugeStitchRaw) : "");
  const rawR =
    (ygm && ygm.gaugeRowRaw != null ? String(ygm.gaugeRowRaw) : "") ||
    (yg && yg.gaugeRowRaw != null ? String(yg.gaugeRowRaw) : "");
  const ts = rawS.trim();
  const tr = rawR.trim();
  const unit =
    (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";
  if (ts && tr) {
    const s = parseFloat(ts);
    const r = parseFloat(tr);
    if (Number.isFinite(s) && s > 0 && Number.isFinite(r) && r > 0) {
      const over = unit === "cm" ? "10 cm" : '4"';
      return `${Math.round(s)} sts / ${Math.round(r)} rows over ${over}`;
    }
  }
  const spi = parseFloat(String(ygm?.gaugeStitchesPerInch ?? yg?.stitchGauge ?? "").trim());
  const rpi = parseFloat(String(ygm?.gaugeRowsPerInch ?? yg?.rowGauge ?? "").trim());
  if (Number.isFinite(spi) && spi > 0 && Number.isFinite(rpi) && rpi > 0) {
    return `${Math.round(spi * 4)} sts / ${Math.round(rpi * 4)} rows over 4"`;
  }
  return "";
}

function audienceLabelFromPattern(st: Record<string, unknown>, ft: Record<string, unknown>): string {
  const raw =
    (typeof st.recipientCategory === "string" && st.recipientCategory.trim()) ||
    (typeof ft.sizingChart === "string" && ft.sizingChart.trim()) ||
    "";
  const key = raw.toLowerCase();
  if (key && key in AUDIENCE_LABELS) {
    return AUDIENCE_LABELS[key as keyof typeof AUDIENCE_LABELS];
  }
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return "";
}

function garmentShapeLengthPhrase(
  st: Record<string, unknown>,
  patternData: Record<string, unknown>,
): string {
  const finishedBust = resolveEffectiveFinishedBustInches(patternData);
  const finishedHip = resolveDiagramFinishedHipInches(patternData, finishedBust);
  const effective = resolveEffectiveSleevelessBodyShapePhrase(
    patternData,
    finishedBust,
    finishedHip,
  );
  if (effective) return effective;

  const shapeKey = st.bodyShape;
  const lenKey = st.length;

  const shapeWord =
    shapeKey === "gathered" ? "gathered" : shapeKey ? String(shapeKey) : "";
  const lenWord =
    lenKey === "top"
      ? "top"
      : lenKey === "tunic"
        ? "tunic"
        : lenKey === "dress"
          ? "dress"
          : lenKey
            ? String(lenKey)
            : "";
  if (shapeWord && lenWord) return `${shapeWord} ${lenWord}`;
  if (shapeWord) return shapeWord;
  return lenWord || "";
}

function frontIntroPhrase(st: Record<string, unknown>): string {
  const k = st.frontStyle;
  if (k === "closed") return "pullover front";
  if (k === "open") return "cardigan front";
  return "";
}

function necklineBasicsLabel(st: Record<string, unknown>): string {
  const k = String(st.neckline ?? "")
    .trim()
    .toLowerCase();
  if (k === "round") return "Round";
  if (k === "v" || k === "v-neck") return "V-neck";
  return "";
}

/** Ease/fit choice label (Close / Standard / Relaxed) from the stored fit section. */
function fitBasicsLabel(ft: Record<string, unknown>): string {
  const raw = String(ft.fitChoice ?? ft.easeChoice ?? "")
    .trim()
    .toLowerCase();
  if (raw === "close") return "Close";
  if (raw === "standard") return "Standard";
  if (raw === "relaxed") return "Relaxed";
  return "";
}

type GaugeFormatter = (ygm: Record<string, unknown>, yg: Record<string, unknown>) => string;

function collectSleevelessBasicsSummaryRows(
  merged: Record<string, unknown>,
  patternData: Record<string, unknown>,
  gaugeFormatter: GaugeFormatter,
): { term: string; def: string }[] {
  const st = section(merged.style);
  const ft = section(merged.fit);
  const yg = section(merged.yarnGauge);
  const ygm =
    patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
      ? section(patternData.yarnGaugeMachine)
      : {};

  const rows: { term: string; def: string }[] = [];

  const aud = audienceLabelFromPattern(st, ft);
  const size = ft.selectedSize != null && String(ft.selectedSize).trim() ? String(ft.selectedSize).trim() : "";
  if (aud || size) {
    const parts: string[] = [];
    if (aud) parts.push(aud);
    if (size) parts.push(`chart size ${size}`);
    rows.push({
      term: "Size",
      def: parts.join(" — "),
    });
  }

  const garmentRaw = garmentShapeLengthPhrase(st, patternData);
  if (garmentRaw) {
    rows.push({
      term: "Body style",
      def: sentenceCaseDisplay(garmentRaw),
    });
  }

  const frontRaw = frontIntroPhrase(st);
  if (frontRaw) {
    rows.push({
      term: "Garment type",
      def: sentenceCaseDisplay(frontRaw),
    });
  }

  const neckLabel = necklineBasicsLabel(st);
  if (neckLabel) {
    rows.push({ term: "Neckline", def: neckLabel });
  }

  const fitDef = fitBasicsLabel(ft);
  if (fitDef) {
    rows.push({ term: "Fit", def: fitDef });
  }

  const gaugeStr = gaugeFormatter(ygm, yg);
  if (gaugeStr) {
    rows.push({ term: "Gauge", def: gaugeStr });
  }

  return rows;
}

function basicsRowsToDlHtml(rows: { term: string; def: string }[]): string {
  const dtdd = rows
    .map((r) => `<dt>${escapeHtml(r.term)}</dt><dd>${escapeHtml(r.def)}</dd>`)
    .join("");
  return `<dl class="print-summary-dl print-summary-dl--basics">${dtdd}</dl>`;
}

/** Basics-only `<dl>` / fallback paragraph for print “At a glance”. */
export function buildSleevelessPrintBasicsSummaryDlHtml(
  merged: Record<string, unknown>,
  patternData: Record<string, unknown>,
): string {
  const rows = collectSleevelessBasicsSummaryRows(merged, patternData, formatGaugeFromBuilderExact);
  if (rows.length === 0) {
    return `<p class="print-muted">No summary details were stored — complete the builder and reload this page.</p>`;
  }
  return basicsRowsToDlHtml(rows);
}

/**
 * Compact inline metadata layout for the on-screen summary. Each term/definition pair is wrapped
 * so the label stays attached to its value when the row wraps across lines.
 */
function basicsRowsToInlineDlHtml(rows: { term: string; def: string }[]): string {
  const pairs = rows
    .map(
      (r) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(r.term)}</dt><dd>${escapeHtml(r.def)}</dd></div>`,
    )
    .join("");
  return `<dl class="print-summary-dl print-summary-dl--basics print-summary-dl--inline">${pairs}</dl>`;
}

/** Same row model as print, with on-screen gauge phrasing (rounded sts/rows, 4" vs 10 cm). */
export function buildSleevelessScreenBasicsSummaryDlHtml(
  merged: Record<string, unknown>,
  patternData: Record<string, unknown>,
): string {
  const rows = collectSleevelessBasicsSummaryRows(merged, patternData, formatGaugeIntroPhrase);
  if (rows.length === 0) return "";
  return basicsRowsToInlineDlHtml(rows);
}
