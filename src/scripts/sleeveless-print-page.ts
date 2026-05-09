/**
 * Client entry: loads saved builder data (same keys as pattern tab), runs {@link generateSleevelessBackPattern}.
 */

import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  getPatternStorageKey,
  SLEEVELESS_CHART_AUDIENCE_LABELS,
} from "../lib/patterns/patternStorage.ts";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "../lib/patterns/sleevelessPatternBuilderMerge.ts";
import {
  getSleevelessGoldenBetaCanonicalPattern,
  getSleevelessGoldenBetaPatternBuilderData,
} from "../lib/patterns/sleevelessGoldenBeta.ts";
import { validatePatternBuilderRequired } from "../lib/patterns/patternBuilderValidation";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "../lib/patterns/sleevelessPatternOutput.ts";
import {
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "../lib/patterns/neckShoulderShapingChartHtml.ts";
import {
  loadSleevelessBackDiagramSvgMarkup,
  loadSleevelessFrontDiagramSvgMarkup,
} from "../lib/patterns/sleevelessPrintDiagramSvg.ts";
import {
  renderSleevelessPrintPieceHtml,
  splitRowsBeforeNeckShoulderChartMount,
} from "../lib/patterns/sleevelessPatternPrintRender.ts";

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

/** Omitted from printable sheet only; does not alter generator output. */
const PRINT_SUPPRESS_WARNING_SNIPPETS = ["even-numbered row (RC) with the carriage on the right"] as const;

function warningsForSleevelessPrintPrintout(resultWarnings: readonly string[]): string[] {
  return resultWarnings.filter((w) => {
    const t = w.trim().toLowerCase();
    return !PRINT_SUPPRESS_WARNING_SNIPPETS.some((frag) => t.includes(frag.toLowerCase()));
  });
}

function mergedPatternForDisplay(base: Record<string, unknown>): Record<string, unknown> {
  return mergedPatternForDisplayFromSources(base, getPatternData());
}

function buildGeneratorPatternData(merged: Record<string, unknown>): Record<string, unknown> {
  return buildGeneratorPatternDataFromSources(merged, getPatternData());
}

function formatGaugeIntroPhrase(ygm: Record<string, unknown>, yg: Record<string, unknown>): string {
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

function gaugeBasisFromRawUnit(ygm: Record<string, unknown>, yg: Record<string, unknown>): "cm" | "in" {
  return (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";
}

function gaugeRawCounts(ygm: Record<string, unknown>, yg: Record<string, unknown>): { stitches: string; rows: string } {
  const stitches =
    (ygm && ygm.gaugeStitchRaw != null ? String(ygm.gaugeStitchRaw) : "") ||
    (yg && yg.gaugeStitchRaw != null ? String(yg.gaugeStitchRaw) : "");
  const rows =
    (ygm && ygm.gaugeRowRaw != null ? String(ygm.gaugeRowRaw) : "") ||
    (yg && yg.gaugeRowRaw != null ? String(yg.gaugeRowRaw) : "");
  return { stitches: stitches.trim(), rows: rows.trim() };
}

function formatDisplayNumber(value: unknown, decimals = 2): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(n)) return "";
  const rounded = n.toFixed(decimals);
  return rounded.replace(/\.?0+$/, "");
}

function getPrintMeasurementUnit(ygm: Record<string, unknown>, yg: Record<string, unknown>): "in" | "cm" {
  // Keep print measurements aligned with the saved pattern/unit context,
  // not transient browser-local toggle state.
  return (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";
}

function formatMeasurementWithUnit(value: unknown, unit: "in" | "cm"): string {
  const inches = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(inches) || inches <= 0) return "";
  if (unit === "cm") {
    const cm = inches * 2.54;
    return `${formatDisplayNumber(cm, 1)} cm`;
  }
  return `${formatDisplayNumber(inches, 2)} in`;
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

function garmentShapeLengthPhrase(st: Record<string, unknown>): string {
  const shapeKey = st.bodyShape;
  const lenKey = st.length;

  if (shapeKey === "straight") return "straight body";
  if (shapeKey === "aline") return "A-line body";

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

function necklineIntroPhrase(st: Record<string, unknown>): string {
  const k = st.neckline;
  if (k === "round") return "a round neck";
  if (k === "v") return "a v-neck";
  return "";
}

function frontIntroPhrase(st: Record<string, unknown>): string {
  const k = st.frontStyle;
  if (k === "closed") return "pullover front";
  if (k === "open") return "cardigan front";
  return "";
}

function isExpressPatternMode(st: Record<string, unknown>): boolean {
  return String(st.patternMode ?? "").trim().toLowerCase() === "express";
}

function buildPatternIntroSentence(merged: Record<string, unknown>, patternData: Record<string, unknown>): string {
  const st = section(merged.style);
  const ft = section(merged.fit);
  const yg = section(merged.yarnGauge);
  const ygm =
    patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
      ? section(patternData.yarnGaugeMachine)
      : {};

  const aud = audienceLabelFromPattern(st, ft);
  const size = ft.selectedSize != null && String(ft.selectedSize).trim() ? String(ft.selectedSize).trim() : "";
  const garment = garmentShapeLengthPhrase(st);
  const neck = necklineIntroPhrase(st);
  const front = frontIntroPhrase(st);
  const gaugeStr = formatGaugeIntroPhrase(ygm, yg);

  const yarnName =
    typeof yg.yarnName === "string" && yg.yarnName.trim()
      ? yg.yarnName.trim()
      : typeof yg.yarnNotes === "string" && yg.yarnNotes.trim()
        ? yg.yarnNotes.trim()
        : typeof ygm.yarnNotes === "string" && ygm.yarnNotes.trim()
          ? ygm.yarnNotes.trim()
          : "";

  const needlesRaw = ygm.availableNeedles ?? section(merged.machine).availableNeedles;
  const needles = needlesRaw != null && String(needlesRaw).trim() ? String(needlesRaw).trim() : "";

  const audienceSize =
    aud && size ? `${aud} size ${size}` : aud ? aud : size ? `size ${size}` : "";

  const neckFront = [neck, front].filter(Boolean);
  let bodyPhrase = "";
  if (garment && neckFront.length) bodyPhrase = `${garment} with ${neckFront.join(" and ")}`;
  else if (garment) bodyPhrase = garment;
  else if (neckFront.length) bodyPhrase = `with ${neckFront.join(" and ")}`;

  let s = "";
  if (audienceSize) s += audienceSize;
  if (bodyPhrase) {
    if (s) s += ", ";
    s += bodyPhrase;
  }

  if (gaugeStr) {
    if (s) s += ", ";
    s += `knit at ${gaugeStr}`;
  }

  if (yarnName) {
    if (s) s += " ";
    s += `using ${yarnName}`;
  }

  if (needles && !isExpressPatternMode(st)) {
    if (s) s += " ";
    s += `on a ${needles}-needle machine`;
  }

  if (s && !s.endsWith(".")) s += ".";
  return s;
}

function printFinishingPlaceholderHtml(): string {
  return `<section class="print-major print-finishing" aria-labelledby="print-finishing-heading">
  <h2 id="print-finishing-heading" class="print-heading-major print-heading-with-checkbox"><span class="print-heading-checkbox" aria-hidden="true"></span><span class="print-heading-label">Finishing</span></h2>
  <ol class="print-finishing-list">
    <li>Optional: block pieces to measurements; allow to dry.</li>
    <li>Join shoulders with your preferred method.</li>
    <li>Work neckline and armhole trims to match your yarn and tension.</li>
    <li>Join side seams from hem toward underarm, matching edges.</li>
    <li>Weave in ends; lightly steam if needed.</li>
  </ol>
  <p class="print-muted">The online version of this pattern includes videos and glossary help.</p>
</section>`;
}

function buildSummaryDl(merged: Record<string, unknown>, patternData: Record<string, unknown>): string {
  const st = section(merged.style);
  const ft = section(merged.fit);
  const yg = section(merged.yarnGauge);
  const ygm =
    patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
      ? section(patternData.yarnGaugeMachine)
      : {};
  const sm = section(ft.selectedMeasurements);
  const measurementUnit = getPrintMeasurementUnit(ygm, yg);

  const rows: { term: string; def: string }[] = [];

  const aud = audienceLabelFromPattern(st, ft);
  const size = ft.selectedSize != null && String(ft.selectedSize).trim() ? String(ft.selectedSize).trim() : "";
  if (aud || size) {
    const parts: string[] = [];
    if (aud) parts.push(escapeHtml(aud));
    if (size) parts.push(`chart size ${escapeHtml(size)}`);
    rows.push({
      term: "Size",
      def: parts.join(" — ") || "—",
    });
  }

  const bust = sm.finished_bust_chest;
  if (bust != null && String(bust).trim()) {
    const formatted = formatMeasurementWithUnit(bust, measurementUnit);
    rows.push({ term: "Finished bust / chest", def: escapeHtml(formatted || String(bust).trim()) });
  }

  const bnth = sm.back_neck_to_hem;
  if (bnth != null && String(bnth).trim()) {
    const formatted = formatMeasurementWithUnit(bnth, measurementUnit);
    rows.push({ term: "Back neck to hem", def: escapeHtml(formatted || String(bnth).trim()) });
  }

  const ad = sm.armhole_depth;
  if (ad != null && String(ad).trim()) {
    const formatted = formatMeasurementWithUnit(ad, measurementUnit);
    rows.push({ term: "Armhole depth", def: escapeHtml(formatted || String(ad).trim()) });
  }

  const gaugeStr = formatGaugeFromBuilderExact(ygm, yg);
  if (gaugeStr) {
    rows.push({ term: "Gauge (from builder)", def: escapeHtml(gaugeStr) });
  }

  const gaugeBasis = gaugeBasisFromRawUnit(ygm, yg);
  const rawGauge = gaugeRawCounts(ygm, yg);
  const basisLabel = gaugeBasis === "cm" ? "10 cm" : "4 in";
  if (rawGauge.stitches) {
    rows.push({
      term: `Stitches per ${basisLabel}`,
      def: escapeHtml(rawGauge.stitches),
    });
  }
  if (rawGauge.rows) {
    rows.push({
      term: `Rows per ${basisLabel}`,
      def: escapeHtml(rawGauge.rows),
    });
  }

  const needles = ygm.availableNeedles ?? section(merged.machine).availableNeedles;
  if (needles != null && String(needles).trim()) {
    rows.push({ term: "Machine needles", def: escapeHtml(String(needles).trim()) });
  }

  const yarnLabel =
    typeof yg.yarnName === "string" && yg.yarnName.trim()
      ? yg.yarnName.trim()
      : typeof ygm.yarnNotes === "string" && ygm.yarnNotes.trim()
        ? String(ygm.yarnNotes).trim()
        : "";
  if (yarnLabel) {
    rows.push({ term: "Yarn notes", def: escapeHtml(yarnLabel) });
  }

  if (rows.length === 0) {
    return `<p class="print-muted">No summary details were stored — complete the builder and reload this page.</p>`;
  }

  const dtdd = rows
    .map((r) => `<dt>${escapeHtml(r.term)}</dt><dd>${r.def}</dd>`)
    .join("");
  return `<dl class="print-summary-dl">${dtdd}</dl>`;
}

function renderNotReady(missing: { label: string; href?: string }[]): string {
  const list = missing
    .map((m) => {
      if (m.href) {
        return `<li>${escapeHtml(m.label)} — <a href="${escapeHtml(m.href)}">Fix in builder</a></li>`;
      }
      return `<li>${escapeHtml(m.label)}</li>`;
    })
    .join("");
  return `<div class="print-error" role="alert">
  <p><strong>Pattern data is incomplete.</strong> Open the sleeveless builder and fill in the required fields, then return to this page.</p>
  <ul>${list}</ul>
  <p><a href="/patterns/sleeveless/pattern?buildStep=yarn">Go to sleeveless pattern builder</a></p>
</div>`;
}

let sleevelessPrintBtnBound = false;

function bindPrintButton(): void {
  if (sleevelessPrintBtnBound) return;
  const btn = document.querySelector("[data-sleeveless-print-action]");
  if (!(btn instanceof HTMLButtonElement)) return;
  sleevelessPrintBtnBound = true;
  btn.addEventListener("click", () => window.print());
}

let sleevelessPrintStorageBound = false;

function ensureSleevelessPrintStorageListener(): void {
  if (sleevelessPrintStorageBound) return;
  sleevelessPrintStorageBound = true;
  const canonKey = getPatternStorageKey();
  window.addEventListener("storage", (e) => {
    if (!e.key || (e.key !== PATTERN_BUILDER_DATA_KEY && e.key !== canonKey)) return;
    initSleevelessPrintPage();
  });
}

function isBetaFixedPrintRoute(): boolean {
  return Boolean(document.querySelector('[data-sleeveless-print-fixed="beta"]'));
}

async function initSleevelessPrintPage(): Promise<void> {
  bindPrintButton();
  const betaFixed = isBetaFixedPrintRoute();
  if (!betaFixed) {
    ensureSleevelessPrintStorageListener();
  }

  const root = document.querySelector("[data-sleeveless-print-root]");
  if (!(root instanceof HTMLElement)) return;

  let patternMerged: Record<string, unknown>;
  let patternData: Record<string, unknown>;
  let genInput: Record<string, unknown>;

  if (betaFixed) {
    const canon = getSleevelessGoldenBetaCanonicalPattern();
    const goldenPb = getSleevelessGoldenBetaPatternBuilderData();
    patternMerged = mergedPatternForDisplayFromSources(canon as unknown as Record<string, unknown>, goldenPb);
    patternData = goldenPb;
    const goldenValidation = validatePatternBuilderRequired(goldenPb);
    if (!goldenValidation.ok) {
      root.innerHTML = renderNotReady(goldenValidation.missingItems);
      return;
    }
    genInput = buildGeneratorPatternDataFromSources(patternMerged, goldenPb);
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[sleeveless beta-print] generator input", JSON.parse(JSON.stringify(genInput)));
    }
  } else {
    patternMerged = mergedPatternForDisplay(getCurrentPattern() as unknown as Record<string, unknown>);
    patternData = getPatternData();
    const validation = validatePatternBuilderRequired(patternData);
    if (!validation.ok) {
      root.innerHTML = renderNotReady(validation.missingItems);
      return;
    }
    genInput = buildGeneratorPatternData(patternMerged);
  }
  const result = generateSleevelessBackPattern(genInput);
  const intro = buildPatternIntroSentence(patternMerged, patternData);

  const yg = section(patternMerged.yarnGauge);
  const ygm =
    patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
      ? section(patternData.yarnGaugeMachine)
      : {};
  const unit: "cm" | "in" =
    (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";

  /**
   * RC:000 = first row of the armhole block (Armhole RC). Neckline intros use the bind-off milestone;
   * shoulder checklist tables restart verbal RC at RC:000 after “Reset Shoulder RC…”.
   */
  const backLocalStartRc = Number.isFinite(result?.debug?.backNecklineStartLocalRC)
    ? Math.max(0, Math.floor(result.debug.backNecklineStartLocalRC ?? 0))
    : 0;
  const frontLocalStartRc = Number.isFinite(result?.debug?.frontNecklineStartLocalRC)
    ? Math.max(0, Math.floor(result.debug.frontNecklineStartLocalRC ?? 0))
    : 0;
  const backLocalStartLabel = `RC:${String(backLocalStartRc).padStart(3, "0")}`;
  const frontLocalStartLabel = `RC:${String(frontLocalStartRc).padStart(3, "0")}`;

  // Active-shoulder intro: center bind-off uses `formatActiveShoulderCenterNecklinePlainSentence`; checklist RC starts at 000.
  const backChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
    result.neckShoulderShapingChart,
    "ns-shaping-chart-print-back",
    renderActiveShoulderChartIntroHtml({
      localStartRcLabel: backLocalStartLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.neckShoulderShapingChart),
      wrapperClass: "print-chart-intro",
      layout: "compact",
    }),
    { activeSideRcStart: 0 },
  );
  const frontChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
    result.frontNeckShoulderShapingChart,
    "ns-shaping-chart-print-front",
    renderActiveShoulderChartIntroHtml({
      localStartRcLabel: frontLocalStartLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.frontNeckShoulderShapingChart),
      wrapperClass: "print-chart-intro",
      layout: "compact",
    }),
    { activeSideRcStart: 0 },
  );

  const { preludeRows, continuationRows } = splitRowsBeforeNeckShoulderChartMount(result.displayRows ?? []);
  const openingBackHtml = renderSleevelessPrintPieceHtml(preludeRows, "");
  const continuationBackHtml =
    continuationRows.length > 0
      ? renderSleevelessPrintPieceHtml(continuationRows, backChartHtml)
      : "";

  let diagramMarkup = `<p class="print-muted print-diagram-fallback">Loading back schematic…</p>`;
  try {
    diagramMarkup = await loadSleevelessBackDiagramSvgMarkup(result, genInput, unit);
  } catch {
    diagramMarkup = `<p class="print-muted print-diagram-fallback">Back schematic could not be loaded.</p>`;
  }
  let frontDiagramMarkup = `<p class="print-muted print-diagram-fallback">Loading front schematic…</p>`;
  try {
    frontDiagramMarkup = await loadSleevelessFrontDiagramSvgMarkup(result, genInput, unit);
  } catch {
    frontDiagramMarkup = `<p class="print-muted print-diagram-fallback">Front schematic could not be loaded.</p>`;
  }

  const {
    preludeRows: frontPreludeRows,
    continuationRows: frontContinuationRows,
  } = splitRowsBeforeNeckShoulderChartMount(result.frontDisplayRows ?? []);
  const frontOpeningHtml = renderSleevelessPrintPieceHtml(frontPreludeRows, "");
  const frontContinuationHtml =
    frontContinuationRows.length > 0
      ? renderSleevelessPrintPieceHtml(frontContinuationRows, frontChartHtml)
      : "";

  const warningsFiltered = warningsForSleevelessPrintPrintout(result.warnings);
  const warnings =
    warningsFiltered.length > 0
      ? `<aside class="print-warnings" role="status"><strong>Note:</strong> ${escapeHtml(warningsFiltered.join(" "))}</aside>`
      : "";

  root.innerHTML = `
<div class="print-doc-inner">
  <section class="print-page-first" aria-label="Pattern overview and start of back">
    <header class="print-doc-header">
      <div class="print-doc-header-brand">
        <div class="print-doc-header-mark" aria-hidden="true">
          <img
            class="print-doc-header-logo"
            src="/images/patterns/kin-print-header.svg"
            alt=""
            width="2814"
            height="616"
            loading="eager"
            decoding="async"
          />
        </div>
        <div class="print-doc-header-divider" role="presentation" aria-hidden="true"></div>
        <div class="print-doc-header-main">
          <h1 class="print-doc-title">Custom Sleeveless Sweater</h1>
          <p class="print-doc-subtitle">${escapeHtml(intro)}</p>
        </div>
      </div>
      ${warnings}
    </header>

    <div class="print-hero-band">
      <div class="print-hero-summary">
        <h2 class="print-heading-major print-heading-major--hero">At a glance</h2>
        ${buildSummaryDl(patternMerged, patternData)}
      </div>
      <figure class="print-hero-figure">
        <img
          class="print-hero-img"
          src="/images/patterns/sleeveless/sleeveless-sweater-pattern-builder.png"
          width="640"
          height="640"
          alt=""
          loading="eager"
          decoding="async"
        />
      </figure>
    </div>

    <div class="print-opening-band">
      <div class="print-opening-prose">
        ${openingBackHtml}
      </div>
      <aside class="print-opening-diagram" aria-label="Back schematic">
        <div class="print-opening-diagram-inner">${diagramMarkup}</div>
        <p class="print-diagram-caption">Back schematic</p>
      </aside>
    </div>
  </section>

  ${
    continuationBackHtml
      ? `<section class="print-major print-back print-back--continuation" aria-label="Back instructions continued">${continuationBackHtml}</section>`
      : ""
  }

  <section class="print-major print-front" aria-label="Front instructions">
    <div class="print-opening-band">
      <div class="print-opening-prose">
        ${frontOpeningHtml}
      </div>
      <aside class="print-opening-diagram" aria-label="Front schematic">
        <div class="print-opening-diagram-inner">${frontDiagramMarkup}</div>
        <p class="print-diagram-caption">Front schematic</p>
      </aside>
    </div>
    ${frontContinuationHtml}
  </section>

  ${printFinishingPlaceholderHtml()}
</div>`;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initSleevelessPrintPage());
} else {
  void initSleevelessPrintPage();
}
