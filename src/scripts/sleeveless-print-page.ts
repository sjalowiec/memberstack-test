/**
 * Client entry: loads saved builder data (same keys as pattern tab), runs {@link generateSleevelessBackPattern}.
 */

import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  getPatternStorageKey,
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
  armholeLocalRcActiveShoulderChecklistStart,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "../lib/patterns/neckShoulderShapingChartHtml.ts";
import {
  loadSleevelessBackDiagramSvgMarkup,
  loadSleevelessFrontDiagramSvgMarkup,
} from "../lib/patterns/sleevelessPrintDiagramSvg.ts";
import { resolveSleevelessFrontDiagram } from "../lib/patterns/sleevelessFrontDiagramSrc.ts";
import {
  renderSleevelessPrintPieceHtml,
  splitRowsBeforeNeckShoulderChartMount,
} from "../lib/patterns/sleevelessPatternPrintRender.ts";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate.ts";
import { buildSleevelessPrintBasicsSummaryDlHtml } from "../lib/patterns/sleevelessPrintBasicsSummaryHtml.ts";
import { sleevelessFinishingFromPattern } from "../lib/patterns/sleevelessPatternFinishing.ts";
import { buildSleevelessFinishingPrintListHtml } from "../lib/patterns/sleevelessPatternFinishingHtml.ts";
import {
  hydratePatternPrintPersonalizationSlotsFromSession,
  triggerPatternPrint,
} from "./patternPrintPersonalization.ts";

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
  return buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
}

function printFinishingSectionHtml(
  patternMerged: Record<string, unknown>,
  debug: { frontNecklineStartRC?: number; cardiganFrontEdgePickupSts?: number },
): string {
  const finishing = sleevelessFinishingFromPattern(patternMerged, debug);
  const listItems = buildSleevelessFinishingPrintListHtml({
    isCardigan: finishing.isCardigan,
    cardiganFrontEdgeFinishingMode: finishing.cardiganFrontEdgeFinishingMode,
    frontEdgePickupSts: finishing.frontEdgePickupSts,
  });
  return `<section class="print-major print-finishing" aria-labelledby="print-finishing-heading">
  <h2 id="print-finishing-heading" class="print-heading-major print-heading-with-checkbox"><span class="print-heading-checkbox" aria-hidden="true"></span><span class="print-heading-label">Finishing</span></h2>
  <ol class="print-finishing-list">
    ${listItems}
  </ol>
  <p class="print-muted">The online version of this pattern includes videos and glossary help.</p>
</section>`;
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
  btn.addEventListener("click", () => triggerPatternPrint(btn));
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

  const yg = section(patternMerged.yarnGauge);
  const ygm =
    patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
      ? section(patternData.yarnGaugeMachine)
      : {};
  const unit: "cm" | "in" =
    (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";

  /** RC at center bind-off milestone (Armhole RC). Checklist rows continue from the same counter as the armhole section. */
  const backLocalStartRc = Number.isFinite(result?.debug?.backNecklineStartLocalRC)
    ? Math.max(0, Math.floor(result.debug.backNecklineStartLocalRC ?? 0))
    : 0;
  const frontLocalStartRc = Number.isFinite(result?.debug?.frontNecklineStartLocalRC)
    ? Math.max(0, Math.floor(result.debug.frontNecklineStartLocalRC ?? 0))
    : 0;
  const backLocalStartLabel = `RC:${String(backLocalStartRc).padStart(3, "0")}`;
  const frontLocalStartLabel = `RC:${String(frontLocalStartRc).padStart(3, "0")}`;

  const armholeGarmentStart = result?.debug?.armholeStartRow;
  const backChecklistArmholeStart = armholeLocalRcActiveShoulderChecklistStart(
    result.neckShoulderShapingChart,
    armholeGarmentStart,
  );
  const frontChecklistArmholeStart = armholeLocalRcActiveShoulderChecklistStart(
    result.frontNeckShoulderShapingChart,
    armholeGarmentStart,
  );

  const backChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
    result.neckShoulderShapingChart,
    "ns-shaping-chart-print-back",
    renderActiveShoulderChartIntroHtml({
      localStartRcLabel: backLocalStartLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.neckShoulderShapingChart),
      chart: result.neckShoulderShapingChart,
      wrapperClass: "print-chart-intro",
      layout: "compact",
    }),
    {
      activeSideRcStart: backChecklistArmholeStart,
    },
  );
  const frontChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
    result.frontNeckShoulderShapingChart,
    "ns-shaping-chart-print-front",
    renderActiveShoulderChartIntroHtml({
      localStartRcLabel: frontLocalStartLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.frontNeckShoulderShapingChart),
      chart: result.frontNeckShoulderShapingChart,
      wrapperClass: "print-chart-intro",
      layout: "compact",
    }),
    {
      activeSideRcStart: frontChecklistArmholeStart,
    },
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

  const frontDiagramRouting = resolveSleevelessFrontDiagram(genInput);
  const frontPrintDiagramCaption =
    frontDiagramRouting.diagramType === "cardiganHalfFrontRound" ||
    frontDiagramRouting.diagramType === "cardiganHalfFrontV"
      ? "Left front schematic (development)"
      : frontDiagramRouting.garmentStyle === "cardigan"
        ? "Cardigan front schematic"
        : "Front schematic";

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
        <div class="print-doc-header-main print-doc-header-main--letterhead-only">
          <span class="print-doc-header-sr-only">Sleeveless sweater pattern</span>
        </div>
      </div>
      ${warnings}
    </header>

    <div class="print-hero-band">
      <div class="print-hero-visual">
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
      <div class="print-hero-summary">
        <div class="pattern-print-personalization-title" data-pattern-print-personalization-title hidden></div>
        <div class="print-hero-summary-basics">
          <h2 class="print-heading-major print-heading-major--hero">At a glance</h2>
          ${buildSleevelessPrintBasicsSummaryDlHtml(patternMerged, patternData)}
        </div>
        <div class="pattern-print-personalization-notes" data-pattern-print-personalization-notes hidden></div>
      </div>
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
        <p class="print-diagram-caption">${escapeHtml(frontPrintDiagramCaption)}</p>
      </aside>
    </div>
    ${frontContinuationHtml}
  </section>

  ${printFinishingSectionHtml(patternMerged, result.debug)}
</div>`;

  hydrateGlossaryTooltipPlaceholders(root);
  hydratePatternPrintPersonalizationSlotsFromSession();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initSleevelessPrintPage());
} else {
  void initSleevelessPrintPage();
}
