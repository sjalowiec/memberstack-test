import { initChartProgressTracking } from "../../scripts/chartProgressTracker";
import {
  memberEmailFromMemberstackPayload,
  memberFirstNameFromMemberstackPayload,
} from "../patterns/memberstackMember";
import { decideRoundNecklineLeadCapture } from "./roundNecklineSkillBuilderLead";
import {
  buildRoundNecklineLeadPayload,
  submitRoundNecklineLeadRequest,
} from "./roundNecklineSkillBuilderLeadClient";
import {
  isRoundNecklineLeadRecognized,
  markRoundNecklineLeadRecognized,
} from "./roundNecklineSkillBuilderLeadHint";
import {
  buildRoundNecklineGetStartedHtml,
  buildRoundNecklineSkillBuilderDiagramHtml,
  buildRoundNecklineSkillBuilderShoulderWorkHtml,
} from "./roundNecklineSkillBuilderDiagram";
import {
  calculateRoundNecklineSkillBuilder,
  parseRoundNecklinePracticeId,
  ROUND_NECKLINE_PRACTICE_CHOICES,
  roundNecklineWorkspaceHref,
  type RoundNecklineSkillBuilderExerciseId,
  type RoundNecklineSkillBuilderId,
  type RoundNecklineSkillBuilderResult,
} from "./roundNecklineSkillBuilders";

export type RoundNecklineWorkspaceMode = "setup" | "lead" | "practice";

