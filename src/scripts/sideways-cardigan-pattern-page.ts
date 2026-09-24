/**
 * Sideways V-Neck Sweater workspace — body instructions plus cuff-up / top-down sleeves.
 * Does not boot the Sleeveless page initializer.
 */
import {
  resolveSidewaysCardiganGarmentStyle,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import {
  loadSidewaysCardiganWorkspaceView,
  mergeSidewaysCardiganWorkingDraft,
  type SidewaysCardiganWorkspaceView,
} from "../lib/patterns/sidewaysCardiganWorkspaceLoad";
import {
  buildSidewaysCardiganPatternDiagramTabsShellHtml,
  buildSidewaysCardiganSleeveDiagramTabsShellHtml,
  initSidewaysCardiganPatternDiagramTabs,
  initSidewaysCardiganSleeveDiagramTabs,
} from "../lib/patterns/sidewaysCardiganPatternDiagramTabs";
import {
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
} from "../lib/patterns/sidewaysCardiganPatternDiagramSvg";
import { buildSidewaysCardiganShapingNotationDiagramSvg } from "../lib/patterns/sidewaysCardiganShapingNotationDiagramSvg";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "../lib/patterns/sidewaysCardiganSleeveDiagramSvg";
import { positiveMeasurementInches } from "../lib/patterns/customBuildEffectiveArmholeDepth";
import { inspectSidewaysCardiganSleeveCalcInputFromPattern } from "../lib/patterns/sidewaysCardiganSleeveCalc";
import {
  renderSidewaysSleeveSequenceForDirection,
  resolveSidewaysFinishedSleeveDirection,
} from "../lib/patterns/sidewaysCardiganSleeveInstructions";
import { writeDropShoulderSleeveConstruction } from "../lib/patterns/dropShoulderSleeveConstruction";
import {
  SLEEVELESS_DIAGRAM_INLINE_CLASS,
  bindSleevelessDiagramZoom,
  closeSleevelessDiagramModal,
  ensureSleevelessDiagramModal,
} from "../lib/patterns/sleevelessDiagramModal";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import { readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { buildSidewaysCardiganSummaryEditFromPatternHref } from "../lib/patterns/sidewaysCardiganPatternNavigation";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import { bindPatternSectionCollapse } from "../lib/patterns/sleevelessPatternDisplayHtml";
import { syncPatternInpageNav } from "../lib/patterns/patternInpageNav";
import { SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS } from "../lib/patterns/sidewaysCardiganPatternInpageNav";
import { buildSidewaysCardiganPatternHeaderDetailsHtml } from "../lib/patterns/sidewaysCardiganPatternHeaderDetails";
import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader";
import { initChartProgressTracking } from "./chartProgressTracker";
import { getCurrentPattern } from "../lib/patterns/patternStorage";

function syncSidewaysPatternInpageNav(): void {
  syncPatternInpageNav({ items: SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS });
}

function sleeveViewForFinishedPattern(
  view: Extract<SidewaysCardiganWorkspaceView, { ok: true }>,
  patternId: string,
): Extract<SidewaysCardiganWorkspaceView, { ok: true }> {
  const direction = resolveSidewaysFinishedSleeveDirection(view.sleeveDirection, patternId);
  if (direction === "sideways" || direction === view.sleeveDirection) return view;
  const inspected = inspectSidewaysCardiganSleeveCalcInputFromPattern(
    view.pattern,
    view.calc,
    view.input.finishedUpperArmInches,
    {
      stitchesPerInch: view.input.stitchesPerInch,
      rowsPerInch: view.input.rowsPerInch,
    },
  );
  if (!inspected.input) return view;
  const rendered = renderSidewaysSleeveSequenceForDirection(inspected.input, direction);
  if (!rendered.ok) return view;
  return {
    ...view,
    sleeveDirection: direction,
    sleeveInstructions: rendered.instructions,
    sleeveHtml: rendered.html,
  };
}

function bindSidewaysSleeveConstructionChoice(
  sleeveEl: HTMLElement,
  view: Extract<SidewaysCardiganWorkspaceView, { ok: true }>,
): void {
  if (sleeveEl.dataset.sidewaysSleeveConstructionBound === "true") return;
  sleeveEl.dataset.sidewaysSleeveConstructionBound = "true";
  sleeveEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("[data-drop-shoulder-sleeve-construction]");
    if (!(btn instanceof HTMLButtonElement) || !sleeveEl.contains(btn)) return;
    const raw = btn.getAttribute("data-drop-shoulder-sleeve-construction");
    const direction = raw === "top-down" ? "top-down" : "cuff-up";
    const patternId = String(getCurrentPattern()?.id ?? "").trim();
    writeDropShoulderSleeveConstruction(patternId || "default", direction);
    const inspected = inspectSidewaysCardiganSleeveCalcInputFromPattern(
      view.pattern,
      view.calc,
      view.input.finishedUpperArmInches,
      {
        stitchesPerInch: view.input.stitchesPerInch,
        rowsPerInch: view.input.rowsPerInch,
      },
    );
    if (!inspected.input) return;
    const rendered = renderSidewaysSleeveSequenceForDirection(inspected.input, direction);
    if (!rendered.ok) return;
    const nextView: Extract<SidewaysCardiganWorkspaceView, { ok: true }> = {
      ...view,
      sleeveDirection: direction,
      sleeveInstructions: rendered.instructions,
      sleeveHtml: rendered.html,
    };
    sleeveEl.innerHTML = rendered.html;
    bindPatternSectionCollapse(sleeveEl);
    hydrateGlossaryTooltipPlaceholders(sleeveEl);
    if (patternId) {
      try {
        initChartProgressTracking({ root: sleeveEl, patternId });
      } catch {
        /* checklist persistence is optional */
      }
    }
    closeSleevelessDiagramModal();
    fillSidewaysSleeveDiagrams(nextView, sleeveEl);
    bindSidewaysSleeveConstructionChoice(sleeveEl, nextView);
  });
}

