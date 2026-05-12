// @ts-nocheck
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
import { setPatternTabsReadiness } from "../lib/patterns/patternTabsClient.ts";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "../lib/patterns/sleevelessPatternOutput.ts";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingDiagramOnlyHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "../lib/patterns/neckShoulderShapingChartHtml.ts";
import { showResults, initializeActionBar } from "../components/wizards/utils/wizardBehavior.ts";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate.ts";
import { getSleevelessFrontDiagramSrc } from "../lib/patterns/sleevelessFrontDiagramSrc.ts";
import {
  buildSleevelessPrintBasicsSummaryDlHtml,
  buildSleevelessScreenBasicsSummaryDlHtml,
  formatGaugeIntroPhrase,
} from "../lib/patterns/sleevelessPrintBasicsSummaryHtml.ts";

/** Canonical Vimeo help clips for sleeveless pattern pages (modal + optional jump links). */
export const SLEEVELESS_HELP_VIDEOS = {
  roundNeckShaping: {
    id: "151858551",
    embedUrl:
      "https://player.vimeo.com/video/151858551?badge=0&autopause=0&autoplay=1&player_id=0&app_id=58479",
    title: "Round neck shaping",
    description: "Review the basic steps for shaping a round neckline.",
    jumpLinks: [
      { label: "Sample Neckline overview", seconds: 44 },
      { label: "Knitting Instructions", seconds: 96 },
      { label: "Scrap off", seconds: 217 },
      { label: "Rehang one side", seconds: 262 },
      { label: "Shape the neckline edge (first side)", seconds: 294 },
      { label: "Bind off the shoulder (1st side)", seconds: 316 },
      { label: "Center Stitches", seconds: 321 },
      { label: "Shape the 2nd Neck edge", seconds: 390 },
      { label: "Bind off shoulders (2nd side)", seconds: 406 },
    ],
  },
  shallowBackNeck: {
    id: "252565241",
    embedUrl:
      "https://player.vimeo.com/video/252565241?badge=0&autopause=0&autoplay=1&player_id=0&app_id=58479",
    title: "Short row shoulder shaping",
    description: "Use this when the back neck is shallow or when short-row shaping is involved.",
    jumpLinks: [
      { label: "Add a lifeline", seconds: 20 },
      { label: "Start the shaping", seconds: 42 },
      { label: "Center and left side in hold", seconds: 71 },
      { label: "Start shaping the shoulder", seconds: 91 },
      { label: "Neck edge decrease", seconds: 123 },
      { label: "Shape the shoulder", seconds: 143 },
      { label: "Neck edge decrease", seconds: 169 },
      { label: "Shoulder shaping", seconds: 202 },
      { label: "Shoulder shaping", seconds: 229 },
      { label: "Why short row the shoulder?", seconds: 274 },
      { label: "Finish shoulder, scrap off", seconds: 281 },
      { label: "Scrap off the center stitches", seconds: 353 },
      { label: "Shape the other shoulder", seconds: 389 },
    ],
  },
  onePieceBand: {
    id: "1189760201",
    title: "One-piece neckband",
    description: "Review how to finish the neckline with a one-piece band.",
    jumpLinks: [
      { label: "One piece band", seconds: 31 },
      { label: "Mark the curve", seconds: 44 },
      { label: "Secure the knitting", seconds: 50 },
      { label: "Measure the neck opening", seconds: 64 },
      { label: "Estimate the neckband needles", seconds: 78 },
      { label: "Grading is essential", seconds: 109 },
      { label: "Single band: fold to the inside", seconds: 193 },
      { label: "Stitch the band (private side)", seconds: 211 },
      { label: "Tip", seconds: 253 },
      { label: "Single band: fold to the public side", seconds: 279 },
    ],
  },
  /** Catalog content_id 520 / slug seaming-putting-it-all-together — same Vimeo id site-wide. */
  seamingPuttingItAllTogether: {
    id: "151858422",
    embedUrl:
      "https://player.vimeo.com/video/151858422?badge=0&autopause=0&autoplay=1&player_id=0&app_id=58479",
    title: "Seaming – Putting It All Together",
    description: "",
    jumpLinks: [
      { label: "Seaming on the machine", seconds: 13 },
      { label: "Mattress stitch basics", seconds: 176 },
      { label: "Optional mattress stitch method", seconds: 229 },
      { label: "Tips for perfect seams", seconds: 252 },
    ],
  },
};

