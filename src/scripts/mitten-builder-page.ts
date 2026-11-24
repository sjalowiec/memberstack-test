import { calculateMittenPattern, type MittenCalcResult, type MittenThumbStyle } from "../lib/patterns/mitten/mittenMath";
import {
  draftForBuilderSize,
  mittenBuilderReady,
  mittenGaugeStepComplete,
  mittenSizeStepComplete,
  mittenThumbStepComplete,
} from "../lib/patterns/mitten/mittenBuilderState";
import {
  draftFromSizingRow,
  mittenInputFromDraft,
  readMittenDraft,
  womanSmallExampleDraft,
  writeMittenDraft,
  MITTEN_DRAFT_STORAGE_KEY,
  MITTEN_SUMMARY_HREF,
  type MittenDraft,
} from "../lib/patterns/mitten/mittenDraft";
import { mittenSizingRow, type MittenSizingRow } from "../lib/patterns/mitten/mittenSizingChart";
import {
  HAT_GAUGE_CM_TO_IN_FACTOR,
  HAT_GAUGE_IN_TO_CM_FACTOR,
} from "../lib/patterns/hat/hatBuilderGaugeUnits";

const FIELD_IDS = {
  size: "mitten-size",
  cuffCircumference: "mitten-cuff-circ",
  cuffLength: "mitten-cuff-length",
  handCircumference: "mitten-hand-circ",
  handLength: "mitten-hand-length",
  hand2Length: "mitten-hand2",
  thumbLength: "mitten-thumb-length",
  thumbCircumference: "mitten-thumb-circ",
  thumbStyle: "mitten-thumb-style",
  stitchGaugePer4: "mitten-stitch-gauge",
  rowGaugePer4: "mitten-row-gauge",
} as const;

const STEPS = 3;

function input(id: string): HTMLInputElement | HTMLSelectElement | null {
  const node = document.getElementById(id);
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) return node;
  return null;
}

function value(id: string): string {
  return input(id)?.value.trim() ?? "";
}

function valueOrStored(id: string, stored: string | undefined): string {
  const node = input(id);
  if (!node) return stored ?? "";
  return node.value.trim();
}

