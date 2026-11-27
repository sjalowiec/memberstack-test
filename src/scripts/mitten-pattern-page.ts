import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import { initPatternDiagramTabs } from "../lib/patterns/patternDiagramTabs";
import { bindPatternSectionCollapse } from "../lib/patterns/sleevelessPatternDisplayHtml";
import {
  bindSleevelessDiagramZoom,
  ensureSleevelessDiagramModal,
} from "../lib/patterns/sleevelessDiagramModal";
import {
  buildMittenPatternHtml,
  mittenPatternInpageNavItems,
} from "../lib/patterns/mitten/mittenInstructions";
import {
  buildMittenPatternPrintBasicsHtml,
  resolveMittenPatternPrintFields,
} from "../lib/patterns/mitten/mittenPatternPrint";
import { buildMittenDiagramSvg, mittenDiagramFigureHtml } from "../lib/patterns/mitten/mittenDiagramSvg";
import { draftForBuilderSize } from "../lib/patterns/mitten/mittenBuilderState";
import {
  HAT_GAUGE_CM_TO_IN_FACTOR,
  HAT_GAUGE_IN_TO_CM_FACTOR,
} from "../lib/patterns/hat/hatBuilderGaugeUnits";
import {
  formatMeasurementDisplayFromInches,
  parseMeasurementInputToInches,
  parseStoredInchesForDisplay,
  type MeasurementDisplayUnit,
} from "../lib/patterns/patternMeasurementDisplayUnit";
import {
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  type PatternSummaryOverlayCleanup,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import {
  MITTEN_BUILDER_HREF,
  MITTEN_PATTERN_HREF,
  mittenInputFromDraft,
  readMittenDraft,
  womanSmallExampleDraft,
  writeMittenDraft,
  type MittenDraft,
} from "../lib/patterns/mitten/mittenDraft";
import { persistMittenPatternProject } from "../lib/patterns/mitten/mittenPatternProjectSave";
import {
  readMittenActiveProjectId,
  resolveMittenPatternDisplayName,
} from "../lib/patterns/mitten/mittenSavedProject";
import { calculateMittenPattern } from "../lib/patterns/mitten/mittenMath";
import { withSavedPatternProjectId } from "../lib/patterns/savedPatternViewUrl";
import { MITTEN_SUMMARY_EDIT_HREF } from "../lib/patterns/customPatternProjectNavigation";
import { ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import { mountPatternPrintAction, syncPatternInpageNav } from "../lib/patterns/patternInpageNav";
import { applyPatternPrintPersonalizationToDom, triggerPatternPrint } from "./patternPrintPersonalization";

function currentDraft(): MittenDraft | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small" && !params.get("project")) {
    return womanSmallExampleDraft();
  }
  return readMittenDraft();
}

const MEASUREMENT_INPUTS: Record<string, keyof MittenDraft> = {
  "mitten-cuff-circ": "cuffCircumference",
  "mitten-cuff-length": "cuffLength",
  "mitten-hand-circ": "handCircumference",
  "mitten-hand-length": "handLength",
  "mitten-hand2": "hand2Length",
  "mitten-thumb-length": "thumbLength",
  "mitten-thumb-circ": "thumbCircumference",
};

function fieldValue(id: string): string {
  const node = document.getElementById(id);
  return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement
    ? node.value.trim()
    : "";
}

function setField(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
    node.value = value;
  }
}

