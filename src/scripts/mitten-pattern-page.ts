import { mittenCountSummary, buildMittenPatternHtml } from "../lib/patterns/mitten/mittenInstructions";
import { mittenDiagramFigureHtml } from "../lib/patterns/mitten/mittenDiagramSvg";
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
import { mountPatternPrintAction } from "../lib/patterns/patternInpageNav";
import { triggerPatternPrint } from "./patternPrintPersonalization";
import {
  bindMittenSizeAutofill,
  evaluateMittenForm,
  fillMittenForm,
  readMittenFormDraft,
} from "./mitten-builder-page";

function renderCounts(target: HTMLElement, lines: Array<{ label: string; value: string }>): void {
  target.innerHTML = lines
    .map(
      (line) =>
        `<div class="mitten-count"><dt>${line.label}</dt><dd>${line.value}</dd></div>`,
    )
    .join("");
}

function countsHtml(lines: Array<{ label: string; value: string }>): string {
  return `<dl class="mitten-counts">${lines
    .map((line) => `<div class="mitten-count"><dt>${line.label}</dt><dd>${line.value}</dd></div>`)
    .join("")}</dl>`;
}

function currentDraft(): MittenDraft | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small" && !params.get("project")) {
    return womanSmallExampleDraft();
  }
  return readMittenDraft();
}

export async function initMittenSummaryPage(): Promise<void> {
  const root = document.querySelector("[data-mitten-summary]");
  if (!root) return;
  const loaded = await ensureUrlRequestedSavedPatternHydrated();
  const params = new URLSearchParams(window.location.search);
  if (loaded === "load-failed") {
    const feedback = document.getElementById("mitten-summary-feedback");
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;
    }
    return;
  }
  const draft =
    params.get("example") === "woman-small" && !params.get("project")
      ? womanSmallExampleDraft()
      : (readMittenDraft() ?? womanSmallExampleDraft());
  fillMittenForm(draft);
  bindMittenSizeAutofill();

  const counts = document.getElementById("mitten-summary-counts");
  const feedback = document.getElementById("mitten-summary-feedback");
  const show = () => {
    const result = evaluateMittenForm();
    if (!counts) return;
    if (!result.ok) {
      counts.innerHTML = "";
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = result.message;
      }
      const diagrams = document.getElementById("mitten-summary-diagrams");
      if (diagrams) diagrams.innerHTML = "";
      return;
    }
    if (feedback) feedback.hidden = true;
    renderCounts(counts, mittenCountSummary(result.calc));
    const diagrams = document.getElementById("mitten-summary-diagrams");
    if (diagrams) {
      diagrams.innerHTML = mittenDiagramFigureHtml(result.calc, "right") + mittenDiagramFigureHtml(result.calc, "left");
    }
  };
  show();
  root.addEventListener("input", show);
  root.addEventListener("change", show);

  document.getElementById("mitten-view-pattern")?.addEventListener("click", () => {
    const result = evaluateMittenForm();
    if (!result.ok) {
      show();
      return;
    }
    writeMittenDraft(readMittenFormDraft());
    const projectId = readMittenActiveProjectId();
    window.location.assign(
      projectId ? withSavedPatternProjectId(MITTEN_PATTERN_HREF, projectId) : MITTEN_PATTERN_HREF,
    );
  });

  document.getElementById("mitten-save-pattern")?.addEventListener("click", () => {
    void saveMittenFromSummary();
  });
}

async function saveMittenFromSummary(): Promise<void> {
  const feedback = document.getElementById("mitten-summary-feedback");
  const result = evaluateMittenForm();
  if (!result.ok) {
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = result.message;
    }
    return;
  }
  const draft = readMittenFormDraft();
  writeMittenDraft(draft);
  const name = draft.patternProject?.title?.trim() || resolveMittenPatternDisplayName(draft);
  if (feedback) {
    feedback.hidden = false;
    feedback.textContent = "Saving your mitten…";
  }
  const saved = await persistMittenPatternProject({ draft, name });
  if (!saved.ok) {
    if (feedback) feedback.textContent = saved.error;
    return;
  }
  fillMittenForm(readMittenDraft() ?? draft);
  if (feedback) {
    feedback.textContent = saved.created
      ? `Saved “${saved.project.name}” to My Patterns.`
      : `Updated “${saved.project.name}”.`;
  }
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
  bindMittenTabs(root);
  const heading = document.querySelector("[data-mitten-pattern-heading]");
  if (heading) heading.textContent = resolveMittenPatternDisplayName(draft);
  const glance = document.querySelector("[data-mitten-print-basics]");
  if (glance) glance.innerHTML = countsHtml(mittenCountSummary(result.calc));
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
  bindMittenTabs(target);
}

export function bindMittenTabs(scope: ParentNode): void {
  const tabs = scope.querySelectorAll<HTMLButtonElement>("[data-mitten-tab]");
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
    });
  });
}
