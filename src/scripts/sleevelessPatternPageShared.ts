// @ts-nocheck
import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  getPatternStorageKey,
  SLEEVELESS_CHART_AUDIENCE_LABELS,
  clearSleevelessExpressSession,
} from "../lib/patterns/patternStorage.ts";
import {
  buildGeneratorPatternDataFromSources,
  buildSleevelessGarmentDiagramPatternData,
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
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "../lib/patterns/neckShoulderShapingChartHtml.ts";
import { initChartProgressTracking } from "./chartProgressTracker.ts";
import { showResults, initializeActionBar } from "../components/wizards/utils/wizardBehavior.ts";
import { triggerPatternPrint } from "./patternPrintPersonalization.ts";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate.ts";
import {
  isSleevelessCardiganHalfFrontDiagramType,
  isSleevelessCardiganGarmentStyle,
  resolveSleevelessFrontDiagram,
  isSleevelessVNeckChoice,
  isSleevelessDevCardiganExpressPreview,
} from "../lib/patterns/sleevelessFrontDiagramSrc.ts";
import { resolveSleevelessAudienceHeroImageSrc } from "../lib/patterns/sleevelessAudienceHeroImage.ts";
import {
  injectBodyShapeGuidesIntoGarmentSvg,
  scaleDiagramGuidesForCardiganHalf,
} from "../lib/patterns/sleevelessBodyShapeDiagramGuides.ts";
import { buildSleevelessGarmentDiagramReplacements } from "../lib/patterns/sleevelessGarmentDiagramReplacements.ts";
import {
  BACK_DIAGRAM_STS_ROWS_SRC,
  resolveSleevelessBackDiagramSrc,
} from "../lib/patterns/sleevelessBackDiagramSrc.ts";
import { applyJapaneseNotationSvgReplacements } from "../lib/patterns/sleevelessJapaneseNotationSvg.ts";
import {
  buildBackJapaneseNotationReplacements,
  isBackJapaneseNotationSupported,
} from "../lib/patterns/sleevelessBackJapaneseNotation.ts";
import {
  buildFrontJapaneseNotationReplacements,
  isFrontJapaneseNotationSupported,
  resolveSleevelessFrontDiagramSrc,
} from "../lib/patterns/sleevelessFrontJapaneseNotation.ts";
import {
  buildSleevelessPrintBasicsSummaryDlHtml,
  buildSleevelessScreenBasicsSummaryDlHtml,
  formatGaugeIntroPhrase,
} from "../lib/patterns/sleevelessPrintBasicsSummaryHtml.ts";
import { sleevelessFinishingFromPattern } from "../lib/patterns/sleevelessPatternFinishing.ts";
import { buildSleevelessFinishingStepsHtml } from "../lib/patterns/sleevelessPatternFinishingHtml.ts";
import { scrollToBuilderSection } from "../lib/patterns/scrollToBuilderSection.ts";
import {
  ARMHOLE_BIND_OFF_TRICK_CONTENT_ID,
  type SleevelessBackPatternDebug,
} from "../lib/patterns/sleevelessPatternOutput.ts";
import { sleevelessHelpVideoFromCatalog } from "../lib/patterns/sleevelessCatalogHelpVideo.ts";
import { resolveEffectiveFinishedBustInches } from "../lib/patterns/customBuildEffectiveFinishedBust.ts";
import { resolveDiagramFinishedHipInches } from "../lib/patterns/customBuildEffectiveFinishedHip.ts";
import { resolveEffectiveSleevelessBodyShapePhrase } from "../lib/patterns/sleevelessAlineShaping.ts";

// DEV-only cardigan half-front schematic: sessionStorage or localStorage key `kbmDevCardiganHalfFrontLeft` = "1" (vite dev).

const bindOffTrickHelpVideo = sleevelessHelpVideoFromCatalog(ARMHOLE_BIND_OFF_TRICK_CONTENT_ID);
if (!bindOffTrickHelpVideo) {
  throw new Error(
    `Missing videos-public.json row for armhole bind-off trick (content_id ${ARMHOLE_BIND_OFF_TRICK_CONTENT_ID}).`,
  );
}

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
  /** Finishing-section Vimeo for V-neck; round/crew patterns use `onePieceBand` above. */
  vNeckBandFinishing: {
    id: "1192304635",
    title: "Optional V-Neck Band Tutorial",
    description:
      "This walkthrough demonstrates one professional method for knitting and finishing a folded V-neck band, including pickup ratios, center decreases, tension grading, and joining techniques.",
      jumpLinks: [
        { label: "stitches to rows pickup", seconds: 24 },
        { label: "ratio", seconds: 47 },
        { label: "hang the neckline", seconds: 67 },
        { label: "Finishing Tip", seconds: 108 },
        { label: "grade the tension", seconds: 116 },
        { label: "transfer stitches", seconds: 135 },
        { label: "Public side", seconds: 250 },
        { label: "turning row", seconds: 268 },
        { label: "Private side", seconds: 274 },
        { label: "close the band", seconds: 325 },
      ],
  },
  /** Catalog content_id {@link ARMHOLE_BIND_OFF_TRICK_CONTENT_ID} — bind-off trick for armhole tips. */
  bindOffTrick: bindOffTrickHelpVideo,
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

  const isSleevelessWorkspacePatternPage = () =>
    Boolean(document.querySelector(".sleeveless-pattern-page.sleeveless-workspace-subpage"));

  let sleevelessInpageNavScrollSpyBound = false;

  function sleevelessInpageNavScrollOffsetPx() {
    const headerOffset =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--site-header-offset")
      ) || 112;
    const nav = document.querySelector("[data-sleeveless-pattern-inpage-nav]");
    const navHeight = nav instanceof HTMLElement ? nav.offsetHeight : 40;
    return headerOffset + navHeight + 6;
  }

  function updateSleevelessInpageNavActivePill() {
    const nav = document.querySelector("[data-sleeveless-pattern-inpage-nav]");
    if (!(nav instanceof HTMLElement) || nav.hidden) return;
    const pills = nav.querySelectorAll(
      "a.sleeveless-pattern-inpage-nav__pill[data-nav-section-id]"
    );
    if (!pills.length) return;

    const offset = sleevelessInpageNavScrollOffsetPx();
    let activeId = pills[0].getAttribute("data-nav-section-id");
    for (const pill of pills) {
      if (!(pill instanceof HTMLAnchorElement)) continue;
      const id = pill.getAttribute("data-nav-section-id");
      if (!id) continue;
      const section = document.getElementById(id);
      if (!(section instanceof HTMLElement)) continue;
      if (section.getBoundingClientRect().top <= offset) {
        activeId = id;
      }
    }

    pills.forEach((pill) => {
      if (!(pill instanceof HTMLAnchorElement)) return;
      const id = pill.getAttribute("data-nav-section-id");
      const isActive = Boolean(id && id === activeId);
      pill.classList.toggle("is-active", isActive);
      if (isActive) pill.setAttribute("aria-current", "location");
      else pill.removeAttribute("aria-current");
    });
  }

  function bindSleevelessInpageNavScrollSpy() {
    if (sleevelessInpageNavScrollSpyBound) return;
    sleevelessInpageNavScrollSpyBound = true;
    let ticking = false;
    const schedule = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateSleevelessInpageNavActivePill();
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);
  }

  function appendSleevelessInpageNavPrintPill(track) {
    if (!isSleevelessWorkspacePatternPage()) return;
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.id = "print-btn";
    printBtn.className =
      "sleeveless-pattern-inpage-nav__pill sleeveless-pattern-inpage-nav__pill--print no-print";
    printBtn.setAttribute("data-testid", "button-print");
    printBtn.setAttribute("aria-label", "Print pattern");
    printBtn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i> Print`;
    if (printBtn.dataset.sleevelessPrintBound !== "true") {
      printBtn.dataset.sleevelessPrintBound = "true";
      printBtn.addEventListener("click", () => {
        triggerPatternPrint(printBtn, {});
      });
    }
    track.appendChild(printBtn);
    printBtn.style.display = "inline-flex";
  }

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
    return buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
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

  function updateSleevelessAudienceHero(patternMerged) {
    const st = section(patternMerged.style);
    const ft = section(patternMerged.fit);
    const audience =
      (typeof st.recipientCategory === "string" && st.recipientCategory.trim()) ||
      (typeof ft.sizingChart === "string" && ft.sizingChart.trim()) ||
      "";
    const hero = document.querySelector("[data-sleeveless-audience-hero]");
    if (hero instanceof HTMLImageElement) {
      hero.src = resolveSleevelessAudienceHeroImageSrc(patternMerged, audience);
    }
  }

  function garmentShapeLengthPhrase(st, patternData) {
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
    const garment = garmentShapeLengthPhrase(st, patternData);
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
      chart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
    });
    const necklineTipVideoButtons = `<div class="pattern-finishing-video-help__links sleeveless-neckline-tip__video-links">
  <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="roundNeckShaping" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Round neck shaping</button>
  <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="shallowBackNeck" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Short row shoulder shaping</button>
</div>`;
    const necklineTipLead = `<p>Many knitters prefer to use ${glossaryTooltip(250, "Short Rows")} to shape shoulders because they create a smoother edge and help prevent ${glossaryTooltip(902, "stair steps")} caused by bind-offs.</p>`;
    return `${intro}
<details class="pattern-tip sleeveless-shaping-help-toggle no-print" data-tip-id="sleeveless-neckline-machine-help">
  <summary>New to shaping necklines on the machine?</summary>
  ${necklineTipLead}
  <p class="sleeveless-neckline-tip__short-rows-prompt">New to ${glossaryTooltip(250, "Short Rows")}?</p>
  ${necklineTipVideoButtons}
</details>`;
  }

  /**
   * Renders structured rows: left column RC + text, right column total sts only when it changes.
   * Chart table stays in the left column below neckline/shoulder prose.
   * @param {unknown[]} rows
   * @param {string} chartTableMountId
   */
  function renderSleevelessDisplayHtml(
    rows,
    chartTableMountId,
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
      const trusted = row.trustedParagraphs;
      if (trusted && trusted.length > 0) {
        for (const p of trusted) {
          const t = String(p).trim();
          if (t) leftBits.push(`<p class="sleeveless-pattern-line">${p}</p>`);
        }
      } else {
        for (const p of row.paragraphs) {
          const t = String(p).trim();
          if (t) leftBits.push(`<p class="sleeveless-pattern-line">${escapeHtml(t)}</p>`);
        }
      }
      if (row.tipHtml) {
        const tipIdAttr = row.tipId ? ` data-tip-id="${escapeHtml(row.tipId)}"` : "";
        leftBits.push(
          row.tipHtmlIsFull
            ? `<div class="pattern-tip" data-tip${tipIdAttr}>${row.tipHtml}</div>`
            : `<div class="pattern-tip" data-tip${tipIdAttr}><strong>Tip:</strong> ${row.tipHtml}</div>`,
        );
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
        const chartChunk = `${chartAreaOpen}
  <div class="neckline-chart-print-only-header" aria-hidden="true">
    <p class="neckline-chart-print-only-header-title">${escapeHtml(printPatternTitle)}</p>
    <p class="neckline-chart-print-only-header-intro">Custom pattern for ${escapeHtml(printIntro)}</p>
  </div>
  <div class="sg-pattern-output sg-neck-chart-print-block" id="${escapeHtml(chartTableMountId)}"></div>
  <p class="neckline-chart-print-only-footer">Created by Knit It Now · Printed <span data-neckline-chart-print-date></span></p>
</div>`;
        if (openSectionSlugSource) {
          openSectionParts.push(chartChunk);
          continue;
        }
        postParts.push(`<section class="sleeveless-piece-chart-fullwidth">${chartChunk}</section>`);
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

  const BACK_DIAGRAM_STS_ROWS_ALT = "Sleeveless back piece diagram";
  const BACK_DIAGRAM_NOTATION_ALT = "Sleeveless back piece shaping notation diagram";
  const FRONT_DIAGRAM_STS_ROWS_ALT = "Sleeveless front piece diagram";
  const FRONT_DIAGRAM_NOTATION_ALT = "Sleeveless front piece shaping notation diagram";
  /**
   * Two-column shell for Back/Front: prose + chart (left) and static SVG (right, sticky on desktop).
   * @param {string} innerHtml
   * @param {string} diagramSrc
   * @param {string} diagramAlt
   * @param {{ cardiganHalfSide?: "left" | "right"; backDiagramModeToggle?: boolean; frontDiagramModeToggle?: boolean }} [diagramOpts]
   */
  function wrapSleevelessPieceSplit(innerHtml, diagramSrc, diagramAlt, postSplitHtml, diagramOpts) {
    const src = escapeHtml(diagramSrc);
    const alt = escapeHtml(diagramAlt);
    const post = postSplitHtml || "";
    const half = diagramOpts?.cardiganHalfSide;
    const halfAttr =
      half === "left" || half === "right" ? ` data-sleeveless-cardigan-half="${half}"` : "";
    const backModeToggle = diagramOpts?.backDiagramModeToggle === true;
    const frontModeToggle = diagramOpts?.frontDiagramModeToggle === true;
    const garmentModeToggle = backModeToggle || frontModeToggle;
    const backDiagramAttrs = backModeToggle
      ? ' data-sleeveless-back-diagram data-sleeveless-back-diagram-mode="sts-rows"'
      : "";
    const frontDiagramAttrs = frontModeToggle
      ? ' data-sleeveless-front-diagram data-sleeveless-front-diagram-mode="sts-rows"'
      : "";
    const diagramModeAttrs = `${backDiagramAttrs}${frontDiagramAttrs}`;
    const modeToggleGroupLabel = backModeToggle ? "Back diagram view" : "Front diagram view";
    const modeBtnAttr = backModeToggle
      ? "data-sleeveless-back-diagram-mode-btn"
      : "data-sleeveless-front-diagram-mode-btn";
    const modeToggleHtml = garmentModeToggle
      ? `<div class="sleeveless-back-diagram-mode no-print" role="group" aria-label="${modeToggleGroupLabel}">
        <button type="button" class="sleeveless-back-diagram-mode__btn is-active" ${modeBtnAttr}="sts-rows" aria-pressed="true">Stitches &amp; Rows</button>
        <button type="button" class="sleeveless-back-diagram-mode__btn" ${modeBtnAttr}="shaping-notation" aria-pressed="false">Shaping Notation</button>
      </div>`
      : "";
    const diagramTriggerHtml = `<button type="button" class="sleeveless-piece-split__diagram-trigger" data-sleeveless-diagram-trigger aria-label="Open larger diagram: ${alt}">
        <div class="sleeveless-piece-split__diagram-svg" data-sleeveless-diagram data-src="${src}" data-alt="${alt}"${halfAttr}${diagramModeAttrs}>
          <p class="sleeveless-pattern-boot-msg">Loading diagram…</p>
        </div>
      </button>`;
    const diagramEnlargeBtnHtml = `<button type="button" class="sleeveless-piece-split__diagram-enlarge-btn no-print" data-sleeveless-diagram-enlarge aria-label="Enlarge diagram">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      </button>`;
    const diagramCardHtml = `<div class="sleeveless-piece-split__diagram-card">
        ${diagramEnlargeBtnHtml}
        ${diagramTriggerHtml}
      </div>`;
    const diagramAsideInner = garmentModeToggle
      ? `<div class="sleeveless-back-diagram-panel">
      ${modeToggleHtml}
      <div class="sleeveless-back-diagram-well">
        ${diagramCardHtml}
      </div>
    </div>`
      : diagramCardHtml;
    return `<div class="pattern-layout pattern-layout--garment-columns sleeveless-piece-split">
  <div class="pattern-layout__content sleeveless-piece-split__text">${innerHtml}</div>
  <aside class="pattern-layout__sidebar sleeveless-piece-split__diagram" aria-label="Garment diagram">
    <div class="sleeveless-piece-split__diagram-inner${garmentModeToggle ? " sleeveless-piece-split__diagram-inner--back-panel" : ""}">
      ${diagramAsideInner}
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

  function inferSleevelessDiagramPiece(src, alt) {
    const s = String(src || "").toLowerCase();
    const a = String(alt || "").toLowerCase();
    if (
      s.includes("diagram-jp-back") ||
      s.includes("diagram-back") ||
      a.includes(" back ")
    ) {
      return "back";
    }
    if (
      s.includes("diagram-cardigan") ||
      s.includes("diagram-jp-cardigan") ||
      s.includes("sleeveless/cardigan-round") ||
      s.includes("sleeveless/cardigan-v") ||
      s.includes("cardigan-round") ||
      s.includes("cardigan-v.svg") ||
      s.includes("cardigan-half-front")
    ) {
      return "front";
    }
    if (
      s.includes("diagram-jp-front") ||
      s.includes("jp-diagram-front") ||
      s.includes("diagram-front") ||
      a.includes(" front ")
    )
      return "front";
    return "shared";
  }

  /**
   * Build placeholder replacements for sleeveless diagrams.
   * Values are sourced from {@link SleevelessBackPatternResult.debug} where possible to avoid duplicate math.
   */
  function buildSleevelessDiagramReplacements(result, unit, opts) {
    const piece = opts?.piece || "shared";
    const patternData = opts?.patternData;
    const rawHalf = opts?.cardiganHalfSide;
    const cardiganHalfSide = rawHalf === "left" || rawHalf === "right" ? rawHalf : undefined;
    return buildSleevelessGarmentDiagramReplacements(result, unit, {
      patternData,
      measurementPiece: piece,
      cardiganHalfSide,
    });
  }

  async function inlineSvgWithReplacements(hostEl, src, alt, replacements, hydrateGeneration, guideOpts) {
    if (!(hostEl instanceof HTMLElement)) return;
    const hydrateGen =
      hydrateGeneration === undefined || hydrateGeneration === null
        ? null
        : String(hydrateGeneration);
    if (hydrateGen) hostEl.dataset.sleevelessHydrateGen = hydrateGen;
    try {
      if (import.meta.env.DEV) {
        console.log("[sleeveless] Garment schematic SVG fetch (pattern tab):", src, alt || "");
      }
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

      const guideLayout =
        guideOpts?.layout === "front" ||
        guideOpts?.layout === "back" ||
        guideOpts?.layout === "cardiganHalfLeft" ||
        guideOpts?.layout === "cardiganHalfRight"
          ? guideOpts.layout
          : undefined;
      if (guideLayout && guideOpts?.diagramGuides) {
        injectBodyShapeGuidesIntoGarmentSvg(svg, guideOpts.diagramGuides, guideLayout);
      }

      // Match print route: inject SVG via markup string. importNode(from DOMParser doc) can fail to paint SVG in some browsers.
      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) return;
      hostEl.innerHTML = svg.outerHTML;
    } catch (err) {
      console.warn("[sleeveless] Diagram load failed:", err);
      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) return;
      hostEl.innerHTML = `<p class="sleeveless-pattern-boot-msg">Diagram unavailable.</p>`;
    }
  }

  /** @type {{ result: import("../lib/patterns/sleevelessPatternOutput").SleevelessBackPatternResult; unit: string; diagramPatternData: unknown; hydrateGeneration: number } | null} */
  let sleevelessBackDiagramHydrateContext = null;
  /** @type {{ result: import("../lib/patterns/sleevelessPatternOutput").SleevelessBackPatternResult; unit: string; diagramPatternData: unknown; hydrateGeneration: number } | null} */
  let sleevelessFrontDiagramHydrateContext = null;

  function backDiagramAltForMode(mode) {
    return mode === "shaping-notation" ? BACK_DIAGRAM_NOTATION_ALT : BACK_DIAGRAM_STS_ROWS_ALT;
  }

  function frontDiagramAltForMode(mode) {
    return mode === "shaping-notation" ? FRONT_DIAGRAM_NOTATION_ALT : FRONT_DIAGRAM_STS_ROWS_ALT;
  }

  function updateBackDiagramModeUi(root, mode) {
    if (!root) return;
    const backSection = root.querySelector("#sg-back");
    if (!backSection) return;
    backSection.querySelectorAll("[data-sleeveless-back-diagram-mode-btn]").forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const btnMode = btn.getAttribute("data-sleeveless-back-diagram-mode-btn");
      const active = btnMode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const trigger = backSection.querySelector("[data-sleeveless-diagram-trigger]");
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute("aria-label", `Open larger diagram: ${backDiagramAltForMode(mode)}`);
    }
  }

  function updateFrontDiagramModeUi(root, mode) {
    if (!root) return;
    const frontSection = root.querySelector("#sg-front");
    if (!frontSection) return;
    frontSection.querySelectorAll("[data-sleeveless-front-diagram-mode-btn]").forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const btnMode = btn.getAttribute("data-sleeveless-front-diagram-mode-btn");
      const active = btnMode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const trigger = frontSection.querySelector("[data-sleeveless-diagram-trigger]");
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute("aria-label", `Open larger diagram: ${frontDiagramAltForMode(mode)}`);
    }
  }

  async function inlineBackJapaneseNotationSvg(hostEl, result, patternData, hydrateGeneration) {
    if (!(hostEl instanceof HTMLElement)) return;
    const hydrateGen =
      hydrateGeneration === undefined || hydrateGeneration === null
        ? null
        : String(hydrateGeneration);
    if (hydrateGen) hostEl.dataset.sleevelessHydrateGen = hydrateGen;
    try {
      const notationSrc = resolveSleevelessBackDiagramSrc("shaping-notation");
      const res = await fetch(notationSrc, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Failed to load SVG: ${notationSrc} (${res.status})`);
      const jpReplacements = buildBackJapaneseNotationReplacements(result, patternData);
      const svgText = applyJapaneseNotationSvgReplacements(await res.text(), jpReplacements);

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
      svg.setAttribute("aria-label", BACK_DIAGRAM_NOTATION_ALT);
      svg.classList.add("sleeveless-piece-split__diagram-inline");

      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) return;
      hostEl.innerHTML = svg.outerHTML;
    } catch (err) {
      console.warn("[sleeveless] Back shaping notation diagram failed:", err);
      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) return;
      hostEl.innerHTML = `<p class="sleeveless-pattern-boot-msg">Diagram unavailable.</p>`;
    }
  }

  async function inlineFrontJapaneseNotationSvg(hostEl, result, patternData, hydrateGeneration) {
    const frontJpLog = "[sleeveless:front-jp-notation]";
    if (!(hostEl instanceof HTMLElement)) {
      console.warn(frontJpLog, "abort: missing diagram host container", { hostEl });
      return;
    }
    const hydrateGen =
      hydrateGeneration === undefined || hydrateGeneration === null
        ? null
        : String(hydrateGeneration);
    if (hydrateGen) hostEl.dataset.sleevelessHydrateGen = hydrateGen;
    const fetchUrl = resolveSleevelessFrontDiagramSrc("shaping-notation", patternData);
    console.log(frontJpLog, "fetch URL:", fetchUrl);
    try {
      const res = await fetch(fetchUrl, { credentials: "same-origin" });
      console.log(frontJpLog, "fetch response:", {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        url: res.url,
      });
      if (!res.ok) {
        throw new Error(`Failed to load SVG: ${fetchUrl} (${res.status})`);
      }
      const rawSvgText = await res.text();
      console.log(frontJpLog, "raw SVG text:", {
        returned: rawSvgText.length > 0,
        byteLength: rawSvgText.length,
        startsWithSvg: /^\s*<svg[\s>]/i.test(rawSvgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "")),
      });
      const jpReplacements = buildFrontJapaneseNotationReplacements(result, patternData);
      let svgText;
      try {
        svgText = applyJapaneseNotationSvgReplacements(rawSvgText, jpReplacements);
        console.log(frontJpLog, "applyJapaneseNotationSvgReplacements: ok", {
          outputLength: svgText.length,
        });
      } catch (replaceErr) {
        const replaceMessage =
          replaceErr instanceof Error ? replaceErr.message : String(replaceErr);
        console.error(frontJpLog, "applyJapaneseNotationSvgReplacements: threw", replaceMessage, replaceErr);
        throw replaceErr;
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
      svg.setAttribute("aria-label", FRONT_DIAGRAM_NOTATION_ALT);
      svg.classList.add("sleeveless-piece-split__diagram-inline");

      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) {
        console.log(frontJpLog, "abort: stale hydrate generation", {
          expected: hydrateGen,
          current: hostEl.dataset.sleevelessHydrateGen,
        });
        return;
      }
      hostEl.innerHTML = svg.outerHTML;
      console.log(frontJpLog, "diagram injected into host");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failureKind =
        message.includes("Failed to load SVG")
          ? "fetch"
          : message.includes("SVG parse error") || message.toLowerCase().includes("parse")
            ? "svg-parse"
            : "replacement-or-other";
      console.warn("[sleeveless] Front shaping notation diagram failed:", err);
      console.warn(frontJpLog, "fallback: Diagram unavailable.", {
        failureKind,
        message,
        fetchUrl,
      });
      if (hydrateGen && hostEl.dataset.sleevelessHydrateGen !== hydrateGen) return;
      hostEl.innerHTML = `<p class="sleeveless-pattern-boot-msg">Diagram unavailable.</p>`;
    }
  }

  async function hydrateSleevelessFrontDiagram(
    el,
    mode,
    result,
    unit,
    patternData,
    hydrateGeneration,
    guideOpts,
  ) {
    if (!(el instanceof HTMLElement)) return;
    if (mode === "shaping-notation") {
      await inlineFrontJapaneseNotationSvg(el, result, patternData, hydrateGeneration);
      return;
    }
    const replacements = buildSleevelessDiagramReplacements(result, unit, {
      piece: "front",
      patternData,
      cardiganHalfSide: guideOpts?.cardiganHalfSide,
    });
    await inlineSvgWithReplacements(
      el,
      resolveSleevelessFrontDiagramSrc("sts-rows", patternData),
      FRONT_DIAGRAM_STS_ROWS_ALT,
      replacements,
      hydrateGeneration,
      {
        diagramGuides: guideOpts?.diagramGuides,
        layout: guideOpts?.layout,
      },
    );
  }

  async function hydrateSleevelessBackDiagram(el, mode, result, unit, patternData, hydrateGeneration) {
    if (!(el instanceof HTMLElement)) return;
    const diagramSrc = resolveSleevelessBackDiagramSrc(mode);
    el.dataset.src = diagramSrc;
    if (import.meta.env.DEV) {
      console.log("[sleeveless] Back garment schematic route:", { mode, src: diagramSrc });
    }
    if (mode === "shaping-notation") {
      await inlineBackJapaneseNotationSvg(el, result, patternData, hydrateGeneration);
      return;
    }
    const replacements = buildSleevelessDiagramReplacements(result, unit, {
      piece: "back",
      patternData,
    });
    await inlineSvgWithReplacements(
      el,
      diagramSrc,
      BACK_DIAGRAM_STS_ROWS_ALT,
      replacements,
      hydrateGeneration,
      {
        diagramGuides: result?.debug?.diagramGuides,
        layout: "back",
      },
    );
  }

  function bindSleevelessBackDiagramMode(root) {
    if (!root || root.dataset.sleevelessBackDiagramModeBound === "true") return;
    root.dataset.sleevelessBackDiagramModeBound = "true";
    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-sleeveless-back-diagram-mode-btn]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const mode = btn.getAttribute("data-sleeveless-back-diagram-mode-btn");
      if (mode !== "sts-rows" && mode !== "shaping-notation") return;
      const backHost = root.querySelector("[data-sleeveless-back-diagram]");
      if (!(backHost instanceof HTMLElement)) return;
      if (backHost.dataset.sleevelessBackDiagramMode === mode) return;
      const ctx = sleevelessBackDiagramHydrateContext;
      if (!ctx || ctx.hydrateGeneration !== sleevelessRenderMountSeq) return;
      backHost.dataset.sleevelessBackDiagramMode = mode;
      backHost.innerHTML = '<p class="sleeveless-pattern-boot-msg">Loading diagram…</p>';
      updateBackDiagramModeUi(root, mode);
      void hydrateSleevelessBackDiagram(
        backHost,
        mode,
        ctx.result,
        ctx.unit,
        ctx.diagramPatternData,
        sleevelessRenderMountSeq,
      );
    });
  }

  function bindSleevelessFrontDiagramMode(root) {
    if (!root || root.dataset.sleevelessFrontDiagramModeBound === "true") return;
    root.dataset.sleevelessFrontDiagramModeBound = "true";
    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-sleeveless-front-diagram-mode-btn]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const mode = btn.getAttribute("data-sleeveless-front-diagram-mode-btn");
      if (mode !== "sts-rows" && mode !== "shaping-notation") return;
      const frontHost = root.querySelector("[data-sleeveless-front-diagram]");
      if (!(frontHost instanceof HTMLElement)) return;
      if (frontHost.dataset.sleevelessFrontDiagramMode === mode) return;
      const ctx = sleevelessFrontDiagramHydrateContext;
      if (!ctx || ctx.hydrateGeneration !== sleevelessRenderMountSeq) return;
      frontHost.dataset.sleevelessFrontDiagramMode = mode;
      frontHost.innerHTML = '<p class="sleeveless-pattern-boot-msg">Loading diagram…</p>';
      updateFrontDiagramModeUi(root, mode);
      void hydrateSleevelessFrontDiagram(
        frontHost,
        mode,
        ctx.result,
        ctx.unit,
        ctx.diagramPatternData,
        sleevelessRenderMountSeq,
        {
          diagramGuides: ctx.result?.debug?.diagramGuides,
          layout: "front",
        },
      );
    });
  }

  async function hydrateSleevelessDiagrams(root, result, unit, patternData, hydrateOpts) {
    if (!root) return;
    const frontResolution = hydrateOpts?.frontResolution;
    const frontCardiganHalfSide =
      isSleevelessCardiganHalfFrontDiagramType(frontResolution?.diagramType) &&
      frontResolution?.diagramType !== "cardiganHalfFrontV" &&
      frontResolution?.frontPieceType === "leftFront"
        ? "left"
        : isSleevelessCardiganHalfFrontDiagramType(frontResolution?.diagramType) &&
            frontResolution?.frontPieceType === "rightFront"
          ? "right"
          : undefined;
    const hosts = root.querySelectorAll("[data-sleeveless-diagram]");
    const jobs = [];
    hosts.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.hasAttribute("data-sleeveless-back-diagram")) {
        const mode =
          el.dataset.sleevelessBackDiagramMode === "shaping-notation"
            ? "shaping-notation"
            : "sts-rows";
        jobs.push(
          hydrateSleevelessBackDiagram(
            el,
            mode,
            result,
            unit,
            patternData,
            hydrateOpts?.hydrateGeneration,
          ),
        );
        return;
      }
      if (el.hasAttribute("data-sleeveless-front-diagram")) {
        const mode =
          el.dataset.sleevelessFrontDiagramMode === "shaping-notation"
            ? "shaping-notation"
            : "sts-rows";
        jobs.push(
          hydrateSleevelessFrontDiagram(
            el,
            mode,
            result,
            unit,
            patternData,
            hydrateOpts?.hydrateGeneration,
            {
              diagramGuides: result?.debug?.diagramGuides,
              layout: "front",
            },
          ),
        );
        return;
      }
      const src =
        el.getAttribute("data-src") || (typeof el.dataset.src === "string" ? el.dataset.src : "") || "";
      const alt = el.getAttribute("data-alt") || el.dataset.alt || "";
      if (!src) return;
      const piece = inferSleevelessDiagramPiece(src, alt);
      const isFrontSchematic =
        frontResolution !== undefined && src === frontResolution.src;
      const dsHalf = el.dataset.sleevelessCardiganHalf || "";
      const cardiganHalfSide = isFrontSchematic
        ? frontCardiganHalfSide ??
          (isSleevelessCardiganGarmentStyle(patternData) ? "left" : undefined)
        : dsHalf === "left" || dsHalf === "right"
          ? dsHalf
          : undefined;
      const replacements = buildSleevelessDiagramReplacements(result, unit, {
        piece,
        patternData,
        cardiganHalfSide,
      });
      let guideLayout = piece === "front" ? "front" : "back";
      let diagramGuides = result?.debug?.diagramGuides;
      if (
        isFrontSchematic &&
        cardiganHalfSide &&
        diagramGuides?.showBodyShapeGuides
      ) {
        diagramGuides = scaleDiagramGuidesForCardiganHalf(diagramGuides, cardiganHalfSide);
        guideLayout = cardiganHalfSide === "right" ? "cardiganHalfRight" : "cardiganHalfLeft";
      }
      jobs.push(
        inlineSvgWithReplacements(el, src, alt, replacements, hydrateOpts?.hydrateGeneration, {
          diagramGuides,
          layout: guideLayout,
        }),
      );
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
      const enlargeBtn = target.closest("[data-sleeveless-diagram-enlarge]");
      if (enlargeBtn instanceof HTMLElement) {
        e.preventDefault();
        const card = enlargeBtn.closest(".sleeveless-piece-split__diagram-card");
        const trigger = card?.querySelector("[data-sleeveless-diagram-trigger]");
        if (trigger instanceof HTMLElement) {
          openSleevelessDiagramModal(trigger);
        }
        return;
      }
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
      .ns-shaping-chart__table-scroll,
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
      .ns-shaping-chart__intro {
        margin: 0 0 0.55rem;
      }
      .ns-shaping-chart__table-scroll {
        max-height: none !important;
        overflow: visible !important;
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
      a.dataset.navSectionId = found.id;
      a.textContent = item.label;
      track.appendChild(a);
      count += 1;
    }
    if (count > 0) {
      appendSleevelessInpageNavPrintPill(track);
    }
    nav.replaceChildren(track);
    nav.hidden = count === 0;
    if (count > 0) {
      bindSleevelessInpageNavScrollSpy();
      updateSleevelessInpageNavActivePill();
    }
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

  function setPatternSectionCollapsed(section, collapsed) {
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    if (!id) return;
    const header = section.querySelector(":scope > .pattern-section__header");
    const checkbox = header?.querySelector("input.pattern-section__collapse");
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.checked = collapsed;
    section.classList.toggle("is-collapsed", collapsed);
    try {
      localStorage.setItem(`sleevelessPattern_section_${id}`, collapsed ? "true" : "false");
    } catch {
      /* quota */
    }
  }

  function scrollPatternSectionHeader(section) {
    if (!(section instanceof HTMLElement)) return;
    const header = section.querySelector(":scope > .pattern-section__header");
    scrollToBuilderSection(header instanceof HTMLElement ? header : section);
  }

  function applyPatternSectionCollapseState(root) {
    if (!root) return;
    root.querySelectorAll(".pattern-section, .pattern-subsection").forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const id = section.dataset.sectionId;
      if (!id) return;
      const collapsed = localStorage.getItem(`sleevelessPattern_section_${id}`) === "true";
      setPatternSectionCollapsed(section, collapsed);
    });
  }

  function bindPatternSectionCollapsePersistence(root) {
    if (!root) return;
    if (root.dataset.patternSectionCollapseBound === "true") return;
    root.dataset.patternSectionCollapseBound = "true";
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.classList.contains("pattern-section__collapse")) return;
      const section = t.closest(".pattern-section, .pattern-subsection");
      const id = t.dataset.sectionId || section?.dataset.sectionId;
      if (!(section instanceof HTMLElement) || !id) return;

      const collapsed = t.checked;
      setPatternSectionCollapsed(section, collapsed);

      if (!collapsed) {
        scrollPatternSectionHeader(section);
      }
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

  function buildFinishingHtml(patternMergedForNeckline, patternDebug) {
    const isVNeckFinishing = isSleevelessVNeckChoice(patternMergedForNeckline);
    const neckFinishingVideoKey = isVNeckFinishing ? "vNeckBandFinishing" : "onePieceBand";
    const neckFinishingVideoMeta = SLEEVELESS_HELP_VIDEOS[neckFinishingVideoKey];
    const neckFinishingButtonLabel =
      neckFinishingVideoMeta && neckFinishingVideoMeta.title
        ? String(neckFinishingVideoMeta.title).trim()
        : isVNeckFinishing
          ? "Optional V-Neck Band Tutorial"
          : "One-piece neckband";
    const neckFinishingLeadHtml =
      isVNeckFinishing && neckFinishingVideoMeta && String(neckFinishingVideoMeta.description || "").trim()
        ? `<p class="pattern-finishing-lead">${escapeHtml(String(neckFinishingVideoMeta.description).trim())}</p>`
        : "";

    const debug =
      patternDebug && typeof patternDebug === "object"
        ? /** @type {SleevelessBackPatternDebug} */ (patternDebug)
        : /** @type {SleevelessBackPatternDebug} */ ({});

    const finishing = sleevelessFinishingFromPattern(patternMergedForNeckline, debug);

    return buildSleevelessFinishingStepsHtml({
      isCardigan: finishing.isCardigan,
      cardiganFrontEdgeFinishingMode: finishing.cardiganFrontEdgeFinishingMode,
      frontEdgePickupSts: finishing.frontEdgePickupSts,
      deps: {
        escapeHtml,
        glossaryTooltip,
        oneShoulderFinishingHelpHtml,
        neckFinishingVideoKey,
        neckFinishingButtonLabel,
        neckFinishingLeadHtml,
      },
    });
  }

  function activateWizardTab(target, opts) {
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

    if (
      target === "pattern" &&
      !opts?.skipRefresh &&
      typeof window.kbmRefreshSleevelessPattern === "function"
    ) {
      window.kbmRefreshSleevelessPattern();
    }
  }

  function bindTabs() {
    const root = document.querySelector(".sleeveless-pattern-page .pattern-tabs");
    if (root) {
      root.querySelectorAll(".tab-btn").forEach((el) => {
        if (!(el instanceof HTMLButtonElement)) return;
        el.addEventListener("click", () => {
          const target = el.dataset.tab;
          if (!target) return;
          activateWizardTab(target);
        });
      });
    }

    const editBtn = document.getElementById("edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const patternData = getPatternData();
        const pdStyle = patternData.style;
        const pdExpress =
          pdStyle &&
          typeof pdStyle === "object" &&
          !Array.isArray(pdStyle) &&
          /** @type {Record<string, unknown>} */ (pdStyle).patternMode === "express";
        const canonStyle = getCurrentPattern().style;
        const canonExpress =
          canonStyle &&
          typeof canonStyle === "object" &&
          !Array.isArray(canonStyle) &&
          /** @type {Record<string, unknown>} */ (canonStyle).patternMode === "express";

        if (pdExpress || canonExpress) {
          clearSleevelessExpressSession();
          window.location.replace("/patterns/sleeveless-express");
          return;
        }

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

  /**
   * Suppresses stale post-await wiring when a new `renderMount` run replaces the DOM while a prior one
   * is still awaiting (e.g. rapid tab/builder refreshes). Otherwise chart controls can get duplicate
   * listeners — the hide-completed toggle fires twice and appears to do nothing.
   */
  let sleevelessRenderMountSeq = 0;
  let sleevelessPatternRefreshInFlight = false;
  let sleevelessPatternRefreshQueued = false;

  async function renderMount(patternMerged, result, unit, generatorPatternData) {
    const mount = document.querySelector("[data-sleeveless-mount]");
    if (!mount) return;

    const renderSeq = ++sleevelessRenderMountSeq;

    /** Same style/fit shape as {@link generateSleevelessBackPattern} input — keeps front schematic routing aligned with math. */
    const diagramPatternData = buildSleevelessGarmentDiagramPatternData(
      patternMerged,
      generatorPatternData,
    );

    const displayRows = result.displayRows ?? [];
    const frontDisplayRows = result.frontDisplayRows ?? [];
    const patternIntroSentence = buildPatternIntroSentence(patternMerged, generatorPatternData);
    const backRendered =
      displayRows.length > 0
        ? renderSleevelessDisplayHtml(
            displayRows,
            "sg-neck-shoulder-chart-table-back",
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

    const backNotationSupported = isBackJapaneseNotationSupported(diagramPatternData, result);
    const backWrapped = wrapSleevelessPieceSplit(
      backInner,
      BACK_DIAGRAM_STS_ROWS_SRC,
      BACK_DIAGRAM_STS_ROWS_ALT,
      backPost,
      backNotationSupported ? { backDiagramModeToggle: true } : undefined,
    );
    const frontDiagramResolution = resolveSleevelessFrontDiagram(diagramPatternData, {
      devForceCardiganHalfLeft: false,
    });
    const frontCardiganHalfSide =
      isSleevelessCardiganHalfFrontDiagramType(frontDiagramResolution.diagramType) &&
      frontDiagramResolution.diagramType !== "cardiganHalfFrontV" &&
      frontDiagramResolution.frontPieceType === "leftFront"
        ? "left"
        : isSleevelessCardiganHalfFrontDiagramType(frontDiagramResolution.diagramType) &&
            frontDiagramResolution.frontPieceType === "rightFront"
          ? "right"
          : undefined;
    const frontIsCardigan = frontDiagramResolution.garmentStyle === "cardigan";
    const frontIsHalfDev = isSleevelessCardiganHalfFrontDiagramType(frontDiagramResolution.diagramType);
    const frontIsCardiganV =
      frontDiagramResolution.diagramType === "cardiganFullFrontV" ||
      frontDiagramResolution.diagramType === "cardiganHalfFrontV";
    const frontDiagramAlt = frontIsCardigan
      ? frontIsHalfDev
        ? "Sleeveless cardigan left front diagram (development)"
        : frontIsCardiganV
          ? "Sleeveless cardigan V-neck front diagram"
          : "Sleeveless cardigan front diagram"
      : "Sleeveless front piece diagram";
    if (import.meta.env.DEV) {
      console.log("[sleeveless] Front garment schematic route:", {
        src: frontDiagramResolution.src,
        diagramType: frontDiagramResolution.diagramType,
        garmentStyle: frontDiagramResolution.garmentStyle,
        frontPieceType: frontDiagramResolution.frontPieceType,
        cardiganHalfSide: frontCardiganHalfSide ?? null,
      });
    }
    const frontNotationSupported = isFrontJapaneseNotationSupported(diagramPatternData, result);
    const frontWrapSrc = frontNotationSupported
      ? resolveSleevelessFrontDiagramSrc("sts-rows", diagramPatternData)
      : frontDiagramResolution.src;
    const frontWrapped = wrapSleevelessPieceSplit(
      frontInner,
      frontWrapSrc,
      frontDiagramAlt,
      frontPost,
      frontNotationSupported
        ? { frontDiagramModeToggle: true }
        : frontCardiganHalfSide
          ? { cardiganHalfSide: frontCardiganHalfSide }
          : undefined,
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
      wrapPatternSection("sg-finishing", "Finishing", buildFinishingHtml(patternMerged, result.debug), {
        defaultCollapsed: true,
      });

    const patternContentEl = document.getElementById("pattern-content");
    const existingDevCardiganBanner = patternContentEl?.querySelector("[data-sleeveless-dev-cardigan-banner]");
    if (existingDevCardiganBanner) existingDevCardiganBanner.remove();
    if (import.meta.env.DEV && isSleevelessDevCardiganExpressPreview(diagramPatternData) && patternContentEl) {
      const devBanner = document.createElement("p");
      devBanner.className = "sleeveless-dev-cardigan-banner no-print pattern-subtext";
      devBanner.dataset.sleevelessDevCardiganBanner = "";
      devBanner.setAttribute("role", "status");
      devBanner.textContent = "Development Cardigan Preview";
      const inpageNav = patternContentEl.querySelector("[data-sleeveless-pattern-inpage-nav]");
      if (inpageNav) patternContentEl.insertBefore(devBanner, inpageNav);
      else patternContentEl.insertBefore(devBanner, patternContentEl.firstChild);
    }

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
    // Finishing HTML + chart table HTML (incl. glossary placeholders) are injected above.
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
    sleevelessBackDiagramHydrateContext = {
      result,
      unit,
      diagramPatternData,
      hydrateGeneration: renderSeq,
    };
    sleevelessFrontDiagramHydrateContext = frontNotationSupported
      ? {
          result,
          unit,
          diagramPatternData,
          hydrateGeneration: renderSeq,
        }
      : null;

    await hydrateSleevelessDiagrams(mount, result, unit, diagramPatternData, {
      frontResolution: frontDiagramResolution,
      hydrateGeneration: renderSeq,
    });
    if (renderSeq !== sleevelessRenderMountSeq) return;

    ensureSleevelessDiagramModal();
    bindSleevelessDiagramZoom(mount);
    bindSleevelessBackDiagramMode(mount);
    bindSleevelessFrontDiagramMode(mount);
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

    initChartProgressTracking({ patternId: getCurrentPattern().id, root: mount });

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

  async function refreshPatternTabContent() {
    if (sleevelessPatternRefreshInFlight) {
      sleevelessPatternRefreshQueued = true;
      return;
    }
    sleevelessPatternRefreshInFlight = true;
    try {
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
      setPatternTabsReadiness(tabsRoot, false);
      return;
    }

    setPatternTabsReadiness(tabsRoot, true);
    showResults(resultsVisibilityConfig);

    const genInput = buildGeneratorPatternData(patternMerged);
    const result = generateSleevelessBackPattern(genInput);

    const yg = section(patternMerged.yarnGauge);
    const ygm =
      patternData.yarnGaugeMachine && typeof patternData.yarnGaugeMachine === "object"
        ? section(patternData.yarnGaugeMachine)
        : {};
    const unit = (ygm && ygm.gaugeRawUnit === "cm") || (yg && yg.gaugeRawUnit === "cm") ? "cm" : "in";

    updateSleevelessPrintBasicsSummarySlot(patternMerged, patternData, true);

    await renderMount(patternMerged, result, unit, genInput);
    } catch (err) {
      console.error("[sleeveless] Pattern tab refresh failed:", err);
    } finally {
      sleevelessPatternRefreshInFlight = false;
      if (sleevelessPatternRefreshQueued) {
        sleevelessPatternRefreshQueued = false;
        void refreshPatternTabContent();
      }
    }
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
    void (async () => {
      await refreshPatternTabContent();
      if (hadTabPatternQuery) activateWizardTab("pattern", { skipRefresh: true });
    })();

    const canonKey = getPatternStorageKey();
    window.addEventListener("storage", (e) => {
      if (!e.key || (e.key !== PATTERN_BUILDER_DATA_KEY && e.key !== canonKey)) return;
      void refreshPatternTabContent();
    });
  }