const AUDIENCE_LABELS = SLEEVELESS_CHART_AUDIENCE_LABELS;

  const resultsVisibilityConfig = {
    resultsSelector: "#sg-sleeveless-results",
    actionBarSelector: "#action-bar",
    printButtonSelector: "#print-btn",
    printFooterSelector: "#print-footer",
  };

  function section(obj) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return /** @type {Record<string, unknown>} */ (obj);
    }
    return {};
  }

  function mergedPatternForDisplay(base) {
    return mergedPatternForDisplayFromSources(base, getPatternData());
  }

  /** Shape expected by {@link generateSleevelessBackPattern}. */
  function buildGeneratorPatternData(merged) {
    return buildGeneratorPatternDataFromSources(merged, getPatternData());
  }

  function audienceLabelFromPattern(st, ft) {
    const raw =
      (typeof st.recipientCategory === "string" && st.recipientCategory.trim()) ||
      (typeof ft.sizingChart === "string" && ft.sizingChart.trim()) ||
      "";
    const key = raw.toLowerCase();
    if (key && AUDIENCE_LABELS[key]) return AUDIENCE_LABELS[key];
    if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    return "";
  }

  function getSleevelessAudienceHeroImage(audience) {
    switch (String(audience || "").trim().toLowerCase()) {
      case "baby":
        return "/images/patterns/sleeveless/sleeveless_baby.png";
      case "man":
      case "men":
      case "male":
        return "/images/patterns/sleeveless/sleeveless_man.png";
      case "kids":
      case "kid":
      case "children":
        return "/images/patterns/sleeveless/sleeveless_kids.png";
      case "woman":
      case "women":
      case "misses":
      case "plus":
      default:
        return "/images/patterns/sleeveless/sleeveless_woman.png";
    }
  }

  function updateSleevelessAudienceHero(patternMerged) {
    const st = section(patternMerged.style);
    const ft = section(patternMerged.fit);
    const audience =
      (typeof st.recipientCategory === "string" && st.recipientCategory.trim()) ||
      (typeof ft.sizingChart === "string" && ft.sizingChart.trim()) ||
      "";
    const hero = document.querySelector("[data-sleeveless-audience-hero]");
    if (hero instanceof HTMLImageElement) {
      hero.src = getSleevelessAudienceHeroImage(audience);
    }
  }

  function garmentShapeLengthPhrase(st) {
    const shapeKey = st.bodyShape;
    const lenKey = st.length;

    if (shapeKey === "straight") return "straight body";
    if (shapeKey === "aline") return "A-line body";

    const shapeWord =
      shapeKey === "gathered"
        ? "gathered"
        : shapeKey
          ? String(shapeKey)
          : "";
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

  function necklineIntroPhrase(st) {
    const k = st.neckline;
    if (k === "round") return "a round neck";
    if (k === "v" || k === "v-neck") return "a v-neck";
    return "";
  }

  function frontIntroPhrase(st) {
    const k = st.frontStyle;
    if (k === "closed") return "pullover front";
    if (k === "open") return "cardigan front";
    return "";
  }

  /**
   * One-line pattern intro from {@link getCurrentPattern}-aligned merged data and {@link getPatternData}.
   */
  function buildPatternIntroSentence(merged, patternData) {
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

    if (s && !s.endsWith(".")) s += ".";
    return s;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Intro + collapsible help beneath the chart heading (same HTML intro as print/PDF via `renderActiveShoulderChartIntroHtml`).
   * @param {string | undefined} startRowLabel Armhole RC at center bind-off (chart row 0), e.g. `RC:117`.
   * @param {import("../lib/patterns/neckShoulderShapingChart").NeckShoulderShapingChart | undefined} chart
   * @param {'back' | 'front'} _piece Reserved for callers (back vs front); shared tip markup for both.
   */
  function neckShoulderChartHelpRowHtml(startRowLabel, chart, _piece) {
    const intro = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: String(startRowLabel ?? "").trim(),
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(chart),
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
    });
    const necklineTipVideoButtons = `<div class="pattern-finishing-video-help__links sleeveless-neckline-tip__video-links">
  <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="roundNeckShaping" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Round neck shaping</button>
  <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="shallowBackNeck" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Short row shoulder shaping</button>
</div>`;
    const necklineTipLead = `<p>Many knitters prefer to use ${glossaryTooltip(250, "Short Rows")} to shape shoulders because they create a smoother edge and help prevent ${glossaryTooltip(902, "stair steps")} caused by bind-offs.</p>`;
    return `${intro}
<details class="pattern-tip sleeveless-shaping-help-toggle no-print">
  <summary>New to shaping necklines on the machine?</summary>
  ${necklineTipLead}
  <p class="sleeveless-neckline-tip__short-rows-prompt">New to ${glossaryTooltip(250, "Short Rows")}?</p>
  ${necklineTipVideoButtons}
</details>`;
  }

  /**
   * Renders structured rows: left column RC + text, right column total sts only when it changes.
   * Chart table stays in the left column; shape preview mounts below the two-column piece split.
   * @param {unknown[]} rows
   * @param {string} chartTableMountId
   * @param {string} chartDiagramMountId
   */
  function renderSleevelessDisplayHtml(
    rows,
    chartTableMountId,
    chartDiagramMountId,
    pieceSectionId,
    patternIntroSentence,
    neckChartStartRow,
    displayOpts
  ) {
    const omitPieceBanner = displayOpts && displayOpts.omitPieceBanner === true;
    const list = Array.isArray(rows) ? rows : [];
    let lastShownStitch;
    let currentPiece = "";
    /** @type {string[]} */
    const splitParts = [];
    /** @type {string[]} */
    const postParts = [];
    /** @type {string | null} */
    let openSectionSlugSource = null;
    /** @type {string | null} */
    let openSectionDisplayHeading = null;
    let openSectionIsPost = false;
    /** @type {string[]} */
    let openSectionParts = [];
    const NECK_SHOULDER_SECTION_RE = /NECKLINE\s*&\s*SHOULDERS/i;

    function flushOpenSection() {
      if (!openSectionSlugSource) return;
      const sectionSlug = openSectionSlugSource
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const headingHtml = openSectionDisplayHeading ?? openSectionSlugSource;
      const targetParts = openSectionIsPost ? postParts : splitParts;
      targetParts.push(
        wrapPatternSection(
          `sg-${pieceSectionId}-${sectionSlug || "section"}`,
          headingHtml,
          openSectionParts.join(""),
          {
            defaultCollapsed: false,
            sectionClassName: openSectionIsPost
              ? "pattern-subsection sleeveless-piece-chart-fullwidth"
              : "pattern-subsection",
          }
        )
      );
      openSectionSlugSource = null;
      openSectionDisplayHeading = null;
      openSectionIsPost = false;
      openSectionParts = [];
    }

    /**
     * @param {Extract<(typeof list)[number], { kind: "block" }>} row
     */
    function instructionRowHtml(row) {
      const showStitch =
        row.stitchCount !== undefined &&
        (lastShownStitch === undefined || row.stitchCount !== lastShownStitch);
      if (showStitch) lastShownStitch = row.stitchCount;

      const leftBits = [];
      if (row.rc) {
        leftBits.push(`<p class="sleeveless-pattern-rc">${escapeHtml(row.rc)}</p>`);
      }
      for (const p of row.paragraphs) {
        const t = String(p).trim();
        if (t) leftBits.push(`<p class="sleeveless-pattern-line">${escapeHtml(t)}</p>`);
      }
      if (row.tipHtml) {
        leftBits.push(`<div class="pattern-tip" data-tip><strong>Tip:</strong> ${row.tipHtml}</div>`);
      }
      if (row.collapsibleTipHtml) {
        leftBits.push(row.collapsibleTipHtml);
      }
      const leftHtml = `<div class="sleeveless-pattern-left">${leftBits.join("")}</div>`;
      const rightHtml = showStitch
        ? `<div class="sleeveless-pattern-sts">${row.stitchCount} sts</div>`
        : "";
      const rowClass = rightHtml ? "sleeveless-pattern-row" : "sleeveless-pattern-row sleeveless-pattern-row--full";
      return `<div class="${rowClass}">${leftHtml}${rightHtml}</div>`;
    }

    for (const row of list) {
      if (row.kind === "piece") {
        flushOpenSection();
        currentPiece = row.title;
        if (!omitPieceBanner) {
          const chunk = `<h2 class="sleeveless-pattern-piece">${escapeHtml(row.title)}</h2>`;
          splitParts.push(chunk);
        }
        continue;
      }
      if (row.kind === "section") {
        flushOpenSection();
        const rawTitle = String(row.title || "");
        openSectionSlugSource = escapeHtml(rawTitle);
        openSectionDisplayHeading =
          /^\s*armhole\s*$/i.test(rawTitle) && pieceSectionId === "front"
            ? escapeHtml("FRONT ARMHOLE")
            : /^\s*armhole\s*$/i.test(rawTitle)
              ? escapeHtml("BACK ARMHOLE")
              : openSectionSlugSource;
        openSectionIsPost = NECK_SHOULDER_SECTION_RE.test(rawTitle);
        continue;
      }
      if (row.kind === "neckShoulderChartTableMount") {
        const printPatternTitle = "Sleeveless Sweater Pattern";
        const intro = String(patternIntroSentence || "").trim();
        const printIntro = intro
          ? intro.charAt(0).toUpperCase() + intro.slice(1)
          : "Custom sleeveless sweater pattern based on your saved builder choices.";
        const chartAreaId =
          pieceSectionId === "front"
            ? "front-neckline-shoulder-chart-print-area"
            : "neckline-shoulder-chart-print-area";
        const chartAreaOpen = `<div id="${chartAreaId}" data-second-shoulder-scope>`;
        const diagramLabel =
          pieceSectionId === "front"
            ? "Front neckline and shoulder diagram"
            : "Back neckline and shoulder diagram";
        const diagramChunk = `<aside class="sleeveless-neck-shoulder-diagram" aria-label="${escapeHtml(diagramLabel)}">
  <div class="sg-pattern-output sg-neck-chart-diagram-block" id="${escapeHtml(chartDiagramMountId)}"></div>
</aside>`;
        const chartChunk = `${chartAreaOpen}
  <div class="neckline-chart-print-only-header" aria-hidden="true">
    <p class="neckline-chart-print-only-header-title">${escapeHtml(printPatternTitle)}</p>
    <p class="neckline-chart-print-only-header-intro">Custom pattern for ${escapeHtml(printIntro)}</p>
  </div>
  <div class="sg-pattern-output sg-neck-chart-print-block" id="${escapeHtml(chartTableMountId)}"></div>
  ${diagramChunk}
  <p class="neckline-chart-print-only-footer">Created by Knit It Now · Printed <span data-neckline-chart-print-date></span></p>
</div>`;
        if (openSectionSlugSource) {
          openSectionParts.push(chartChunk);
          continue;
        }
        postParts.push(`<section class="sleeveless-piece-chart-fullwidth">${chartChunk}</section>`);
        continue;
      }
      if (row.kind === "neckShoulderChartPreviewMount") {
        continue;
      }
      if (row.kind !== "block") continue;
      const chunk = instructionRowHtml(row);
      if (openSectionSlugSource) openSectionParts.push(chunk);
      else splitParts.push(chunk);
    }
    flushOpenSection();

    const splitInner = `<div class="sleeveless-pattern-instructions">${splitParts.join("")}</div>`;
    const postSplit = postParts.join("");
    return { splitInner, postSplit };
  }

  /**
   * Two-column shell for Back/Front: prose + chart (left) and static SVG (right, sticky on desktop).
   * @param {string} innerHtml
   * @param {string} diagramSrc
   * @param {string} diagramAlt
   */
  function wrapSleevelessPieceSplit(innerHtml, diagramSrc, diagramAlt, postSplitHtml) {
    const src = escapeHtml(diagramSrc);
    const alt = escapeHtml(diagramAlt);
    const post = postSplitHtml || "";
    return `<div class="pattern-layout pattern-layout--garment-columns sleeveless-piece-split">
  <div class="pattern-layout__content sleeveless-piece-split__text">${innerHtml}</div>
  <aside class="pattern-layout__sidebar sleeveless-piece-split__diagram" aria-label="Garment diagram">
    <div class="sleeveless-piece-split__diagram-inner">
      <button type="button" class="sleeveless-piece-split__diagram-trigger" data-sleeveless-diagram-trigger aria-label="Open larger diagram: ${alt}">
        <div class="sleeveless-piece-split__diagram-svg" data-sleeveless-diagram data-src="${src}" data-alt="${alt}">
          <p class="sleeveless-pattern-boot-msg">Loading diagram…</p>
        </div>
      </button>
      <p class="sleeveless-piece-split__diagram-hint">Click diagram to enlarge</p>
    </div>
  </aside>
</div>${post}`;
  }

  function isFiniteNumber(n) {
    return typeof n === "number" && Number.isFinite(n);
  }

  function fmtNumber(n) {
    if (!isFiniteNumber(n)) return "";
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) < 1e-9) return String(rounded);
    const one = Math.round(n * 10) / 10;
    // Trim trailing .0
    return String(one).replace(/\.0$/, "");
  }

  function inchesToUnit(inches, unit) {
    if (!isFiniteNumber(inches)) return undefined;
    if (unit === "cm") return inches * 2.54;
    return inches;
  }

  function toPositiveNumber(value) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/[^\d.-]/g, ""))
          : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  function selectedMeasurementsFromPatternData(patternData) {
    const fit = section(patternData?.fit);
    return section(fit.selectedMeasurements);
  }

  function inferSleevelessDiagramPiece(src, alt) {
    const s = String(src || "").toLowerCase();
    const a = String(alt || "").toLowerCase();
    if (s.includes("diagram-back") || a.includes(" back ")) return "back";
    if (s.includes("diagram-front") || a.includes(" front ")) return "front";
    return "shared";
  }

  function resolveNeckDepthFields(result, patternData, piece, unit) {
    const d = result?.debug ?? {};
    const sm = selectedMeasurementsFromPatternData(patternData);
    const rpi = d.rowsPerInch;

    const backDepthIn = toPositiveNumber(sm.back_neck_depth);
    const frontDepthIn = toPositiveNumber(sm.front_neck_depth);

    let pieceDepthIn;
    if (piece === "back") pieceDepthIn = backDepthIn;
    else if (piece === "front") pieceDepthIn = frontDepthIn;

    // Piece-specific neckline depth wins for SVGs; fallback keeps prior behavior if missing.
    const depthInches = isFiniteNumber(pieceDepthIn) ? pieceDepthIn : d.reservedNecklineShoulderInches;
    const depthRows =
      isFiniteNumber(pieceDepthIn) && isFiniteNumber(rpi) && rpi > 0
        ? Math.max(0, Math.round(pieceDepthIn * rpi))
        : d.reservedNecklineShoulderRows;

    return {
      NECK_DEPTH_ROWS: isFiniteNumber(depthRows) ? String(Math.round(depthRows)) : "",
      NECK_DEPTH: fmtNumber(inchesToUnit(depthInches, unit)),
    };
  }

  /**
   * Build placeholder replacements for sleeveless diagrams.
   * Values are sourced from {@link SleevelessBackPatternResult.debug} where possible to avoid duplicate math.
   */
  function buildSleevelessDiagramReplacements(result, unit, opts) {
    const d = result?.debug ?? {};
    const piece = opts?.piece || "shared";
    const patternData = opts?.patternData;
    const unitLabel = unit === "cm" ? "cm" : "in";
    const neckDepth = resolveNeckDepthFields(result, patternData, piece, unit);

    const finishedBust = isFiniteNumber(d.finishedBustChest) ? d.finishedBustChest : undefined;
    const bustWidthIn = finishedBust !== undefined ? finishedBust / 2 : undefined;

    const repl = {
      UNIT: unitLabel,

      // Overall length (neck-to-hem) for the back piece.
      HEIGHT: fmtNumber(inchesToUnit(d.backNeckToHem, unit)),

      ARMHOLE_DEPTH: fmtNumber(inchesToUnit(d.armholeDepth, unit)),
      ARMHOLE_ROWS: isFiniteNumber(d.armholeRows) ? String(Math.round(d.armholeRows)) : "",

      // Width across the piece (half of finished bust/chest circumference).
      BUST_STS: isFiniteNumber(d.backStitches) ? String(Math.round(d.backStitches)) : "",
      BUST_WIDTH: fmtNumber(inchesToUnit(bustWidthIn, unit)),

      // After armhole shaping (chart uses these stitch counts).
      SHOULDER_STS: isFiniteNumber(d.stitchesAfterArmhole) ? String(Math.round(d.stitchesAfterArmhole)) : "",
      SHOULDER_WIDTH: fmtNumber(inchesToUnit(d.shoulderWidthInches, unit)),

      NECK_STS: isFiniteNumber(d.necklineStitches) ? String(Math.round(d.necklineStitches)) : "",
      NECK_WIDTH: fmtNumber(inchesToUnit(d.necklineWidthInches, unit)),

      NECK_DEPTH_ROWS: neckDepth.NECK_DEPTH_ROWS,
      NECK_DEPTH: neckDepth.NECK_DEPTH,

      // Side seam hem → underarm: hem rows + body rows (see sleevelessPatternOutput debug.bodyRows / hemRows).
      SIDE_LENGTH_ROWS:
        isFiniteNumber(d.hemRows) && isFiniteNumber(d.bodyRows)
          ? String(Math.max(0, Math.round(d.hemRows + d.bodyRows)))
          : "",
      SIDE_LENGTH: (() => {
        const rpi = d.rowsPerInch;
        if (!isFiniteNumber(rpi) || rpi <= 0) return "";
        if (!isFiniteNumber(d.hemRows) || !isFiniteNumber(d.bodyRows)) return "";
        const sideRows = Math.max(0, Math.round(d.hemRows + d.bodyRows));
        return fmtNumber(inchesToUnit(sideRows / rpi, unit));
      })(),
    };

    return repl;
  }

  async function inlineSvgWithReplacements(hostEl, src, alt, replacements) {
    if (!(hostEl instanceof HTMLElement)) return;
    try {
      const res = await fetch(src, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Failed to load SVG: ${src} (${res.status})`);
      let svgText = await res.text();
      svgText = svgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "");

      // Replace known placeholders.
      for (const [k, v] of Object.entries(replacements || {})) {
        const safeKey = String(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
        svgText = svgText.replace(re, v == null ? "" : String(v));
      }

      // If any placeholders remain, leave them as-is but log for visibility.
      if (/\{\{\s*[A-Z0-9_]+\s*\}\}/.test(svgText)) {
        console.warn("[sleeveless] Unreplaced SVG placeholders remain in", src);
      }

      const parser = new DOMParser();
      let doc = parser.parseFromString(svgText, "image/svg+xml");
      let svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
        doc = parser.parseFromString(svgText, "text/xml");
        svg = doc.documentElement;
      }
      if (!svg || svg.nodeName.toLowerCase() !== "svg") {
        const pe = doc.querySelector("parsererror");
        throw new Error(pe ? pe.textContent || "SVG parse error" : "SVG parse error");
      }

      svg.setAttribute("role", "img");
      if (alt) svg.setAttribute("aria-label", alt);
      svg.classList.add("sleeveless-piece-split__diagram-inline");

      // Match print route: inject SVG via markup string. importNode(from DOMParser doc) can fail to paint SVG in some browsers.
      hostEl.innerHTML = svg.outerHTML;
    } catch (err) {
      console.warn("[sleeveless] Diagram load failed:", err);
      hostEl.innerHTML = `<p class="sleeveless-pattern-boot-msg">Diagram unavailable.</p>`;
    }
  }

  async function hydrateSleevelessDiagrams(root, result, unit, patternData) {
    if (!root) return;
    const hosts = root.querySelectorAll("[data-sleeveless-diagram]");
    const jobs = [];
    hosts.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const src =
        el.getAttribute("data-src") || (typeof el.dataset.src === "string" ? el.dataset.src : "") || "";
      const alt = el.getAttribute("data-alt") || el.dataset.alt || "";
      if (!src) return;
      const piece = inferSleevelessDiagramPiece(src, alt);
      const replacements = buildSleevelessDiagramReplacements(result, unit, {
        piece,
        patternData,
      });
      jobs.push(inlineSvgWithReplacements(el, src, alt, replacements));
    });
    await Promise.all(jobs);
  }

  function ensureSleevelessDiagramModal() {
    let modal = document.querySelector("[data-sleeveless-diagram-modal]");
    if (modal instanceof HTMLElement) return modal;

    modal = document.createElement("div");
    modal.className = "sleeveless-diagram-modal";
    modal.hidden = true;
    modal.setAttribute("data-sleeveless-diagram-modal", "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Enlarged pattern diagram");
    modal.innerHTML = `
      <div class="sleeveless-diagram-modal__dialog" data-sleeveless-diagram-dialog>
        <button type="button" class="sleeveless-diagram-modal__close" data-sleeveless-diagram-close aria-label="Close enlarged diagram">X</button>
        <div class="sleeveless-diagram-modal__content" data-sleeveless-diagram-content></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-sleeveless-diagram-close]")) {
        closeSleevelessDiagramModal();
        return;
      }
      const clickedInsideDialog = target.closest("[data-sleeveless-diagram-dialog]");
      const clickedSvg = target.closest("svg");
      if (!clickedInsideDialog || (clickedInsideDialog && !clickedSvg)) {
        closeSleevelessDiagramModal();
      }
    });

    return modal;
  }

  function closeSleevelessDiagramModal() {
    const modal = document.querySelector("[data-sleeveless-diagram-modal]");
    if (!(modal instanceof HTMLElement)) return;
    const content = modal.querySelector("[data-sleeveless-diagram-content]");
    if (content instanceof HTMLElement) {
      content.innerHTML = "";
    }
    modal.hidden = true;
    document.body.classList.remove("sleeveless-diagram-modal-open");
  }

  function openSleevelessDiagramModal(triggerEl) {
    if (!(triggerEl instanceof HTMLElement)) return;
    const srcSvg = triggerEl.querySelector(".sleeveless-piece-split__diagram-inline");
    if (!(srcSvg instanceof SVGElement)) return;

    const modal = ensureSleevelessDiagramModal();
    const content = modal.querySelector("[data-sleeveless-diagram-content]");
    if (!(content instanceof HTMLElement)) return;

    content.innerHTML = "";
    const clone = srcSvg.cloneNode(true);
    if (clone instanceof SVGElement) {
      content.appendChild(clone);
      modal.hidden = false;
      document.body.classList.add("sleeveless-diagram-modal-open");
      const closeBtn = modal.querySelector("[data-sleeveless-diagram-close]");
      if (closeBtn instanceof HTMLElement) closeBtn.focus();
    }
  }

  /** Focus element to restore when the sleeveless Vimeo/content video modal closes. */
  let sleevelessVideoModalReturnFocus = null;

  /** One Vimeo.Player per modal iframe; cleared when the iframe node is replaced. */
  const sleevelessVimeoPlayerByIframe = new WeakMap();

  const VIMEO_PLAYER_JS = "https://player.vimeo.com/api/player.js";

  /** Resolves when `window.Vimeo.Player` is available (reuses an existing script tag when present). */
  let sleevelessVimeoPlayerJsPromise = null;
  function ensureSleevelessVimeoPlayerApiScript() {
    if (window.Vimeo?.Player) return Promise.resolve();
    if (!sleevelessVimeoPlayerJsPromise) {
      sleevelessVimeoPlayerJsPromise = new Promise((resolve, reject) => {
        const existing = Array.from(document.getElementsByTagName("script")).find(
          (s) => s.src && s.src.includes("player.vimeo.com/api/player.js")
        );
        const onReady = () => {
          if (window.Vimeo?.Player) resolve();
          else reject(new Error("Vimeo Player API unavailable"));
        };
        if (existing) {
          if (window.Vimeo?.Player) {
            onReady();
            return;
          }
          existing.addEventListener("load", onReady, { once: true });
          existing.addEventListener("error", () => reject(new Error("Vimeo Player API script error")), {
            once: true,
          });
          return;
        }
        const script = document.createElement("script");
        script.src = VIMEO_PLAYER_JS;
        script.async = true;
        script.onload = onReady;
        script.onerror = () => reject(new Error("Vimeo Player API script failed"));
        document.head.appendChild(script);
      }).catch((err) => {
        sleevelessVimeoPlayerJsPromise = null;
        throw err;
      });
    }
    return sleevelessVimeoPlayerJsPromise;
  }

  /**
   * Seek the open modal Vimeo iframe via Player API when available.
   * @returns {Promise<boolean>} true if `setCurrentTime` and `play` succeeded
   */
  async function seekSleevelessVimeoModalWithPlayerApi(iframe, startSeconds) {
    const Player = window.Vimeo?.Player;
    if (!Player || !(iframe instanceof HTMLIFrameElement)) return false;
    let player = sleevelessVimeoPlayerByIframe.get(iframe);
    if (!player) {
      player = new Player(iframe);
      sleevelessVimeoPlayerByIframe.set(iframe, player);
    }
    const sec =
      typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds >= 0
        ? startSeconds
        : 0;
    try {
      await player.setCurrentTime(sec);
      await player.play();
      return true;
    } catch {
      return false;
    }
  }

  function buildSleevelessVimeoPlayerSrc(videoId, startSeconds) {
    const id = String(videoId || "").trim();
    if (!/^\d+$/.test(id)) return "";
    let url = `https://player.vimeo.com/video/${id}?autoplay=1&api=1`;
    if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 0) {
      url += `#t=${Math.floor(startSeconds)}s`;
    }
    return url;
  }

  /** Preserve Vimeo copy-paste player URL (query + optional hash); append `#t=` only when seeking. */
  function buildSleevelessVimeoPlayerSrcFromEmbedUrl(embedUrl, startSeconds) {
    const raw = String(embedUrl || "").trim();
    if (!raw) return "";
    try {
      const u = new URL(raw);
      if (u.hostname.includes("player.vimeo.com") && u.pathname.includes("/video/")) {
        u.searchParams.set("api", "1");
      }
      if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 0) {
        u.hash = `t=${Math.floor(startSeconds)}s`;
      } else {
        u.hash = "";
      }
      return u.toString();
    } catch {
      return raw;
    }
  }

  function resolveSleevelessHelpVideoIframeSrc(meta, startSeconds) {
    const embed = meta && String(meta.embedUrl || "").trim();
    if (embed) return buildSleevelessVimeoPlayerSrcFromEmbedUrl(embed, startSeconds);
    return buildSleevelessVimeoPlayerSrc(meta?.id, startSeconds);
  }

  function resolveSleevelessHelpVideoMeta(triggerEl) {
    if (!(triggerEl instanceof HTMLElement)) return null;
    const key = triggerEl.getAttribute("data-sleeveless-help-video")?.trim();
    if (key && SLEEVELESS_HELP_VIDEOS[key]) {
      return SLEEVELESS_HELP_VIDEOS[key];
    }
    const rawId =
      triggerEl.getAttribute("data-sleeveless-video-id") ||
      triggerEl.getAttribute("data-video-vimeo-id");
    const cleanId = String(rawId || "").trim();
    if (!/^\d+$/.test(cleanId)) return null;
    const fromMap = Object.values(SLEEVELESS_HELP_VIDEOS).find((m) => m.id === cleanId);
    if (fromMap) return fromMap;
    const fallbackTitle = triggerEl.getAttribute("data-video-title")?.trim() || "Video tutorial";
    return {
      id: cleanId,
      title: fallbackTitle,
      description: "",
      jumpLinks: [],
    };
  }

  function renderSleevelessVideoModalMarkup(meta, triggerEl) {
    const triggerTitle =
      triggerEl instanceof HTMLElement ? triggerEl.getAttribute("data-video-title")?.trim() : "";
    const titleText = (meta.title && String(meta.title).trim()) || triggerTitle || "Video tutorial";
    const descText = meta.description && String(meta.description).trim();
    const descHtml = descText
      ? `<p class="sleeveless-video-modal__desc">${escapeHtml(descText)}</p>`
      : "";

    const jumps = Array.isArray(meta.jumpLinks)
      ? meta.jumpLinks.filter(
          (j) =>
            j &&
            String(j.label || "").trim() &&
            typeof j.seconds === "number" &&
            Number.isFinite(j.seconds) &&
            j.seconds >= 0
        )
      : [];
    let jumpRegion = "";
    if (jumps.length > 0) {
      const embedBase = String(meta.embedUrl || "").trim();
      const embedBaseAttr = embedBase
        ? ` data-sleeveless-vimeo-src-base="${escapeGlossaryPlaceholderAttr(embedBase)}"`
        : "";
      const items = jumps
        .map((j) => {
          const lab = escapeHtml(String(j.label).trim());
          const sec = Math.floor(j.seconds);
          const vid = escapeHtml(String(meta.id ?? ""));
          return `<li><button type="button" class="sleeveless-video-modal__jump-btn" data-sleeveless-vimeo-jump="${sec}" data-sleeveless-vimeo-id="${vid}"${embedBaseAttr}>${lab}</button></li>`;
        })
        .join("");
      jumpRegion = `<div class="sleeveless-video-modal__jump" role="region" aria-label="Jump to a timestamp">
  <p class="sleeveless-video-modal__jump-heading">Jump to</p>
  <ul class="sleeveless-video-modal__jump-list">${items}</ul>
</div>`;
    }

    const iframeSrc = resolveSleevelessHelpVideoIframeSrc(meta, 0);
    const iframeTitle = escapeGlossaryPlaceholderAttr(titleText);
    return `<div class="sleeveless-video-modal__shell">
  <div class="sleeveless-video-modal__meta">
    <h2 class="sleeveless-video-modal__title">${escapeHtml(titleText)}</h2>
    ${descHtml}
    ${jumpRegion}
  </div>
  <div class="sleeveless-video-modal__player">
    <iframe
      data-sleeveless-vimeo-iframe
      src="${escapeGlossaryPlaceholderAttr(iframeSrc)}"
      title="${iframeTitle}"
      loading="lazy"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  </div>
</div>`;
  }

  function ensureSleevelessVideoModal() {
    let modal = document.querySelector("[data-sleeveless-video-modal]");
    if (modal instanceof HTMLElement) return modal;

    modal = document.createElement("div");
    modal.className = "sleeveless-diagram-modal";
    modal.hidden = true;
    modal.setAttribute("data-sleeveless-video-modal", "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Video tutorial");
    modal.innerHTML = `
      <div class="sleeveless-diagram-modal__dialog" data-sleeveless-video-dialog>
        <button type="button" class="sleeveless-diagram-modal__close" data-sleeveless-video-close aria-label="Close video tutorial">X</button>
        <div class="sleeveless-diagram-modal__content" data-sleeveless-video-content></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-sleeveless-video-close]")) {
        closeSleevelessVideoModal();
        return;
      }
      if (!target.closest("[data-sleeveless-video-dialog]")) {
        closeSleevelessVideoModal();
      }
    });

    modal.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-sleeveless-vimeo-jump]");
      if (!(btn instanceof HTMLElement)) return;
      if (!modal.contains(btn)) return;
      e.preventDefault();
      const iframe = modal.querySelector("[data-sleeveless-vimeo-iframe]");
      if (!(iframe instanceof HTMLIFrameElement)) return;
      const srcBase = btn.getAttribute("data-sleeveless-vimeo-src-base")?.trim();
      const vid = btn.getAttribute("data-sleeveless-vimeo-id")?.trim();
      const secRaw = btn.getAttribute("data-sleeveless-vimeo-jump");
      const secParsed = parseInt(secRaw || "", 10);
      const startSec = Number.isFinite(secParsed) && secParsed >= 0 ? secParsed : 0;

      void (async () => {
        try {
          await ensureSleevelessVimeoPlayerApiScript();
        } catch {
          /* fall through to iframe src fallback */
        }
        if (window.Vimeo?.Player) {
          const ok = await seekSleevelessVimeoModalWithPlayerApi(iframe, startSec);
          if (ok) return;
        }
        if (srcBase) {
          iframe.src = buildSleevelessVimeoPlayerSrcFromEmbedUrl(srcBase, startSec);
          return;
        }
        if (!vid || !/^\d+$/.test(vid)) return;
        iframe.src = buildSleevelessVimeoPlayerSrc(vid, startSec);
      })();
    });

    return modal;
  }

  function closeSleevelessVideoModal() {
    const modal = document.querySelector("[data-sleeveless-video-modal]");
    if (!(modal instanceof HTMLElement)) return;
    const content = modal.querySelector("[data-sleeveless-video-content]");
    if (content instanceof HTMLElement) {
      content.innerHTML = "";
    }
    modal.hidden = true;
    document.body.classList.remove("sleeveless-diagram-modal-open");
    const ref = sleevelessVideoModalReturnFocus;
    sleevelessVideoModalReturnFocus = null;
    if (ref && typeof ref.focus === "function") {
      try {
        ref.focus();
      } catch {
        /* ignore */
      }
    }
  }

  function openSleevelessVideoModal(triggerEl) {
    if (!(triggerEl instanceof HTMLElement)) return;
    const meta = resolveSleevelessHelpVideoMeta(triggerEl);
    const hasId = meta && String(meta.id || "").trim() && /^\d+$/.test(String(meta.id).trim());
    const hasEmbed = meta && String(meta.embedUrl || "").trim();
    if (!meta || (!hasId && !hasEmbed)) return;
    sleevelessVideoModalReturnFocus = triggerEl;
    const modal = ensureSleevelessVideoModal();
    const content = modal.querySelector("[data-sleeveless-video-content]");
    if (!(content instanceof HTMLElement)) return;
    content.innerHTML = renderSleevelessVideoModalMarkup(meta, triggerEl);
    modal.hidden = false;
    document.body.classList.add("sleeveless-diagram-modal-open");
    const closeBtn = modal.querySelector("[data-sleeveless-video-close]");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
    void ensureSleevelessVimeoPlayerApiScript().catch(() => {});
  }

  /** Loads `src/pages/videos/modal/[id].astro` (same-origin) in the shared video modal iframe. */
  function openPatternContentVideoModal(contentId, triggerEl) {
    const cleanId = String(contentId || "").trim();
    if (!/^\d+$/.test(cleanId)) return;
    sleevelessVideoModalReturnFocus =
      triggerEl instanceof HTMLElement ? triggerEl : document.activeElement;
    const modal = ensureSleevelessVideoModal();
    const content = modal.querySelector("[data-sleeveless-video-content]");
    if (!(content instanceof HTMLElement)) return;
    const src = `/pages/videos/modal/${cleanId}`;
    content.innerHTML = `<iframe
      class="pattern-video-modal-iframe"
      src="${src}"
      title="Video"
      loading="eager"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      style="display:block; width:min(92vw, 1000px); height:min(88vh, 900px); max-width:100%; border:0; border-radius:6px; background:#fff;"
    ></iframe>`;
    modal.hidden = false;
    document.body.classList.add("sleeveless-diagram-modal-open");
    const closeBtn = modal.querySelector("[data-sleeveless-video-close]");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  function bindSleevelessDiagramZoom(root) {
    if (!root || root.dataset.sleevelessDiagramZoomBound === "true") return;
    root.dataset.sleevelessDiagramZoomBound = "true";

    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest("[data-sleeveless-diagram-trigger]");
      if (!(trigger instanceof HTMLElement)) return;
      openSleevelessDiagramModal(trigger);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSleevelessDiagramModal();
      }
    });
  }

  function bindSleevelessVideoHelp(root) {
    if (!root || root.dataset.sleevelessVideoHelpBound === "true") return;
    root.dataset.sleevelessVideoHelpBound = "true";

    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const patternVideoLink = target.closest("a.pattern-video-modal-link[data-video-id]");
      if (patternVideoLink instanceof HTMLAnchorElement) {
        e.preventDefault();
        const videoId = patternVideoLink.getAttribute("data-video-id");
        if (!videoId) return;
        openPatternContentVideoModal(videoId, patternVideoLink);
        return;
      }
      const vimeoTrigger =
        target.closest("[data-sleeveless-help-video]") ||
        target.closest("[data-sleeveless-video-id]") ||
        target.closest("[data-video-vimeo-id]");
      if (!(vimeoTrigger instanceof HTMLElement)) return;
      e.preventDefault();
      openSleevelessVideoModal(vimeoTrigger);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSleevelessVideoModal();
      }
    });
  }

  function formatPrintDate(date) {
    try {
      return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return date.toLocaleDateString();
    }
  }

  function necklineChartPrintCss() {
    return `
      @page { size: auto; margin: 0.5in; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
      }
      #neckline-shoulder-chart-print-area,
      #front-neckline-shoulder-chart-print-area {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 0;
        overflow: visible;
      }
      .neckline-chart-print-controls,
      .chart-print-btn,
      .neckline-chart-print-button {
        display: none !important;
      }
      .neckline-chart-print-only-header,
      .neckline-chart-print-only-footer {
        display: block !important;
      }
      .neckline-chart-print-only-header-title {
        margin: 0 0 0.2rem;
        font-size: 1.05rem;
        font-weight: 700;
      }
      .neckline-chart-print-only-header-intro {
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
        line-height: 1.4;
      }
      .neckline-chart-print-only-footer {
        margin-top: 0.7rem;
        padding-top: 0.45rem;
        border-top: 1px solid #d1d5db;
        font-size: 0.82rem;
        color: #4b5563;
      }
      .sg-pattern-output,
      .ns-shaping-chart,
      .ns-shaping-chart__table-wrap,
      .ns-shaping-chart__table {
        width: 100%;
        max-width: none !important;
        overflow: visible !important;
      }
      .ns-shaping-chart {
        margin: 0;
        font-size: 9pt;
        line-height: 1.35;
        color: #1f2937;
        break-inside: auto;
        page-break-inside: auto;
      }
      .ns-shaping-chart__title {
        margin: 0 0 0.45rem;
        font-size: 1rem;
        font-weight: 700;
      }
      /* Chart-only print popup does not load ns-shaping-chart.css — keep notation + diagram text readable. */
      .ns-shaping-chart__diagram {
        display: block !important;
        visibility: visible !important;
        margin: 0.5rem 0 0 !important;
        padding: 0.45rem 0.55rem 0.55rem !important;
        border: 1px solid #d1d5db !important;
        background: #fff !important;
      }
      .ns-shaping-chart__diagram .ns-shaping-chart__preview-title {
        margin: 0 0 0.28rem !important;
        font-size: 0.95rem !important;
        font-weight: 700 !important;
        color: #1f2937 !important;
      }
      .ns-shaping-chart__diagram-notation-hint {
        display: block !important;
        visibility: visible !important;
        margin: 0 0 0.35rem !important;
        font-size: 0.72rem !important;
        line-height: 1.4 !important;
        color: #64748b !important;
      }
      .ns-shaping-chart__diagram-notation-hint-main {
        display: block !important;
        margin: 0 0 0.15rem !important;
        font-size: inherit !important;
        color: #64748b !important;
      }
      .ns-shaping-chart__diagram-notation-hint-example {
        display: block !important;
        margin: 0 !important;
        font-size: 0.65rem !important;
        line-height: 1.38 !important;
        font-style: italic !important;
        color: #64748b !important;
      }
      .ns-shaping-chart__diagram-notation-hint-kernel,
      .ns-shaping-chart__diagram-notation-order {
        color: #475569 !important;
      }
      .ns-shaping-chart__diagram-svg-wrap {
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
        margin-top: 0 !important;
      }
      .ns-shaping-chart__intro {
        margin: 0 0 0.55rem;
      }
      .ns-shaping-chart__table-wrap {
        border: 1px solid #9ca3af;
        border-radius: 0;
        margin: 0;
      }
      .ns-shaping-chart__table {
        border-collapse: collapse;
        table-layout: fixed;
      }
      .ns-shaping-chart__table th,
      .ns-shaping-chart__table td {
        border: 1px solid #d1d5db;
        padding: 0.22rem 0.32rem;
        vertical-align: middle;
      }
      .ns-shaping-chart__th-group,
      .ns-shaping-chart__th-sub,
      .ns-shaping-chart__th-row,
      .ns-shaping-chart__th-action,
      .ns-shaping-chart__th-complete {
        background: #f3f4f6;
      }
      .ns-shaping-chart__td-center {
        text-align: center;
      }
      .ns-shaping-chart__td-num {
        text-align: right;
        white-space: nowrap;
      }
      .ns-shaping-chart__td-complete,
      .ns-shaping-chart__th-complete {
        text-align: center;
        width: 2rem;
      }
      .ns-shaping-chart__row-check {
        width: 0.9rem;
        height: 0.9rem;
        margin: 0;
        appearance: auto;
        -webkit-appearance: checkbox;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .sleeveless-neck-shoulder-help {
        display: none !important;
      }
      .ns-shaping-chart__preview {
        display: none !important;
      }
      .ns-shaping-chart__second-shoulder-toggle {
        display: none !important;
      }
      [style*="position: sticky"] {
        position: static !important;
      }
      [style*="max-height"] {
        max-height: none !important;
      }
      @media print {
        html, body { margin: 0; }
      }
    `;
  }

  function printNecklineShoulderChart(chartAreaId, chartTitle) {
    const chart = document.getElementById(String(chartAreaId || ""));
    if (!(chart instanceof HTMLElement)) {
      console.error("Neckline/shoulder chart print area not found");
      return;
    }
    console.log("chart found");

    const chartClone = chart.cloneNode(true);
    if (!(chartClone instanceof HTMLElement)) return;

    const ctx =
      chartAreaId === "front-neckline-shoulder-chart-print-area"
        ? window.kbmNeckShoulderChartPrintContext?.front
        : window.kbmNeckShoulderChartPrintContext?.back;
    const hostId =
      chartAreaId === "front-neckline-shoulder-chart-print-area"
        ? "sg-neck-shoulder-chart-table-front"
        : "sg-neck-shoulder-chart-table-back";
    if (ctx?.chart) {
      const host = chartClone.querySelector(`#${hostId}`);
      if (host instanceof HTMLElement) {
        host.innerHTML = renderNeckShoulderShapingChartTableOnlyHtml(ctx.chart, ctx.idPrefix, ctx.introHtml, {
          ...ctx.options,
          compactPlainKnitSpansForPrint: true,
        });
      }
    }

    console.log("chart clone html length", chartClone.innerHTML.length);
    if (chartClone.innerHTML.length === 0) {
      console.error("Neckline/shoulder chart print area clone is empty");
      return;
    }

    const dateEl = chartClone.querySelector("[data-neckline-chart-print-date]");
    if (dateEl) dateEl.textContent = formatPrintDate(new Date());
    chartClone
      .querySelectorAll(
        "#neckline-shoulder-chart-print-btn, #front-neckline-shoulder-chart-print-btn, .chart-print-btn"
      )
      .forEach((el) => el.remove());

    const printTitle = String(chartTitle || "Neckline Shoulder Shaping Chart");
    const printHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${printTitle}</title>
    <style>