export async function initMittenSummaryPage(): Promise<void> {
  const root = document.querySelector("[data-mitten-summary]");
  if (!root) return;
  const loaded = await ensureUrlRequestedSavedPatternHydrated();
  const empty = document.querySelector<HTMLElement>("[data-mitten-summary-empty]");
  const workspace = document.querySelector<HTMLElement>("[data-mitten-summary-workspace]");
  const feedback = document.getElementById("mitten-summary-feedback");
  if (loaded === "load-failed") {
    if (empty) empty.hidden = false;
    const message = empty?.querySelector("[data-mitten-summary-empty-message]");
    if (message) message.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const starting =
    params.get("example") === "woman-small" && !params.get("project")
      ? womanSmallExampleDraft()
      : readMittenDraft();
  if (!starting || !workspace) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  workspace.hidden = false;

  let draft: MittenDraft = starting;
  let displayUnit: MeasurementDisplayUnit = "in";
  let applying = false;
  let overlayCleanup: PatternSummaryOverlayCleanup | null = null;
  writeMittenDraft(draft);

  function showFeedback(message: string): void {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
  }

  function displayMeasurement(stored: string): string {
    if (displayUnit === "in") return stored;
    const inches = parseStoredInchesForDisplay(stored);
    return inches === undefined ? "" : formatMeasurementDisplayFromInches(inches, "cm");
  }

  function displayGauge(stored: string): string {
    if (!stored.trim()) return "";
    const n = Number(stored);
    if (!Number.isFinite(n)) return "";
    return displayUnit === "cm" ? (n * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1) : stored;
  }

  function storeMeasurement(raw: string): string {
    if (displayUnit === "in") return raw.trim();
    const inches = parseMeasurementInputToInches(raw, "cm");
    return inches === undefined ? "" : String(inches);
  }

  function storeGauge(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return "";
    return displayUnit === "cm" ? (n * HAT_GAUGE_CM_TO_IN_FACTOR).toFixed(1) : trimmed;
  }

  function paint(): void {
    applying = true;
    setField("mitten-pattern-name", draft.patternProject?.title ?? "");
    setField("mitten-edit-notes", draft.patternProject?.notes ?? "");
    setField("mitten-size", draft.sizeId);
    setField("mitten-thumb-style", draft.thumbStyle === "gored" ? "gored" : "slotted");
    for (const [id, key] of Object.entries(MEASUREMENT_INPUTS)) {
      const stored = draft[key];
      setField(id, displayMeasurement(typeof stored === "string" ? stored : ""));
    }
    setField("mitten-stitch-gauge", displayGauge(draft.stitchGaugePer4));
    setField("mitten-row-gauge", displayGauge(draft.rowGaugePer4));
    document.querySelectorAll<HTMLElement>("[data-mitten-edit-unit-suffix]").forEach((node) => {
      node.textContent = displayUnit === "cm" ? "cm" : '"';
    });
    document.querySelectorAll<HTMLButtonElement>("[data-mitten-edit-unit]").forEach((btn) => {
      const on = btn.getAttribute("data-mitten-edit-unit") === (displayUnit === "cm" ? "cm" : "inches");
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const gaugeHelp = document.querySelector("[data-mitten-edit-gauge-help]");
    if (gaugeHelp) {
      gaugeHelp.textContent =
        displayUnit === "cm" ? "stitches / rows over 10 cm" : "stitches / rows over 4 inches";
    }
    applying = false;
    mountDiagram();
  }

  function readDraftFromForm(): MittenDraft {
    const title = fieldValue("mitten-pattern-name");
    const notes = fieldValue("mitten-edit-notes");
    const next: MittenDraft = {
      ...draft,
      sizeId: fieldValue("mitten-size"),
      cuffCircumference: storeMeasurement(fieldValue("mitten-cuff-circ")),
      cuffLength: storeMeasurement(fieldValue("mitten-cuff-length")),
      handCircumference: storeMeasurement(fieldValue("mitten-hand-circ")),
      handLength: storeMeasurement(fieldValue("mitten-hand-length")),
      hand2Length: storeMeasurement(fieldValue("mitten-hand2")),
      thumbLength: storeMeasurement(fieldValue("mitten-thumb-length")),
      thumbCircumference: storeMeasurement(fieldValue("mitten-thumb-circ")),
      thumbStyle: fieldValue("mitten-thumb-style") === "gored" ? "gored" : "slotted",
      stitchGaugePer4: storeGauge(fieldValue("mitten-stitch-gauge")),
      rowGaugePer4: storeGauge(fieldValue("mitten-row-gauge")),
      patternProject: {
        title,
        notes,
        titleCustomized: Boolean(title) || draft.patternProject?.titleCustomized === true,
      },
      updatedAt: new Date().toISOString(),
    };
    return next;
  }

  function mountDiagram(): void {
    const diagramHost = document.querySelector<HTMLElement>("[data-mitten-edit-diagram]");
    const stageInner = document.querySelector<HTMLElement>("[data-mitten-edit-stage]");
    const overlay = document.querySelector<HTMLElement>("[data-mitten-edit-overlay]");
    if (!diagramHost || !stageInner || !overlay) return;
    const result = calculateMittenPattern(mittenInputFromDraft(draft));
    if (!result.ok) {
      showFeedback(result.message);
      diagramHost.innerHTML = "";
      return;
    }
    showFeedback("");
    diagramHost.innerHTML = buildMittenDiagramSvg(result.calc, "right", "summary");
    overlayCleanup?.();
    const svg = diagramHost.querySelector("svg");
    if (svg instanceof SVGElement) {
      overlayCleanup = bindPatternSummaryOverlayPositioning(
        stageInner,
        svg,
        overlay,
        collectOverlayAnchors(overlay),
      );
    }
  }

  function commitForm(): void {
    if (applying) return;
    draft = readDraftFromForm();
    writeMittenDraft(draft);
    mountDiagram();
  }

  paint();

  workspace.addEventListener("input", commitForm);
  workspace.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "mitten-size") {
      const next = draftForBuilderSize({
        sizeId: target.value,
        previous: target.value && target.value === draft.sizeId ? draft : { ...draft, sizeId: "" },
        stitchGaugePer4: storeGauge(fieldValue("mitten-stitch-gauge")),
        rowGaugePer4: storeGauge(fieldValue("mitten-row-gauge")),
        thumbStyle: fieldValue("mitten-thumb-style") === "gored" ? "gored" : "slotted",
      });
      if (next) {
        next.patternProject = readDraftFromForm().patternProject;
        draft = next;
        writeMittenDraft(draft);
        paint();
        return;
      }
    }
    commitForm();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mitten-edit-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      draft = readDraftFromForm();
      displayUnit = btn.getAttribute("data-mitten-edit-unit") === "cm" ? "cm" : "in";
      paint();
    });
  });

  document.getElementById("mitten-view-pattern")?.addEventListener("click", () => {
    draft = readDraftFromForm();
    const result = calculateMittenPattern(mittenInputFromDraft(draft));
    if (!result.ok) {
      showFeedback(result.message);
      return;
    }
    writeMittenDraft(draft);
    const projectId = readMittenActiveProjectId();
    window.location.assign(
      projectId ? withSavedPatternProjectId(MITTEN_PATTERN_HREF, projectId) : MITTEN_PATTERN_HREF,
    );
  });

  document.getElementById("mitten-save-pattern")?.addEventListener("click", () => {
    draft = readDraftFromForm();
    void saveMittenFromSummary(draft, showFeedback, (saved) => {
      draft = saved;
      paint();
    });
  });

}