function fillSidewaysPatternHeaderDetails(): void {
  const introEl = document.querySelector("[data-sg-pattern-intro]");
  if (!(introEl instanceof HTMLElement)) return;
  try {
    introEl.innerHTML = buildSidewaysCardiganPatternHeaderDetailsHtml(
      mergeSidewaysCardiganWorkingDraft(),
    );
  } catch {
    introEl.innerHTML = "";
  }
}

function renderView(): void {
  stampSidewaysCardiganWorkingDraftFromPage();
  applySleevelessPatternOnlineProjectHeader();
  fillSidewaysPatternHeaderDetails();

  const missing = document.querySelector("[data-sideways-calc-missing]");
  const host = document.querySelector("[data-sideways-calc-host]");
  const errorEl = document.querySelector("[data-sideways-calc-error]");
  const sequenceEl = document.querySelector("[data-sideways-body-sequence]");
  const sleeveHost = document.querySelector("[data-sideways-sleeve-host]");
  const sleeveEl = document.querySelector("[data-sideways-sleeve-sequence]");
  const sleeveErrorEl = document.querySelector("[data-sideways-sleeve-error]");
  const diagramHost = document.querySelector("[data-sideways-diagram-tabs-mount]");
  if (!(missing instanceof HTMLElement) || !(host instanceof HTMLElement)) {
    return;
  }

  const showDiagnostic = (message: string): void => {
    missing.hidden = false;
    missing.textContent = message;
    host.hidden = true;
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    if (sequenceEl instanceof HTMLElement) sequenceEl.innerHTML = "";
    if (sleeveHost instanceof HTMLElement) sleeveHost.hidden = true;
    if (sleeveEl instanceof HTMLElement) sleeveEl.innerHTML = "";
    if (sleeveErrorEl instanceof HTMLElement) {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
    if (diagramHost instanceof HTMLElement) diagramHost.replaceChildren();
    syncSidewaysPatternInpageNav();
  };

  let view;
  try {
    view = loadSidewaysCardiganWorkspaceView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showDiagnostic(
      import.meta.env.DEV
        ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
        : "This Sideways V-Neck Sweater could not be loaded from the saved draft.",
    );
    return;
  }

  if (!view.ok) {
    showDiagnostic(view.message);
    return;
  }

  missing.hidden = true;
  missing.textContent = "";
  host.hidden = false;
  if (errorEl instanceof HTMLElement) {
    if (view.instructionError) {
      errorEl.hidden = false;
      errorEl.textContent = view.instructionError;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  if (sequenceEl instanceof HTMLElement) {
    if (view.sequenceHtml) {
      sequenceEl.innerHTML = view.sequenceHtml;
      bindPatternSectionCollapse(sequenceEl);
      hydrateGlossaryTooltipPlaceholders(sequenceEl);
      try {
        const patternId = String(getCurrentPattern()?.id ?? "").trim();
        if (patternId) {
          initChartProgressTracking({ root: sequenceEl, patternId });
        }
      } catch {
        /* pattern id is optional for checklist persistence */
      }
    } else if (view.instructionError) {
      sequenceEl.replaceChildren();
      const note = document.createElement("p");
      note.className = "sg-fit-size-copy";
      note.setAttribute("role", "alert");
      note.textContent = view.instructionError;
      sequenceEl.append(note);
    } else {
      sequenceEl.replaceChildren();
    }
  }

  const patternId = String(getCurrentPattern()?.id ?? "").trim();
  const sleeveView = sleeveViewForFinishedPattern(view, patternId);
  const hasSleeveContent = Boolean(sleeveView.sleeveHtml) || Boolean(sleeveView.sleeveError);
  if (sleeveHost instanceof HTMLElement) {
    sleeveHost.hidden = !hasSleeveContent;
  }
  if (sleeveErrorEl instanceof HTMLElement) {
    if (sleeveView.sleeveError) {
      sleeveErrorEl.hidden = false;
      sleeveErrorEl.textContent = sleeveView.sleeveError;
    } else {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
  }
  if (sleeveEl instanceof HTMLElement) {
    sleeveEl.innerHTML = sleeveView.sleeveError ? "" : sleeveView.sleeveHtml;
    if (!sleeveView.sleeveError && sleeveView.sleeveHtml) {
      bindPatternSectionCollapse(sleeveEl);
      hydrateGlossaryTooltipPlaceholders(sleeveEl);
      bindSidewaysSleeveConstructionChoice(sleeveEl, sleeveView);
      try {
        const patternId = String(getCurrentPattern()?.id ?? "").trim();
        if (patternId) {
          initChartProgressTracking({ root: sleeveEl, patternId });
        }
      } catch {
        /* pattern id is optional for checklist persistence */
      }
    }
  }

  fillSidewaysPatternDiagrams(view);
  fillSidewaysSleeveDiagrams(sleeveView, sleeveEl instanceof HTMLElement ? sleeveEl : document);
  syncSidewaysPatternInpageNav();
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function markSidewaysDiagramForEnlarge(host: HTMLElement): void {
  const svg = host.querySelector("svg");
  if (svg) svg.classList.add(SLEEVELESS_DIAGRAM_INLINE_CLASS);
}

function savedSleeveMeasurementInches(pattern: Record<string, unknown>): {
  sleeveLengthInches?: number;
  wristInches?: number;
} {
  const fit = section(pattern.fit);
  const measurements = section(fit.selectedMeasurements);
  const overrides = section(fit.cbMeasurementOverrides);
  const sleeveLengthInches =
    positiveMeasurementInches(overrides.sleeveLength) ??
    positiveMeasurementInches(measurements.sleeve_length);
  const wristInches =
    positiveMeasurementInches(overrides.wrist) ?? positiveMeasurementInches(measurements.wrist);
  return {
    ...(sleeveLengthInches !== undefined ? { sleeveLengthInches } : {}),
    ...(wristInches !== undefined ? { wristInches } : {}),
  };
}

function fillSidewaysPatternDiagrams(
  view: Extract<SidewaysCardiganWorkspaceView, { ok: true }>,
): void {
  const diagramHost = document.querySelector("[data-sideways-diagram-tabs-mount]");
  if (!(diagramHost instanceof HTMLElement)) return;

  const sleeveCalc = view.sleeveInstructions?.calc ?? null;
  const inspectedSleeve = inspectSidewaysCardiganSleeveCalcInputFromPattern(
    view.pattern,
    view.calc,
    view.input.finishedUpperArmInches,
    {
      stitchesPerInch: view.input.stitchesPerInch,
      rowsPerInch: view.input.rowsPerInch,
    },
  );
  const savedSleeve = savedSleeveMeasurementInches(view.pattern);
  const instructionSequences = view.instructions
    ? {
        vNeckIncreaseSequence: view.instructions.increaseSequence,
        vNeckDecreaseSequence: view.instructions.decreaseSequence,
      }
    : {
        vNeckIncreaseSequence: [] as number[],
        vNeckDecreaseSequence: [] as number[],
      };
  const model = buildSidewaysCardiganPatternDiagramModel({
    garmentStyle:
      view.instructions?.garmentStyle ??
      resolveSidewaysCardiganGarmentStyle(section(view.pattern.style)),
    sleeveDirection: view.sleeveDirection,
    calc: view.calc,
    input: view.input,
    sleeveCalc,
    sleeveLengthInches:
      inspectedSleeve.input?.sleeveLengthInches ?? savedSleeve.sleeveLengthInches,
    wristInches: inspectedSleeve.input?.finishedWristInches ?? savedSleeve.wristInches,
    ...instructionSequences,
  });

  closeSleevelessDiagramModal();
  diagramHost.innerHTML = buildSidewaysCardiganPatternDiagramTabsShellHtml();
  initSidewaysCardiganPatternDiagramTabs(diagramHost);
  ensureSleevelessDiagramModal();
  bindSleevelessDiagramZoom(diagramHost);

  const stsHost = diagramHost.querySelector("[data-sideways-diagram-sts-rows-host]");
  if (stsHost instanceof HTMLElement) {
    stsHost.innerHTML = buildSidewaysCardiganPatternDiagramSvg(model);
    markSidewaysDiagramForEnlarge(stsHost);
  }
  const shapingHost = diagramHost.querySelector("[data-sideways-diagram-shaping-host]");
  if (shapingHost instanceof HTMLElement) {
    shapingHost.innerHTML = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    markSidewaysDiagramForEnlarge(shapingHost);
  }
}

function fillSidewaysSleeveDiagrams(
  view: Extract<SidewaysCardiganWorkspaceView, { ok: true }>,
  root: ParentNode,
): void {
  const diagramHost = root.querySelector("[data-sideways-sleeve-diagram-tabs-mount]");
  if (!(diagramHost instanceof HTMLElement)) return;
  const calc = view.sleeveInstructions?.calc;
  if (!calc) {
    diagramHost.replaceChildren();
    return;
  }

  diagramHost.innerHTML = buildSidewaysCardiganSleeveDiagramTabsShellHtml();
  initSidewaysCardiganSleeveDiagramTabs(diagramHost);
  ensureSleevelessDiagramModal();
  bindSleevelessDiagramZoom(diagramHost);

  const diagramArgs = {
    calc,
    stitchesPerInch: view.input.stitchesPerInch,
    rowsPerInch: view.input.rowsPerInch,
  };
  const stsHost = diagramHost.querySelector("[data-sideways-sleeve-diagram-sts-rows-host]");
  if (stsHost instanceof HTMLElement) {
    stsHost.innerHTML = buildSidewaysCardiganSleeveStitchesRowsSvg(diagramArgs) ?? "";
    markSidewaysDiagramForEnlarge(stsHost);
  }
  const shapingHost = diagramHost.querySelector("[data-sideways-sleeve-diagram-shaping-host]");
  if (shapingHost instanceof HTMLElement) {
    shapingHost.innerHTML = buildSidewaysCardiganSleeveShapingNotationSvg(diagramArgs) ?? "";
    markSidewaysDiagramForEnlarge(shapingHost);
  }
}

function wireEditPatternLink(): void {
  const edit = document.querySelector("[data-sideways-edit-open]");
  if (!(edit instanceof HTMLAnchorElement)) return;
  edit.href = buildSidewaysCardiganSummaryEditFromPatternHref(readActiveCustomPatternProjectId());
}

function boot(): void {
  void (async () => {
    try {
      const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
      if (hydrateOutcome === "load-failed") {
        applySavedPatternUnavailableMessage();
        const missing = document.querySelector("[data-sideways-calc-missing]");
        if (missing instanceof HTMLElement) {
          missing.hidden = false;
          missing.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;
        }
        return;
      }
      renderView();
      wireEditPatternLink();
    } catch (error) {
      const missing = document.querySelector("[data-sideways-calc-missing]");
      if (missing instanceof HTMLElement) {
        missing.hidden = false;
        const detail = error instanceof Error ? error.message : String(error);
        missing.textContent = import.meta.env.DEV
          ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
          : "This Sideways V-Neck Sweater could not be loaded from the saved draft.";
      }
    }
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