export function parseSkillBuilderGaugeValue(raw: string): number | null {
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function readRoundNecklineGaugeInputs(
  stitchInput: Pick<HTMLInputElement, "value">,
  rowInput: Pick<HTMLInputElement, "value">,
): { stitchesPerFourInches: number; rowsPerFourInches: number } | null {
  const stitchesPerFourInches = parseSkillBuilderGaugeValue(stitchInput.value);
  const rowsPerFourInches = parseSkillBuilderGaugeValue(rowInput.value);
  if (stitchesPerFourInches === null || rowsPerFourInches === null) return null;
  return { stitchesPerFourInches, rowsPerFourInches };
}

export function canCreateRoundNecklinePractice(
  exerciseId: string | null | undefined,
  stitchValue: string,
  rowValue: string,
): boolean {
  return (
    parseRoundNecklinePracticeId(exerciseId) !== null &&
    readRoundNecklineGaugeInputs({ value: stitchValue }, { value: rowValue }) !== null
  );
}

export function formatRoundNecklineSetupSummary(
  practiceTitle: string,
  stitchesPerFourInches: number,
  rowsPerFourInches: number,
): string {
  return `${practiceTitle} · ${stitchesPerFourInches} sts × ${rowsPerFourInches} rows per 4"`;
}

export function resolveRoundNecklinePracticeCreation(
  builderId: RoundNecklineSkillBuilderId,
  exerciseId: RoundNecklineSkillBuilderExerciseId,
  stitchValue: string,
  rowValue: string,
): RoundNecklineSkillBuilderResult | null {
  const gauge = readRoundNecklineGaugeInputs({ value: stitchValue }, { value: rowValue });
  if (!gauge) return null;
  return calculateRoundNecklineSkillBuilder(gauge, builderId, exerciseId);
}

export function syncRoundNecklineCreatePracticeButton(
  button: HTMLButtonElement | null,
  ready: boolean,
): void {
  if (!button) return;
  button.hidden = !ready;
  button.disabled = !ready;
}

export function setRoundNecklineSetupSummary(
  summaryText: HTMLElement | null,
  practiceTitle: string,
  stitchesPerFourInches: number,
  rowsPerFourInches: number,
): void {
  if (!summaryText) return;
  summaryText.textContent = formatRoundNecklineSetupSummary(
    practiceTitle,
    stitchesPerFourInches,
    rowsPerFourInches,
  );
}

export function applyRoundNecklineWorkspaceMode(
  page: HTMLElement,
  mode: RoundNecklineWorkspaceMode,
): void {
  page.dataset.sbWorkspace = mode;
  page.querySelectorAll<HTMLElement>("[data-sb-setup]").forEach((el) => {
    el.hidden = mode === "practice";
  });
  const summary = page.querySelector<HTMLElement>("[data-sb-setup-summary]");
  if (summary) summary.hidden = mode !== "practice";
  const results = page.querySelector<HTMLElement>("[data-sb-results]");
  if (results && mode !== "practice") results.hidden = true;
  const lead = page.querySelector<HTMLElement>("[data-sb-lead-capture]");
  if (lead) lead.hidden = mode !== "lead";
}

export async function readKnownRoundNecklineLeadMember(options: {
  getCurrentMember?: () => Promise<unknown>;
} = {}): Promise<{ email: string; firstName?: string } | null> {
  const getCurrentMember =
    options.getCurrentMember ??
    (() => window.$memberstackDom?.getCurrentMember?.() ?? Promise.resolve(null));
  try {
    const payload = await getCurrentMember();
    const email = memberEmailFromMemberstackPayload(payload);
    if (!email) return null;
    const firstName = memberFirstNameFromMemberstackPayload(payload);
    return firstName ? { email, firstName } : { email };
  } catch {
    return null;
  }
}

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

  const getStarted = root.querySelector("[data-sb-get-started]");
  if (getStarted) getStarted.innerHTML = buildRoundNecklineGetStartedHtml(result);

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

export function syncRoundNecklinePracticeSelection(
  page: HTMLElement,
  exerciseId: RoundNecklineSkillBuilderExerciseId,
): void {
  page.dataset.sbExercise = exerciseId;

  page.querySelectorAll<HTMLElement>("[data-sb-practice]").forEach((option) => {
    const selected = option.dataset.sbPractice === exerciseId;
    option.setAttribute("aria-checked", selected ? "true" : "false");
    option.classList.toggle("is-selected", selected);
  });

  const selectedOption = page.querySelector<HTMLElement>(`[data-sb-practice="${exerciseId}"]`);
  const description = page.querySelector("[data-sb-exercise-description]");
  if (description && selectedOption?.dataset.sbPracticeDescription) {
    description.textContent = selectedOption.dataset.sbPracticeDescription;
  }

  page.querySelectorAll<HTMLElement>("[data-sb-video-exercise]").forEach((slot) => {
    slot.hidden = slot.dataset.sbVideoExercise !== exerciseId;
  });
}

export function bindRoundNecklineSkillBuilderPage(): void {
  const page = document.querySelector<HTMLElement>("[data-sb-round-neckline-exercise]");
  if (!page || page.dataset.sbBound === "true") return;

  const builderId = page.dataset.sbBuilder as RoundNecklineSkillBuilderId | undefined;
  const stitchInput = page.querySelector<HTMLInputElement>('input[id$="-stitch-gauge"]');
  const rowInput = page.querySelector<HTMLInputElement>('input[id$="-row-gauge"]');
  const results = page.querySelector<HTMLElement>("[data-sb-results]");
  const createButton = page.querySelector<HTMLButtonElement>("[data-sb-create-practice]");
  const editButton = page.querySelector<HTMLButtonElement>("[data-sb-edit-setup]");
  const summaryText = page.querySelector<HTMLElement>("[data-sb-setup-summary-text]");
  const leadForm = page.querySelector<HTMLFormElement>("[data-sb-lead-form]");
  const leadEmailInput = page.querySelector<HTMLInputElement>("[data-sb-lead-email]");
  const leadBotInput = page.querySelector<HTMLInputElement>("[data-sb-lead-bot]");
  const leadSubmit = page.querySelector<HTMLButtonElement>("[data-sb-lead-submit]");
  const leadError = page.querySelector<HTMLElement>("[data-sb-lead-error]");
  const createError = page.querySelector<HTMLElement>("[data-sb-create-error]");

  if (!builderId || !stitchInput || !rowInput || !results) return;

  const resolvedBuilderId = builderId;
  const resolvedStitchInput = stitchInput;
  const resolvedRowInput = rowInput;
  const resolvedResults = results;

  const queryPractice = parseRoundNecklinePracticeId(
    new URLSearchParams(window.location.search).get("practice"),
  );
  const initialPractice =
    queryPractice ?? parseRoundNecklinePracticeId(page.dataset.sbExercise) ?? "shallow-back";
  syncRoundNecklinePracticeSelection(page, initialPractice);

  page.dataset.sbBound = "true";
  bindShoulderTabs(page);
  applyRoundNecklineWorkspaceMode(page, "setup");

  function currentExerciseId(): RoundNecklineSkillBuilderExerciseId {
    return parseRoundNecklinePracticeId(page.dataset.sbExercise) ?? "shallow-back";
  }

  function syncCreateButton(): void {
    if (page.dataset.sbWorkspace === "lead") {
      syncRoundNecklineCreatePracticeButton(createButton, false);
      return;
    }
    syncRoundNecklineCreatePracticeButton(
      createButton,
      canCreateRoundNecklinePractice(
        currentExerciseId(),
        resolvedStitchInput.value,
        resolvedRowInput.value,
      ),
    );
  }

  function showError(target: HTMLElement | null, message: string): void {
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
  }

  function clearError(target: HTMLElement | null): void {
    if (!target) return;
    target.textContent = "";
    target.hidden = true;
  }

  function createPractice(): void {
    const next = resolveRoundNecklinePracticeCreation(
      resolvedBuilderId,
      currentExerciseId(),
      resolvedStitchInput.value,
      resolvedRowInput.value,
    );
    if (!next) return;

    renderRoundNecklineSkillBuilderWorksheet(resolvedResults, next);
    setRoundNecklineSetupSummary(
      summaryText,
      ROUND_NECKLINE_PRACTICE_CHOICES[resolvedBuilderId][currentExerciseId()].title,
      next.gauge.stitchesPerFourInches,
      next.gauge.rowsPerFourInches,
    );
    applyRoundNecklineWorkspaceMode(page, "practice");
    const summary = page.querySelector<HTMLElement>("[data-sb-setup-summary]");
    (summary ?? resolvedResults).scrollIntoView({ behavior: "auto", block: "start" });
    resolvedResults.tabIndex = -1;
    resolvedResults.focus({ preventScroll: true });
  }

  async function submitLeadAndCreate(args: {
    email: string;
    firstName?: string;
    botField?: string;
    errorTarget: HTMLElement | null;
    pendingButton?: HTMLButtonElement | null;
  }): Promise<boolean> {
    const built = buildRoundNecklineLeadPayload({
      email: args.email,
      firstName: args.firstName,
      botField: args.botField,
    });
    if ("error" in built) {
      showError(args.errorTarget, built.error);
      return false;
    }

    if (args.pendingButton) args.pendingButton.disabled = true;
    clearError(args.errorTarget);

    const result = await submitRoundNecklineLeadRequest(built);
    if (!result.ok) {
      if (args.pendingButton) args.pendingButton.disabled = false;
      showError(args.errorTarget, result.error);
      return false;
    }

    markRoundNecklineLeadRecognized();
    createPractice();
    return true;
  }

  async function requestPractice(): Promise<void> {
    if (
      !canCreateRoundNecklinePractice(
        currentExerciseId(),
        resolvedStitchInput.value,
        resolvedRowInput.value,
      )
    ) {
      return;
    }

    clearError(createError);
    const member = await readKnownRoundNecklineLeadMember();
    const decision = decideRoundNecklineLeadCapture({
      builderId: resolvedBuilderId,
      alreadyCaptured: isRoundNecklineLeadRecognized(),
      memberEmail: member?.email,
      memberFirstName: member?.firstName,
    });

    if (decision.action === "create-practice") {
      createPractice();
      return;
    }

    if (decision.action === "submit-known-email") {
      if (createButton) createButton.disabled = true;
      const ok = await submitLeadAndCreate({
        email: decision.email,
        firstName: decision.firstName,
        errorTarget: createError,
        pendingButton: createButton,
      });
      if (!ok && createButton) {
        createButton.disabled = false;
        syncCreateButton();
      }
      return;
    }

    applyRoundNecklineWorkspaceMode(page, "lead");
    syncCreateButton();
    const leadPanel = page.querySelector<HTMLElement>("[data-sb-lead-capture]");
    leadPanel?.scrollIntoView({ behavior: "auto", block: "start" });
    leadEmailInput?.focus();
  }

  function editSetup(): void {
    applyRoundNecklineWorkspaceMode(page, "setup");
    syncCreateButton();
  }

  page.querySelectorAll<HTMLElement>("[data-sb-practice]").forEach((option) => {
    option.addEventListener("click", () => {
      const nextId = parseRoundNecklinePracticeId(option.dataset.sbPractice);
      if (!nextId) return;
      syncRoundNecklinePracticeSelection(page, nextId);
      history.replaceState(null, "", roundNecklineWorkspaceHref(resolvedBuilderId, nextId));
      syncCreateButton();
    });
  });

  resolvedStitchInput.addEventListener("input", syncCreateButton);
  resolvedRowInput.addEventListener("input", syncCreateButton);
  resolvedStitchInput.addEventListener("change", syncCreateButton);
  resolvedRowInput.addEventListener("change", syncCreateButton);
  createButton?.addEventListener("click", () => {
    void requestPractice();
  });
  editButton?.addEventListener("click", editSetup);
  leadForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (leadForm.dataset.submitting === "true") return;
    leadForm.dataset.submitting = "true";
    void submitLeadAndCreate({
      email: leadEmailInput?.value ?? "",
      botField: leadBotInput?.value ?? "",
      errorTarget: leadError,
      pendingButton: leadSubmit,
    }).finally(() => {
      leadForm.dataset.submitting = "false";
    });
  });
  syncCreateButton();
}