async function saveMittenFromSummary(
  draft: MittenDraft,
  showFeedback: (message: string) => void,
  afterSave: (draft: MittenDraft) => void,
): Promise<void> {
  const result = calculateMittenPattern(mittenInputFromDraft(draft));
  if (!result.ok) {
    showFeedback(result.message);
    return;
  }
  writeMittenDraft(draft);
  const name = draft.patternProject?.title?.trim() || resolveMittenPatternDisplayName(draft);
  showFeedback("Saving your mitten…");
  const saved = await persistMittenPatternProject({ draft, name });
  if (!saved.ok) {
    showFeedback(saved.error);
    return;
  }
  afterSave(readMittenDraft() ?? draft);
  showFeedback(
    saved.created ? `Saved “${saved.project.name}” to My Patterns.` : `Updated “${saved.project.name}”.`,
  );
}

export async function initMittenPatternPage(): Promise<void> {
  const root = document.querySelector("[data-mitten-pattern]");
  const body = document.getElementById("mitten-pattern-root");
  if (!root || !body) return;
  const loaded = await ensureUrlRequestedSavedPatternHydrated();
  if (loaded === "load-failed") {
    body.innerHTML = `<p data-mitten-pattern-empty-message>${SAVED_PATTERN_UNAVAILABLE_BODY}</p>`;
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small" && !params.get("project")) {
    writeMittenDraft(womanSmallExampleDraft());
  }
  const draft = currentDraft();
  if (!draft) {
    body.innerHTML = `<p data-mitten-pattern-empty-message>No mitten draft is saved in this browser. <a href="${MITTEN_BUILDER_HREF}?example=woman-small">Open the Woman Small example</a>.</p>`;
    return;
  }
  const result = calculateMittenPattern(mittenInputFromDraft(draft));
  if (!result.ok) {
    body.innerHTML = `<p>${result.message}</p>`;
    return;
  }
  body.innerHTML = buildMittenPatternHtml(result.calc);
  bindMittenPatternChrome(root);
  const heading = document.querySelector("[data-mitten-pattern-heading]");
  if (heading) heading.textContent = resolveMittenPatternDisplayName(draft);
  const printFields = resolveMittenPatternPrintFields({ draft });
  applyPatternPrintPersonalizationToDom(printFields.title, printFields.notes);
  const glance = document.querySelector("[data-mitten-print-basics]");
  if (glance) glance.innerHTML = buildMittenPatternPrintBasicsHtml(draft);
  const edit = document.querySelector("[data-mitten-edit-open]");
  const projectId =
    new URLSearchParams(window.location.search).get("project")?.trim() || readMittenActiveProjectId();
  if (edit instanceof HTMLAnchorElement) {
    edit.href = projectId
      ? withSavedPatternProjectId(MITTEN_SUMMARY_EDIT_HREF, projectId)
      : MITTEN_SUMMARY_EDIT_HREF;
    edit.hidden = false;
  }
  const nav = document.querySelector("[data-saved-pattern-sticky-nav]");
  if (nav instanceof HTMLElement) nav.hidden = false;
  mountPatternPrintAction({
    host: document.querySelector("[data-mitten-pattern-actions]"),
    visible: true,
    onPrint: (button) => {
      triggerPatternPrint(button, {});
    },
  });
  const notes = document.querySelector("[data-saved-pattern-member-notes-open]");
  if (notes instanceof HTMLButtonElement) {
    const { refreshSavedPatternMemberNotes } = await import("./savedPatternMemberNotes");
    refreshSavedPatternMemberNotes(notes);
  }
}

