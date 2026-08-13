import { initChartProgressTracking } from "../../scripts/chartProgressTracker";
import {
  buildRoundNecklineSkillBuilderBeforeYouBegin,
  buildRoundNecklineSkillBuilderDiagramHtml,
  buildRoundNecklineSkillBuilderShoulderWorkHtml,
} from "./roundNecklineSkillBuilderDiagram";
import {
  calculateRoundNecklineSkillBuilder,
  type RoundNecklineSkillBuilderExerciseId,
  type RoundNecklineSkillBuilderId,
  type RoundNecklineSkillBuilderResult,
} from "./roundNecklineSkillBuilders";

export function renderRoundNecklineSkillBuilderWorksheet(
  root: HTMLElement,
  result: RoundNecklineSkillBuilderResult,
): void {
  const diagram = root.querySelector<HTMLElement>("[data-sb-diagram]");
  if (diagram) {
    diagram.innerHTML = buildRoundNecklineSkillBuilderDiagramHtml(result);
    diagram.removeAttribute("aria-hidden");
  }

  const gaugePrint = root.querySelector("[data-sb-gauge-print]");
  if (gaugePrint) {
    gaugePrint.textContent = `Gauge: ${result.gauge.stitchesPerFourInches} stitches and ${result.gauge.rowsPerFourInches} rows per 4 inches.`;
  }

  const begin = root.querySelector("[data-sb-before-begin]");
  if (begin) begin.textContent = buildRoundNecklineSkillBuilderBeforeYouBegin(result);

  for (const side of ["left", "right"] as const) {
    const work = buildRoundNecklineSkillBuilderShoulderWorkHtml(result, side);
    const checklist = root.querySelector<HTMLElement>(`[data-sb-shoulder-checklist="${side}"]`);
    if (checklist) checklist.innerHTML = work.checklistHtml;
  }

  initChartProgressTracking({
    patternId: `sb-${result.builderId}-${result.exerciseId}`,
    root,
  });

  root.hidden = false;
}

export function applyShoulderTabSelection(
  tabs: readonly HTMLButtonElement[],
  panels: readonly HTMLElement[],
  next: HTMLButtonElement,
): void {
  const controls = next.getAttribute("aria-controls");
  for (const tab of tabs) {
    const selected = tab === next;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) {
    const show = Boolean(controls) && panel.id === controls;
    panel.hidden = !show;
    if (show) panel.removeAttribute("aria-hidden");
    else panel.setAttribute("aria-hidden", "true");
  }
}

export function bindShoulderTabs(page: HTMLElement): void {
  const tablist = page.querySelector<HTMLElement>('[data-sb-shoulder-tabs] [role="tablist"]');
  if (!tablist || tablist.dataset.sbTabsBound === "true") return;
  tablist.dataset.sbTabsBound = "true";

  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs
    .map((tab) => {
      const id = tab.getAttribute("aria-controls");
      return id ? page.querySelector<HTMLElement>(`#${id}`) : null;
    })
    .filter((panel): panel is HTMLElement => panel instanceof HTMLElement);

  function selectTab(next: HTMLButtonElement): void {
    applyShoulderTabSelection(tabs, panels, next);
  }

  const initial =
    tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];
  if (initial) selectTab(initial);

  tablist.addEventListener("click", (event) => {
    const tab = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[role="tab"]');
    if (!tab || !tabs.includes(tab)) return;
    selectTab(tab);
  });

  tablist.addEventListener("keydown", (event) => {
    const current = document.activeElement;
    if (!(current instanceof HTMLButtonElement) || !tabs.includes(current)) return;
    const index = tabs.indexOf(current);
    let nextIndex = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const delta = event.key === "ArrowRight" ? 1 : -1;
      nextIndex = (index + delta + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex < 0) return;
    const next = tabs[nextIndex];
    if (!next) return;
    event.preventDefault();
    next.focus();
    selectTab(next);
  });
}

export function bindRoundNecklineSkillBuilderPage(): void {
  const page = document.querySelector<HTMLElement>("[data-sb-round-neckline-exercise]");
  if (!page) return;

  const builderId = page.dataset.sbBuilder as RoundNecklineSkillBuilderId | undefined;
  const exerciseId = page.dataset.sbExercise as RoundNecklineSkillBuilderExerciseId | undefined;
  const stitchInput = page.querySelector<HTMLInputElement>('input[id$="-stitch-gauge"]');
  const rowInput = page.querySelector<HTMLInputElement>('input[id$="-row-gauge"]');
  const results = page.querySelector<HTMLElement>("[data-sb-results]");

  if (!builderId || !exerciseId || !stitchInput || !rowInput || !results) return;

  bindShoulderTabs(page);

  function calculateFromInputs(): void {
    const stitchesPerFourInches = parseFloat(stitchInput!.value);
    const rowsPerFourInches = parseFloat(rowInput!.value);
    if (
      !Number.isFinite(stitchesPerFourInches) ||
      stitchesPerFourInches <= 0 ||
      !Number.isFinite(rowsPerFourInches) ||
      rowsPerFourInches <= 0
    ) {
      results!.hidden = true;
      page!.querySelector("[data-sb-diagram]")?.replaceChildren();
      return;
    }

    const next = calculateRoundNecklineSkillBuilder(
      { stitchesPerFourInches, rowsPerFourInches },
      builderId!,
      exerciseId!,
    );
    if (!next) {
      results!.hidden = true;
      page!.querySelector("[data-sb-diagram]")?.replaceChildren();
      return;
    }

    renderRoundNecklineSkillBuilderWorksheet(results!, next);
  }

  stitchInput.addEventListener("input", calculateFromInputs);
  rowInput.addEventListener("input", calculateFromInputs);
  stitchInput.addEventListener("change", calculateFromInputs);
  rowInput.addEventListener("change", calculateFromInputs);
  calculateFromInputs();
}
