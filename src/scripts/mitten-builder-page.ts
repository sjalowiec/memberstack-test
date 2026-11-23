import { calculateMittenPattern, type MittenCalcResult } from "../lib/patterns/mitten/mittenMath";
import {
  draftFromSizingRow,
  mittenInputFromDraft,
  readMittenDraft,
  womanSmallExampleDraft,
  writeMittenDraft,
  MITTEN_SUMMARY_HREF,
  type MittenDraft,
} from "../lib/patterns/mitten/mittenDraft";
import { mittenSizingRow, type MittenSizingRow } from "../lib/patterns/mitten/mittenSizingChart";

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

function input(id: string): HTMLInputElement | HTMLSelectElement | null {
  const node = document.getElementById(id);
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) return node;
  return null;
}

function value(id: string): string {
  return input(id)?.value.trim() ?? "";
}

export function readMittenFormDraft(): MittenDraft {
  const stored = readMittenDraft();
  const nameField = input("mitten-pattern-name");
  const title = nameField ? nameField.value.trim() : stored?.patternProject?.title;
  return {
    version: 1,
    patternType: "mittens",
    patternSystem: "mittens",
    sizeId: value(FIELD_IDS.size),
    cuffCircumference: value(FIELD_IDS.cuffCircumference),
    cuffLength: value(FIELD_IDS.cuffLength),
    handCircumference: value(FIELD_IDS.handCircumference),
    handLength: value(FIELD_IDS.handLength),
    hand2Length: value(FIELD_IDS.hand2Length),
    thumbLength: value(FIELD_IDS.thumbLength),
    thumbCircumference: value(FIELD_IDS.thumbCircumference),
    thumbStyle: value(FIELD_IDS.thumbStyle) === "gored" ? "gored" : "slotted",
    stitchGaugePer4: value(FIELD_IDS.stitchGaugePer4),
    rowGaugePer4: value(FIELD_IDS.rowGaugePer4),
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
    thumbStyle: draft.thumbStyle === "gored" ? "gored" : "slotted",
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

export function initMittenBuilderPage(): void {
  const root = document.querySelector("[data-mitten-builder]");
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("example") === "woman-small") {
    fillMittenForm(womanSmallExampleDraft());
  } else {
    const saved = readMittenDraft();
    if (saved) fillMittenForm(saved);
  }

  bindMittenSizeAutofill();

  document.getElementById("create-pattern-btn")?.addEventListener("click", () => {
    const feedback = document.getElementById("create-pattern-feedback");
    const result = evaluateMittenForm();
    if (!result.ok) {
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = result.message;
      }
      return;
    }
    writeMittenDraft(readMittenFormDraft());
    window.location.assign(`${MITTEN_SUMMARY_HREF}?generated=1`);
  });
}