export function renderMittenPatternFromDraft(target: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small") return;
  const draft = readMittenDraft();
  if (!draft) {
    target.innerHTML = `<p>No mitten draft is saved in this browser. <a href="${MITTEN_BUILDER_HREF}?example=woman-small">Open the Woman Small example</a>.</p>`;
    return;
  }
  const result = calculateMittenPattern(mittenInputFromDraft(draft));
  if (!result.ok) {
    target.innerHTML = `<p>${result.message}</p>`;
    return;
  }
  target.innerHTML = buildMittenPatternHtml(result.calc);
  bindMittenPatternChrome(target);
}

function bindMittenPatternChrome(scope: ParentNode): void {
  bindMittenTabs(scope);
  syncMittenPatternInpageNav(scope);
  bindPatternSectionCollapse(scope);
  hydrateGlossaryTooltipPlaceholders(scope);
  initPatternDiagramTabs(scope);
  const zoomRoot =
    scope instanceof HTMLElement ? scope : document.querySelector<HTMLElement>("[data-mitten-pattern]");
  if (zoomRoot instanceof HTMLElement) {
    ensureSleevelessDiagramModal();
    bindSleevelessDiagramZoom(zoomRoot);
  }
}

function activeMittenId(scope: ParentNode): "right-edge" | "left-edge" {
  const selected = scope.querySelector<HTMLButtonElement>("[data-mitten-tab][aria-selected='true']");
  return selected?.getAttribute("data-mitten-tab") === "left-edge" ? "left-edge" : "right-edge";
}

/** Point the shared sticky nav at the mitten that is on screen. */
export function syncMittenPatternInpageNav(scope: ParentNode): void {
  const thumbStyle = scope.querySelector("[data-thumb-style]")?.getAttribute("data-thumb-style");
  syncPatternInpageNav({
    items: mittenPatternInpageNavItems(
      activeMittenId(scope),
      thumbStyle === "gored" ? "gored" : "slotted",
    ),
  });
}

export function bindMittenTabs(scope: ParentNode): void {
  const thumbStyle = scope.querySelector("[data-thumb-style]")?.getAttribute("data-thumb-style");
  const tabs = scope.querySelectorAll<HTMLButtonElement>("[data-mitten-tab]");
  if (thumbStyle === "gored") {
    tabs.forEach((tab) => {
      const id = tab.getAttribute("data-mitten-tab");
      tab.textContent = id === "left-edge" ? "Left-edge thumb" : "Right-edge thumb";
    });
  }
  const panels = scope.querySelectorAll<HTMLElement>("[data-mitten]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-mitten-tab");
      tabs.forEach((other) => {
        const selected = other === tab;
        other.classList.toggle("is-selected", selected);
        other.setAttribute("aria-selected", selected ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute("data-mitten") !== id;
      });
      syncMittenPatternInpageNav(scope);
    });
  });
}