${necklineChartPrintCss()}
.print-chart-root,
.print-chart-root * {
  visibility: visible !important;
}
.print-chart-root {
  display: block !important;
  position: static !important;
  overflow: visible !important;
  max-height: none !important;
  width: 100% !important;
}
table {
  width: 100%;
  border-collapse: collapse;
}
    </style>
  </head>
  <body>
    <div class="print-chart-root">${chartClone.outerHTML}</div>
  </body>
</html>`;
    console.log("printHtml length", printHtml.length);
    console.log(printHtml.slice(0, 500));

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      console.error("Print window could not be opened");
      return;
    }
    console.log("print window opened");

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();

    setTimeout(() => {
      console.log("print window body length", printWindow.document.body?.innerHTML?.length);
      printWindow.focus();
      printWindow.print();
    }, 500);
  }

  function setupNecklineChartPrint(buttonId, chartAreaId, chartTitle) {
    const btn = document.getElementById(String(buttonId || ""));
    const chart = document.getElementById(String(chartAreaId || ""));

    if (!btn) {
      console.error("Neckline/shoulder chart print button not found");
      return;
    }
    console.log("button found");

    if (!chart) {
      console.error("Neckline/shoulder chart print area not found");
      return;
    }
    console.log("chart found");

    if (btn instanceof HTMLElement && btn.dataset.necklineChartPrintBound === "true") return;
    if (btn instanceof HTMLElement) btn.dataset.necklineChartPrintBound = "true";

    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      console.log("Print neckline/shoulder chart clicked");
      console.log("print clicked");

      printNecklineShoulderChart(chartAreaId, chartTitle);
    });
  }

  function bindSecondShoulderChecklistToggles(root) {
    if (!root) return;
    const scopes = root.querySelectorAll("[data-second-shoulder-scope]");
    scopes.forEach((scopeEl) => {
      if (!(scopeEl instanceof HTMLElement)) return;
      if (scopeEl.dataset.secondShoulderToggleBound === "true") return;
      scopeEl.dataset.secondShoulderToggleBound = "true";
      const checkbox = scopeEl.querySelector("[data-second-shoulder-toggle]");
      if (!(checkbox instanceof HTMLInputElement)) return;
      const secondShoulderBlocks = scopeEl.querySelectorAll("[data-second-shoulder-content]");
      const defaultInstruction = scopeEl.querySelector("[data-second-shoulder-default-instruction]");
      const checkedInstruction = scopeEl.querySelector("[data-second-shoulder-checked-instruction]");
      const update = () => {
        const show = checkbox.checked;
        secondShoulderBlocks.forEach((block) => {
          if (block instanceof HTMLElement) block.hidden = !show;
        });
        if (defaultInstruction instanceof HTMLElement) defaultInstruction.hidden = show;
        if (checkedInstruction instanceof HTMLElement) checkedInstruction.hidden = !show;
      };
      checkbox.addEventListener("change", update);
      update();
    });
  }

  function mountNecklineChartPrintInHeader(chartAreaId, buttonId) {
    const area = document.getElementById(String(chartAreaId || ""));
    if (!(area instanceof HTMLElement)) return;
    const chartRoot = area.querySelector(".ns-shaping-chart");
    if (!(chartRoot instanceof HTMLElement)) return;
    const title = chartRoot.querySelector(".ns-shaping-chart__title");
    if (!(title instanceof HTMLElement)) return;

    title.classList.add("neckline-chart-header");

    let headerRow = chartRoot.querySelector(".neckline-chart-header-row");
    if (!(headerRow instanceof HTMLElement)) {
      headerRow = document.createElement("div");
      headerRow.className = "neckline-chart-header-row";
      title.insertAdjacentElement("beforebegin", headerRow);
      headerRow.appendChild(title);
    }

    let btn = document.getElementById(String(buttonId || ""));
    if (!(btn instanceof HTMLButtonElement)) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chart-print-btn neckline-chart-print-button no-print";
      btn.id = String(buttonId || "");
      btn.setAttribute("aria-label", "Print this chart");
      btn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i>`;
    } else {
      btn.classList.add("no-print");
      btn.classList.add("chart-print-btn");
      btn.classList.add("neckline-chart-print-button");
      btn.setAttribute("aria-label", "Print this chart");
      if (!btn.querySelector("i")) {
        btn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i>`;
      }
    }

    headerRow.appendChild(btn);
  }

  /**
   * Section slugs in {@link renderSleevelessDisplayHtml} `flushOpenSection` are derived from
   * `escapeHtml(row.title)`, so titles containing `&` (e.g. `NECKLINE & SHOULDERS`) produce ids
   * with `amp` in the slug (`…-neckline-amp-shoulders`), not a bare `…-neckline-shoulders`.
   */
  function findNavTargetInScope(scope, ids, discoverNecklinePiece) {
    if (!scope) return null;
    for (const id of ids) {
      let el = scope.querySelector(`#${CSS.escape(id)}`);
      if (!(el instanceof HTMLElement)) {
        el = scope.querySelector(`[data-section-id="${id}"]`);
      }
      if (el instanceof HTMLElement) return { el, id };
    }
    if (discoverNecklinePiece === "back" || discoverNecklinePiece === "front") {
      const prefix = discoverNecklinePiece === "front" ? "sg-front-" : "sg-back-";
      const sections = scope.querySelectorAll(`section[data-section-id^="${prefix}"]`);
      for (const sec of sections) {
        if (!(sec instanceof HTMLElement)) continue;
        const sid = sec.getAttribute("data-section-id");
        if (!sid) continue;
        const lower = sid.toLowerCase();
        if (lower.includes("neckline") && lower.includes("shoulder")) {
          return { el: sec, id: sid };
        }
      }
    }
    return null;
  }

  const SLEEVELESS_PATTERN_INPAGE_NAV_ITEMS = [
    { label: "Back", ids: ["sg-back"] },
    { label: "Back Armhole", ids: ["sg-back-armhole"] },
    {
      label: "Back Neckline",
      ids: ["sg-back-back-neckline-amp-shoulders", "sg-back-back-neckline-shoulders"],
      discoverNecklinePiece: "back",
    },
    { label: "Front", ids: ["sg-front"] },
    { label: "Front Armhole", ids: ["sg-front-armhole"] },
    {
      label: "Front Neckline",
      ids: ["sg-front-front-neckline-amp-shoulders", "sg-front-front-neckline-shoulders"],
      discoverNecklinePiece: "front",
    },
    { label: "Finishing", ids: ["sg-finishing"] },
  ];

  function syncSleevelessPatternInpageNav() {
    const nav = document.querySelector("[data-sleeveless-pattern-inpage-nav]");
    if (!(nav instanceof HTMLElement)) return;
    const scope = document.getElementById("pattern-content");
    const track = document.createElement("div");
    track.className = "sleeveless-pattern-inpage-nav__track";
    let count = 0;
    for (const item of SLEEVELESS_PATTERN_INPAGE_NAV_ITEMS) {
      const found = findNavTargetInScope(scope, item.ids, item.discoverNecklinePiece);
      if (!found) continue;
      const a = document.createElement("a");
      a.href = `#${found.id}`;
      a.className = "sleeveless-pattern-inpage-nav__pill";
      a.textContent = item.label;
      track.appendChild(a);
      count += 1;
    }
    nav.replaceChildren(track);
    nav.hidden = count === 0;
  }

  function wrapPatternSection(sectionId, title, innerHtml, opts) {
    const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
    const defaultCollapsed = opts?.defaultCollapsed === true;
    const sectionClassName =
      typeof opts?.sectionClassName === "string" && opts.sectionClassName.trim()
        ? ` ${opts.sectionClassName.trim()}`
        : "";
    const collapsedClass = defaultCollapsed ? " is-collapsed" : "";
    const checkedAttr = defaultCollapsed ? " checked" : "";
    return `<section id="${sid}" class="pattern-section${sectionClassName}${collapsedClass}" data-section-id="${sid}">
  <div class="pattern-section__header">
    <label class="pattern-section__collapse-label">
      <input type="checkbox" class="pattern-section__collapse" data-section-id="${sid}" aria-label="Collapse this section"${checkedAttr} />
    </label>
    <div class="pattern-section__heading"><h2>${title}</h2></div>
  </div>
  <div class="pattern-section__content">${innerHtml}</div>
</section>`;
  }

  function applyPatternSectionCollapseState(root) {
    if (!root) return;
    root.querySelectorAll(".pattern-section").forEach((section) => {
      const id = section.dataset.sectionId;
      if (!id) return;
      const header = section.querySelector(":scope > .pattern-section__header");
      const checkbox = header?.querySelector("input.pattern-section__collapse");
      if (!(checkbox instanceof HTMLInputElement)) return;
      const collapsed = localStorage.getItem(`sleevelessPattern_section_${id}`) === "true";
      checkbox.checked = collapsed;
      section.classList.toggle("is-collapsed", collapsed);
    });
  }

  function bindPatternSectionCollapsePersistence(root) {
    if (!root) return;
    if (root.dataset.patternSectionCollapseBound === "true") return;
    root.dataset.patternSectionCollapseBound = "true";
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.classList.contains("pattern-section__collapse")) return;
      const section = t.closest(".pattern-section");
      const id = t.dataset.sectionId || section?.dataset.sectionId;
      if (!section || !id) return;
      localStorage.setItem(`sleevelessPattern_section_${id}`, t.checked ? "true" : "false");
      section.classList.toggle("is-collapsed", t.checked);
    });
  }

  function escapeGlossaryPlaceholderAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeGlossaryPlaceholderText(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** One-line glossary term in finishing HTML; hydrated after mount to match GlossaryTooltip.astro. */
  function glossaryTooltip(id, term) {
    const t = String(term ?? "");
    return `<span class="glossary-tooltip-placeholder" data-glossary-id="${id}" data-term="${escapeGlossaryPlaceholderAttr(t)}">${escapeGlossaryPlaceholderText(t)}</span>`;
  }

  /** Inline help on “one shoulder” in finishing (not glossary); uses global `.kbm-tooltip` styles. */
  function oneShoulderFinishingHelpHtml() {
    const tip =
      "One shoulder is joined first so the neckband can be worked in one continuous piece around the neckline. The second shoulder is joined after the neckband is finished.";
    const escapedTip = escapeGlossaryPlaceholderAttr(tip);
    return `<span class="kbm-tooltip" tabindex="0" title="${escapedTip}" aria-label="${escapedTip}" data-tooltip="${escapedTip}">one shoulder</span>`;
  }

  function buildFinishingHtml() {
    return `
<div class="pattern-finishing-steps">
  <section class="pattern-finishing-step" aria-labelledby="finishing-step-block-pieces">
    <h3 class="pattern-finishing-step__title" id="finishing-step-block-pieces">1. Block Pieces (Optional)</h3>
    <ul>
      <li>Lightly steam or ${glossaryTooltip(659, "Wet Block")} pieces to measurements.</li>
      <li>Allow pieces to dry completely before assembly.</li>
      <li>Pin edges flat if needed.</li>
    </ul>
    <p>Blocking before seaming helps neckline and armhole edges relax and makes finishing easier.</p>
  </section>

  <section class="pattern-finishing-step" aria-labelledby="finishing-step-join-shoulders">
    <h3 class="pattern-finishing-step__title" id="finishing-step-join-shoulders">2. Join Shoulders</h3>
    <p class="pattern-finishing-lead">Join ${oneShoulderFinishingHelpHtml()} using your preferred method.</p>
    <ul>
      <li>${glossaryTooltip(745, "Linker")}</li>
      <li>crochet slip stitch</li>
      <li>machine bind-off method</li>
    </ul>
  </section>

  <section class="pattern-finishing-step" aria-labelledby="finishing-step-finish-neckline">
    <h3 class="pattern-finishing-step__title" id="finishing-step-finish-neckline">3. Finish Neckline</h3>
    <ul>
      <li>Work the neckline trim or neckband.</li>
      <li>Finish the neckband as desired.</li>
      <li>Join the remaining shoulder seam and neckband seam.</li>
    </ul>
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Helpful video for finishing:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="onePieceBand" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> One-piece neckband</button>
      </span>
    </p>
  </section>

  <section class="pattern-finishing-step" aria-labelledby="finishing-step-finish-armholes">
    <h3 class="pattern-finishing-step__title" id="finishing-step-finish-armholes">4. Finish Armholes</h3>
    <ul>
      <li>Work both armhole trims the same way as the neckband.</li>
      <li>Use the neckband video above as a guide for finishing the armholes.</li>
      <li>Be sure to grade the tension as you knit the band.</li>
    </ul>
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Same technique as the neckband:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="onePieceBand" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> One-piece neckband</button>
      </span>
    </p>
  </section>

  <section class="pattern-finishing-step" aria-labelledby="finishing-step-join-side-seams">
    <h3 class="pattern-finishing-step__title" id="finishing-step-join-side-seams">5. Join Side Seams</h3>
    <ul>
      <li>Match armhole edges and hem.</li>
      <li>Match markers (if added).</li>
      <li>Seam from hem to underarm.</li>
    </ul>
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Helpful video for seaming:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="seamingPuttingItAllTogether" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Seaming – Putting It All Together</button>
      </span>
    </p>
  </section>

  <section class="pattern-finishing-step" aria-labelledby="finishing-step-final-pressing">
    <h3 class="pattern-finishing-step__title" id="finishing-step-final-pressing">6. Final Pressing</h3>
    <ul>
      <li>Lightly steam seams if needed.</li>
      <li>Weave in ends.</li>
      <li>Allow garment to rest before wearing.</li>
    </ul>
  </section>
</div>
`;
  }

  function activateWizardTab(target) {
    const root = document.querySelector(".sleeveless-pattern-page .pattern-tabs");
    if (!root) return;
    root.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === target);
    });
    root.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${target}`);
    });

    if (target === "share") {
      const el = document.querySelector("[data-pattern-comments]");
      if (!el || !(el instanceof HTMLElement)) return;
      const commentsEl = el;
      const alreadyLoaded = commentsEl.dataset.hyvorLoaded === "true";
      const websiteId = commentsEl.dataset.hyvorWebsiteId;
      const cleanPath = window.location.pathname.replace(/\/$/, "") || "/";
      const w = window;
      w.HYVOR_TALK_WEBSITE = Number(websiteId);
      w.HYVOR_TALK_CONFIG = {
        url: window.location.origin + cleanPath,
        id: cleanPath,
      };
      if (alreadyLoaded) {
        if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
          w.HyvorTalk.reload();
        }
        return;
      }
      const existingScript = document.querySelector("script[data-hyvor-embed]");
      if (existingScript) {
        commentsEl.dataset.hyvorLoaded = "true";
        if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
          w.HyvorTalk.reload();
        }
        return;
      }
      const script = document.createElement("script");
      script.src = "https://talk.hyvor.com/web-api/embed.js";
      script.async = true;
      script.type = "text/javascript";
      script.setAttribute("data-hyvor-embed", "true");
      script.onload = () => {
        commentsEl.dataset.hyvorLoaded = "true";
        if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
          w.HyvorTalk.reload();
        }
      };
      document.body.appendChild(script);
    }

    if (target === "inspiration") {
      if (window.PinUtils && typeof window.PinUtils.build === "function") {
        window.PinUtils.build();
      }
      window.kbmSchedulePinterestEmbedsRefresh?.();
    }

    if (target === "pattern" && typeof window.kbmRefreshSleevelessPattern === "function") {
      window.kbmRefreshSleevelessPattern();
    }
  }

  function bindTabs() {
    const root = document.querySelector(".sleeveless-pattern-page .pattern-tabs");
    if (!root) return;
    root.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        if (!target) return;
        activateWizardTab(target);
      });
    });

    const editBtn = document.getElementById("edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        activateWizardTab("build");
        const topEl = document.getElementById("sleeveless-pattern-top");
        if (topEl) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          topEl.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
      });
    }

    window.addEventListener("kbm:sleeveless-open-pattern-tab", () => {
      activateWizardTab("pattern");
    });
  }

  async function renderMount(patternMerged, result, unit, generatorPatternData) {
    const mount = document.querySelector("[data-sleeveless-mount]");
    if (!mount) return;

    /** Canonical merged pattern (canonical + builder); neckline lives on `style.neckline` even when generator input omits nested sections. */
    const necklineAssetPatternData = patternMerged;

    const displayRows = result.displayRows ?? [];
    const frontDisplayRows = result.frontDisplayRows ?? [];
    const patternIntroSentence = buildPatternIntroSentence(patternMerged, generatorPatternData);
    const backRendered =
      displayRows.length > 0
        ? renderSleevelessDisplayHtml(
            displayRows,
            "sg-neck-shoulder-chart-table-back",
            "sg-neck-shoulder-diagram-back",
            "back",
            patternIntroSentence,
            result?.neckShoulderShapingChart?.rows?.[0]?.row,
            { omitPieceBanner: true }
          )
        : null;
    const frontRendered =
      frontDisplayRows.length > 0
        ? renderSleevelessDisplayHtml(
            frontDisplayRows,
            "sg-neck-shoulder-chart-table-front",
            "sg-neck-shoulder-diagram-front",
            "front",
            patternIntroSentence,
            result?.frontNeckShoulderShapingChart?.rows?.[0]?.row,
            { omitPieceBanner: true }
          )
        : null;

    const backInner = backRendered?.splitInner ?? `<p class="pattern-step-intro">Pattern display is not available. Try refreshing this tab.</p>`;
    const backPost = backRendered?.postSplit ?? "";
    const frontInner =
      frontRendered?.splitInner ?? `<p class="pattern-step-intro">Front instructions are not available. Try refreshing this tab.</p>`;
    const frontPost = frontRendered?.postSplit ?? "";

    const backWrapped = wrapSleevelessPieceSplit(
      backInner,
      "/images/patterns/sleeveless/diagram-back.svg",
      "Sleeveless back piece diagram",
      backPost
    );
    const frontWrapped = wrapSleevelessPieceSplit(
      frontInner,
      getSleevelessFrontDiagramSrc(necklineAssetPatternData),
      "Sleeveless front piece diagram",
      frontPost
    );

    mount.innerHTML =
      wrapPatternSection("sg-back", "BACK", backWrapped, {
        defaultCollapsed: false,
        sectionClassName: "pattern-section--garment-piece",
      }) +
      wrapPatternSection("sg-front", "FRONT", frontWrapped, {
        defaultCollapsed: false,
        sectionClassName: "pattern-section--garment-piece",
      }) +
      wrapPatternSection("sg-finishing", "Finishing", buildFinishingHtml(), { defaultCollapsed: true });

    const backArmholeLocalChartStartRc = Number.isFinite(result?.debug?.backNecklineStartLocalRC)
      ? Math.max(0, Math.floor(result.debug.backNecklineStartLocalRC))
      : 0;
    const frontArmholeLocalChartStartRc = Number.isFinite(result?.debug?.frontNecklineStartLocalRC)
      ? Math.max(0, Math.floor(result.debug.frontNecklineStartLocalRC))
      : 0;

    const armholeGarmentStartRc = result?.debug?.armholeStartRow;
    const backActiveSideRcStart = armholeLocalRcActiveShoulderChecklistStart(
      result.neckShoulderShapingChart,
      armholeGarmentStartRc,
    );
    const frontActiveSideRcStart = armholeLocalRcActiveShoulderChecklistStart(
      result.frontNeckShoulderShapingChart,
      armholeGarmentStartRc,
    );

    // Active-shoulder checklist (RC / Side / Instruction / Section / Stitches). Plain-knit compaction: neckShoulderShapingChartHtml `chartBodyRowsHtml`.
    const backChartTableHost = mount.querySelector("#sg-neck-shoulder-chart-table-back");
    if (backChartTableHost) {
      backChartTableHost.innerHTML = renderNeckShoulderShapingChartTableOnlyHtml(
        result.neckShoulderShapingChart,
        "ns-shaping-chart-back",
        neckShoulderChartHelpRowHtml(`RC:${String(backArmholeLocalChartStartRc).padStart(3, "0")}`, result?.neckShoulderShapingChart, "back"),
        { activeSideOnly: true, activeSideRcStart: backActiveSideRcStart }
      );
    }
    const backDiagramHost = mount.querySelector("#sg-neck-shoulder-diagram-back");
    if (backDiagramHost) {
      backDiagramHost.innerHTML = renderNeckShoulderShapingDiagramOnlyHtml(
        result.neckShoulderShapingChart,
        "ns-shaping-chart-back",
        "back",
        necklineAssetPatternData,
      );
    }
    const frontChartTableHost = mount.querySelector("#sg-neck-shoulder-chart-table-front");
    if (frontChartTableHost) {
      frontChartTableHost.innerHTML = renderNeckShoulderShapingChartTableOnlyHtml(
        result.frontNeckShoulderShapingChart,
        "ns-shaping-chart-front",
        neckShoulderChartHelpRowHtml(
          `RC:${String(frontArmholeLocalChartStartRc).padStart(3, "0")}`,
          result?.frontNeckShoulderShapingChart,
          "front"
        ),
        { activeSideOnly: true, activeSideRcStart: frontActiveSideRcStart }
      );
    }

    /** Used by chart-only print (dialog) to re-render compact rows without altering on-screen HTML. */
    window.kbmNeckShoulderChartPrintContext = {
      back: {
        chart: result.neckShoulderShapingChart,
        idPrefix: "ns-shaping-chart-back",
        introHtml: neckShoulderChartHelpRowHtml(
          `RC:${String(backArmholeLocalChartStartRc).padStart(3, "0")}`,
          result?.neckShoulderShapingChart,
          "back"
        ),
        options: { activeSideOnly: true, activeSideRcStart: backActiveSideRcStart },
      },
      front: {
        chart: result.frontNeckShoulderShapingChart,
        idPrefix: "ns-shaping-chart-front",
        introHtml: neckShoulderChartHelpRowHtml(
          `RC:${String(frontArmholeLocalChartStartRc).padStart(3, "0")}`,
          result?.frontNeckShoulderShapingChart,
          "front"
        ),
        options: { activeSideOnly: true, activeSideRcStart: frontActiveSideRcStart },
      },
    };
    const frontDiagramHost = mount.querySelector("#sg-neck-shoulder-diagram-front");
    if (frontDiagramHost) {
      frontDiagramHost.innerHTML = renderNeckShoulderShapingDiagramOnlyHtml(
        result.frontNeckShoulderShapingChart,
        "ns-shaping-chart-front",
        "front",
        necklineAssetPatternData,
      );
    }

    // Finishing HTML + neckline/shoulder diagram HTML (incl. glossary placeholders) are injected above.
    // Hydrate after those nodes exist — early hydration skipped diagram placeholders (they were not in the DOM yet).
    hydrateGlossaryTooltipPlaceholders(mount);

    mountNecklineChartPrintInHeader(
      "neckline-shoulder-chart-print-area",
      "neckline-shoulder-chart-print-btn"
    );
    mountNecklineChartPrintInHeader(
      "front-neckline-shoulder-chart-print-area",
      "front-neckline-shoulder-chart-print-btn"
    );

    // Inline SVG diagrams with placeholder replacement (Back + Front).
    // Note: replacements come from the same result/debug used for chart/timeline (no extra shaping math here).
    await hydrateSleevelessDiagrams(mount, result, unit, necklineAssetPatternData);
    ensureSleevelessDiagramModal();
    bindSleevelessDiagramZoom(mount);
    ensureSleevelessVideoModal();
    const videoHelpRoot =
      document.getElementById("sleeveless-pattern-tips-scope") || mount;
    bindSleevelessVideoHelp(videoHelpRoot);
    setupNecklineChartPrint(
      "neckline-shoulder-chart-print-btn",
      "neckline-shoulder-chart-print-area",
      "Back Neckline / Shoulder Shaping Chart"
    );
    setupNecklineChartPrint(
      "front-neckline-shoulder-chart-print-btn",
      "front-neckline-shoulder-chart-print-area",
      "Front Neckline / Shoulder Shaping Chart"
    );
    bindSecondShoulderChecklistToggles(mount);

    applyPatternSectionCollapseState(mount);
    bindPatternSectionCollapsePersistence(mount);
    syncSleevelessPatternInpageNav();
  }

  function patternTabsRoot() {
    return document.querySelector(".sleeveless-pattern-page .pattern-tabs");
  }

  function updateSleevelessPrintBasicsSummarySlot(patternMerged, patternData, validationOk) {
    const body = document.querySelector("[data-sg-pattern-print-basics-body]");
    if (!(body instanceof HTMLElement)) return;
    if (!validationOk) {
      body.innerHTML = "";
      return;
    }
    body.innerHTML = buildSleevelessPrintBasicsSummaryDlHtml(patternMerged, patternData);
  }

  function refreshPatternTabContent() {
    const patternMerged = mergedPatternForDisplay(getCurrentPattern());
    const patternData = getPatternData();
    const validation = validatePatternBuilderRequired(patternData);
    updateSleevelessAudienceHero(patternMerged);

    const resultsEl = document.getElementById("sg-sleeveless-results");
    const tabsRoot = patternTabsRoot();

    const introEl = document.querySelector("[data-sg-pattern-intro]");
    if (introEl instanceof HTMLElement) {
      introEl.innerHTML = validation.ok ? buildSleevelessScreenBasicsSummaryDlHtml(patternMerged, patternData) : "";
    }

    if (!validation.ok) {
      updateSleevelessPrintBasicsSummarySlot(patternMerged, patternData, false);
      if (resultsEl) resultsEl.style.display = "none";
      const mount = document.querySelector("[data-sleeveless-mount]");
      if (mount) mount.innerHTML = "";
      syncSleevelessPatternInpageNav();
      const note = document.querySelector("[data-sg-generator-note]");
      if (note) note.setAttribute("hidden", "");
      setPatternTabsReadiness(tabsRoot, false);
      return;
    }

    setPatternTabsReadiness(tabsRoot, true);
    showResults(resultsVisibilityConfig);

    const genInput = buildGeneratorPatternData(patternMerged);
    const result = generateSleevelessBackPattern(genInput);

    const note = document.querySelector("[data-sg-generator-note]");
    if (note) {
      if (result.warnings.length > 0) note.removeAttribute("hidden");
      else note.setAttribute("hidden", "");
    }

    const yg = section(patternMerged.yarnGauge);
    const ygm =
      patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
        ? section(patternData.yarnGaugeMachine)
        : {};
    const unit = (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";

    updateSleevelessPrintBasicsSummarySlot(patternMerged, patternData, true);

    void renderMount(patternMerged, result, unit, genInput);
  }

  function refreshBetaPatternContent() {
    const canon = getSleevelessGoldenBetaCanonicalPattern();
    const goldenPb = getSleevelessGoldenBetaPatternBuilderData();
    const patternMerged = mergedPatternForDisplayFromSources(canon, goldenPb);
    const patternData = goldenPb;
    updateSleevelessAudienceHero(patternMerged);

    const introEl = document.querySelector("[data-sg-pattern-intro]");
    if (introEl instanceof HTMLElement) {
      introEl.innerHTML = buildSleevelessScreenBasicsSummaryDlHtml(patternMerged, patternData);
    }

    const genInput = buildGeneratorPatternDataFromSources(patternMerged, goldenPb);
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[sleeveless beta-pattern] generator input", JSON.parse(JSON.stringify(genInput)));
    }

    const result = generateSleevelessBackPattern(genInput);

    const note = document.querySelector("[data-sg-generator-note]");
    if (note) {
      if (result.warnings.length > 0) note.removeAttribute("hidden");
      else note.setAttribute("hidden", "");
    }

    const yg = section(patternMerged.yarnGauge);
    const ygm =
      patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
        ? section(patternData.yarnGaugeMachine)
        : {};
    const unit = (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";

    updateSleevelessPrintBasicsSummarySlot(patternMerged, patternData, true);

    void renderMount(patternMerged, result, unit, genInput);
  }

  export function initSleevelessBetaPatternPage() {
    window.kbmRefreshSleevelessPattern = refreshBetaPatternContent;
    initializeActionBar(resultsVisibilityConfig);
    showResults(resultsVisibilityConfig);
    refreshBetaPatternContent();
  }

  export function initSleevelessPatternBuilderPage() {
    let hadTabPatternQuery = false;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("tab") === "pattern") {
        hadTabPatternQuery = true;
        u.searchParams.delete("tab");
        const qs = u.searchParams.toString();
        window.history.replaceState({}, "", `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`);
      }
    } catch {
      /* ignore */
    }

    window.kbmRefreshSleevelessPattern = refreshPatternTabContent;
    bindTabs();
    initializeActionBar(resultsVisibilityConfig);
    refreshPatternTabContent();
    if (hadTabPatternQuery) activateWizardTab("pattern");

    const canonKey = getPatternStorageKey();
    window.addEventListener("storage", (e) => {
      if (!e.key || (e.key !== PATTERN_BUILDER_DATA_KEY && e.key !== canonKey)) return;
      refreshPatternTabContent();
    });
  }