export function readMittenFormDraft(): MittenDraft {
  const stored = readMittenDraft();
  const nameField = input("mitten-pattern-name");
  const title = nameField ? nameField.value.trim() : stored?.patternProject?.title;
  const thumbRaw = valueOrStored(FIELD_IDS.thumbStyle, stored?.thumbStyle);
  return {
    version: 1,
    patternType: "mittens",
    patternSystem: "mittens",
    sizeId: valueOrStored(FIELD_IDS.size, stored?.sizeId),
    cuffCircumference: valueOrStored(FIELD_IDS.cuffCircumference, stored?.cuffCircumference),
    cuffLength: valueOrStored(FIELD_IDS.cuffLength, stored?.cuffLength),
    handCircumference: valueOrStored(FIELD_IDS.handCircumference, stored?.handCircumference),
    handLength: valueOrStored(FIELD_IDS.handLength, stored?.handLength),
    hand2Length: valueOrStored(FIELD_IDS.hand2Length, stored?.hand2Length),
    thumbLength: valueOrStored(FIELD_IDS.thumbLength, stored?.thumbLength),
    thumbCircumference: valueOrStored(FIELD_IDS.thumbCircumference, stored?.thumbCircumference),
    ...(thumbRaw === "gored" || thumbRaw === "slotted" ? { thumbStyle: thumbRaw } : {}),
    stitchGaugePer4: valueOrStored(FIELD_IDS.stitchGaugePer4, stored?.stitchGaugePer4),
    rowGaugePer4: valueOrStored(FIELD_IDS.rowGaugePer4, stored?.rowGaugePer4),
    ...(title || stored?.patternProject
      ? {
          patternProject: {
            title: title || stored?.patternProject?.title || "",
            notes: stored?.patternProject?.notes ?? "",
            titleCustomized: Boolean(title) || stored?.patternProject?.titleCustomized === true,
          },
        }
      : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function fillMittenForm(draft: MittenDraft): void {
  const values: Record<keyof typeof FIELD_IDS, string> = {
    size: draft.sizeId,
    cuffCircumference: draft.cuffCircumference,
    cuffLength: draft.cuffLength,
    handCircumference: draft.handCircumference,
    handLength: draft.handLength,
    hand2Length: draft.hand2Length,
    thumbLength: draft.thumbLength,
    thumbCircumference: draft.thumbCircumference,
    thumbStyle: draft.thumbStyle === "gored" ? "gored" : draft.thumbStyle === "slotted" ? "slotted" : "",
    stitchGaugePer4: draft.stitchGaugePer4,
    rowGaugePer4: draft.rowGaugePer4,
  };
  const entries = Object.entries(FIELD_IDS) as Array<[keyof typeof FIELD_IDS, string]>;
  for (const [key, id] of entries) {
    const node = input(id);
    if (node) node.value = values[key] ?? "";
  }
  const name = input("mitten-pattern-name");
  if (name && draft.patternProject?.title) name.value = draft.patternProject.title;
}

function applySizingRow(row: MittenSizingRow): void {
  const current = readMittenFormDraft();
  fillMittenForm(
    draftFromSizingRow(row, {
      stitchGaugePer4: current.stitchGaugePer4,
      rowGaugePer4: current.rowGaugePer4,
      thumbStyle: current.thumbStyle,
    }),
  );
}

export function bindMittenSizeAutofill(): void {
  input(FIELD_IDS.size)?.addEventListener("change", () => {
    const row = mittenSizingRow(value(FIELD_IDS.size));
    if (row) applySizingRow(row);
  });
}

export function evaluateMittenForm(): MittenCalcResult {
  return calculateMittenPattern(mittenInputFromDraft(readMittenFormDraft()));
}

function syncChoiceButtons(field: string, selected: string): void {
  document.querySelectorAll<HTMLButtonElement>(`[data-choice][data-field="${field}"]`).forEach((btn) => {
    const on = (btn.getAttribute("data-value") ?? "") === selected;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function sizeLabel(sizeId: string): string {
  return mittenSizingRow(sizeId)?.label ?? "";
}

function thumbLabel(style: string): string {
  if (style === "gored") return "Gored thumb";
  if (style === "slotted") return "Slotted thumb";
  return "";
}

export function initMittenBuilderPage(): void {
  const root = document.querySelector("[data-mitten-builder]");
  if (!root) return;

  const sizeSelect = input("mitten-size");
  const thumbSelect = input("mitten-thumb-style");
  const stitchInput = input("mitten-stitch-gauge");
  const rowInput = input("mitten-row-gauge");
  const createBtn = document.getElementById("create-pattern-btn");
  const feedback = document.getElementById("create-pattern-feedback");
  if (!(sizeSelect instanceof HTMLSelectElement) || !(thumbSelect instanceof HTMLSelectElement)) return;
  if (!(stitchInput instanceof HTMLInputElement) || !(rowInput instanceof HTMLInputElement)) return;
  if (!(createBtn instanceof HTMLButtonElement)) return;

  let draft: MittenDraft | null = null;
  let openStep = 1;
  let maxReachable = 1;
  let displayUnit: "inches" | "cm" = "inches";

  function canonicalGauge(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return "";
    if (displayUnit === "cm") return (n * HAT_GAUGE_CM_TO_IN_FACTOR).toFixed(1);
    return trimmed;
  }

  function showGauge(stitchPer4: string, rowPer4: string): void {
    if (displayUnit === "cm") {
      const stitch = Number(stitchPer4);
      const row = Number(rowPer4);
      stitchInput.value = stitch > 0 ? (stitch * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1) : "";
      rowInput.value = row > 0 ? (row * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1) : "";
      return;
    }
    stitchInput.value = stitchPer4;
    rowInput.value = rowPer4;
  }

  function thumbStyle(): MittenThumbStyle | "" {
    return thumbSelect.value === "gored" || thumbSelect.value === "slotted" ? thumbSelect.value : "";
  }

  function persistFromControls(): void {
    const next = draftForBuilderSize({
      sizeId: sizeSelect.value,
      previous: draft,
      stitchGaugePer4: canonicalGauge(stitchInput.value),
      rowGaugePer4: canonicalGauge(rowInput.value),
      thumbStyle: thumbStyle(),
    });
    draft = next;
    if (next) writeMittenDraft(next);
  }

  function stepComplete(step: number): boolean {
    if (step === 1) return mittenSizeStepComplete(sizeSelect.value);
    if (step === 2) return mittenThumbStepComplete(thumbSelect.value);
    return mittenGaugeStepComplete(
      canonicalGauge(stitchInput.value),
      canonicalGauge(rowInput.value),
    );
  }

  function summaryFor(step: number): string {
    if (!stepComplete(step)) return "";
    if (step === 1) return sizeLabel(sizeSelect.value);
    if (step === 2) return thumbLabel(thumbSelect.value);
    return `${canonicalGauge(stitchInput.value)} × ${canonicalGauge(rowInput.value)}`;
  }

  function refresh(): void {
    let reach = 1;
    for (let step = 1; step < STEPS; step += 1) {
      if (!stepComplete(step)) break;
      reach = step + 1;
    }
    if (stepComplete(STEPS)) reach = STEPS;
    maxReachable = reach;
    if (openStep > maxReachable) openStep = maxReachable;

    for (let step = 1; step <= STEPS; step += 1) {
      const section = document.querySelector<HTMLElement>(`[data-express-step="${step}"]`);
      if (!section) continue;
      const locked = step > maxReachable;
      const open = step === openStep && !locked;
      const complete = stepComplete(step);
      section.classList.toggle("express-acc--open", open);
      section.classList.toggle("express-acc--locked", locked);
      section.classList.toggle("express-acc--complete", complete);
      const header = section.querySelector<HTMLElement>("[data-express-header]");
      const body = section.querySelector<HTMLElement>(".express-acc__body");
      const lockedNote = section.querySelector<HTMLElement>("[data-express-locked-feedback]");
      if (header) {
        header.setAttribute("aria-expanded", open ? "true" : "false");
        header.tabIndex = locked ? -1 : 0;
      }
      if (body) body.hidden = !open;
      if (lockedNote) lockedNote.hidden = !locked;
      const key = step === 1 ? "size" : step === 2 ? "thumb" : "gauge";
      const summary = section.querySelector<HTMLElement>(`[data-express-summary="${key}"]`);
      if (summary) summary.textContent = summaryFor(step);
    }

    document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
      const step = Number(btn.getAttribute("data-pill-step") || "0");
      const current = step === openStep;
      btn.classList.toggle("is-current", current);
      btn.classList.toggle("is-upcoming", step > maxReachable);
      btn.classList.toggle("is-complete", stepComplete(step) && !current);
      btn.setAttribute("aria-disabled", step <= maxReachable ? "false" : "true");
      btn.title = step > maxReachable ? "Finish the previous step to continue." : "";
      if (current) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
      btn.closest(".express-step-nav__item")?.classList.toggle("active", current);
    });

    const ready = mittenBuilderReady({
      sizeId: sizeSelect.value,
      thumbStyle: thumbSelect.value,
      stitchGaugePer4: canonicalGauge(stitchInput.value),
      rowGaugePer4: canonicalGauge(rowInput.value),
    });
    createBtn.classList.toggle("button-disabled", !ready);
    if (ready) createBtn.removeAttribute("aria-disabled");
    else createBtn.setAttribute("aria-disabled", "true");
    sizeSelect.closest(".hat-select-wrap")?.classList.toggle("is-complete", stepComplete(1));
    syncChoiceButtons("thumbStyle", thumbSelect.value);
  }

  function goToStep(step: number): void {
    if (step < 1 || step > maxReachable) return;
    openStep = step;
    refresh();
  }

  function showFeedback(message: string): void {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
  }

  function onChange(advance: boolean): void {
    persistFromControls();
    const finished = stepComplete(openStep);
    refresh();
    if (advance && finished && openStep < maxReachable) goToStep(openStep + 1);
  }

  function load(next: MittenDraft | null): void {
    draft = next;
    sizeSelect.value = next?.sizeId ?? "";
    thumbSelect.value = next?.thumbStyle === "gored" || next?.thumbStyle === "slotted" ? next.thumbStyle : "";
    showGauge(next?.stitchGaugePer4 ?? "", next?.rowGaugePer4 ?? "");
    openStep = 1;
    refresh();
    if (stepComplete(1) && !stepComplete(2)) openStep = 2;
    else if (stepComplete(2) && !stepComplete(3)) openStep = 3;
    else if (stepComplete(3)) openStep = 3;
    refresh();
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small") {
    const example = womanSmallExampleDraft();
    writeMittenDraft(example);
    load(example);
  } else {
    load(readMittenDraft());
  }

  sizeSelect.addEventListener("change", () => onChange(true));
  stitchInput.addEventListener("input", () => onChange(false));
  rowInput.addEventListener("input", () => onChange(false));

  document.querySelectorAll<HTMLButtonElement>('[data-choice][data-field="thumbStyle"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-value") ?? "";
      if (value !== "slotted" && value !== "gored") return;
      thumbSelect.value = value;
      onChange(true);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-express-header]").forEach((header) => {
    const activate = () => {
      const step = Number(header.closest("[data-express-step]")?.getAttribute("data-express-step") || "0");
      if (step >= 1 && step <= maxReachable) goToStep(step);
    };
    header.addEventListener("click", activate);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goToStep(Number(btn.getAttribute("data-pill-step") || "0"));
    });
  });

  document.getElementById("mitten-builder-start-over")?.addEventListener("click", () => {
    localStorage.removeItem(MITTEN_DRAFT_STORAGE_KEY);
    displayUnit = "inches";
    load(null);
    showFeedback("");
  });

  window.addEventListener("kbm:units-change", ((event: CustomEvent<{ unit?: string; toggleId?: string }>) => {
    if (event.detail?.toggleId && event.detail.toggleId !== "mitten") return;
    const next = event.detail?.unit === "cm" ? "cm" : "inches";
    if (next === displayUnit) return;
    persistFromControls();
    displayUnit = next;
    showGauge(draft?.stitchGaugePer4 ?? "", draft?.rowGaugePer4 ?? "");
    refresh();
  }) as EventListener);

  createBtn.addEventListener("click", () => {
    persistFromControls();
    if (createBtn.getAttribute("aria-disabled") === "true" || !draft) {
      showFeedback("Choose a size, a thumb, and your gauge before you continue.");
      return;
    }
    const result = calculateMittenPattern(mittenInputFromDraft(draft));
    if (!result.ok) {
      showFeedback(result.message);
      return;
    }
    writeMittenDraft(draft);
    window.location.assign(`${MITTEN_SUMMARY_HREF}?generated=1`);
  });
}
