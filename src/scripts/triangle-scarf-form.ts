/**
 * DOM helpers shared by the Triangle Scarf builder and Summary/Edit page.
 * Field ids match TriangleScarfSetupFields.
 */

import { bindAvailableNeedlesFieldValidation } from "../lib/patterns/availableNeedlesFieldValidation";
import {
  TRIANGLE_SCARF_DEPTH_ID,
  TRIANGLE_SCARF_DEPTH_LABEL_ID,
  TRIANGLE_SCARF_LENGTH_ID,
  TRIANGLE_SCARF_LENGTH_LABEL_ID,
  TRIANGLE_SCARF_NEEDLES_ID,
  TRIANGLE_SCARF_ROW_GAUGE_ID,
  TRIANGLE_SCARF_STITCH_GAUGE_ID,
  TRIANGLE_SCARF_UNIT_TOGGLE_ID,
  triangleScarfDraftFromFields,
  type TriangleScarfFormFields,
} from "../lib/patterns/triangleScarf/triangleScarfForm";
import {
  readTriangleScarfDraft,
  writeTriangleScarfDraft,
  type TriangleScarfDraft,
} from "../lib/patterns/triangleScarf/triangleScarfDraft";
import type { TriangleUnit } from "../lib/patterns/triangleScarfMath";

function inputById(id: string): HTMLInputElement | null {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
}

export function triangleScarfLengthInput(): HTMLInputElement | null {
  return inputById(TRIANGLE_SCARF_LENGTH_ID);
}

export function triangleScarfDepthInput(): HTMLInputElement | null {
  return inputById(TRIANGLE_SCARF_DEPTH_ID);
}

export function triangleScarfNeedlesInput(): HTMLInputElement | null {
  return inputById(TRIANGLE_SCARF_NEEDLES_ID);
}

export function readTriangleScarfUnit(): TriangleUnit {
  const pressed = document.querySelector(
    `[data-unit-toggle="${TRIANGLE_SCARF_UNIT_TOGGLE_ID}"] button[aria-pressed="true"]`,
  );
  return pressed instanceof HTMLButtonElement && pressed.dataset.unit === "cm" ? "cm" : "in";
}

export function readTriangleScarfFormFields(): TriangleScarfFormFields {
  return {
    length: triangleScarfLengthInput()?.value ?? "",
    depth: triangleScarfDepthInput()?.value ?? "",
    stitchGauge: inputById(TRIANGLE_SCARF_STITCH_GAUGE_ID)?.value ?? "",
    rowGauge: inputById(TRIANGLE_SCARF_ROW_GAUGE_ID)?.value ?? "",
    needles: triangleScarfNeedlesInput()?.value ?? "",
    unit: readTriangleScarfUnit(),
  };
}

export function updateTriangleScarfDimensionLabels(unit: TriangleUnit = readTriangleScarfUnit()): void {
  const mark = unit === "cm" ? "cm" : "in";
  const lengthLabel = document.getElementById(TRIANGLE_SCARF_LENGTH_LABEL_ID);
  const depthLabel = document.getElementById(TRIANGLE_SCARF_DEPTH_LABEL_ID);
  if (lengthLabel) lengthLabel.textContent = `Point-to-point length (${mark})`;
  if (depthLabel) depthLabel.textContent = `Scarf depth (${mark})`;
}

function setInputValue(input: HTMLInputElement | null, value: string): void {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function applyTriangleScarfFields(fields: TriangleScarfFormFields): void {
  setInputValue(triangleScarfLengthInput(), fields.length);
  setInputValue(triangleScarfDepthInput(), fields.depth);
  setInputValue(inputById(TRIANGLE_SCARF_STITCH_GAUGE_ID), fields.stitchGauge);
  setInputValue(inputById(TRIANGLE_SCARF_ROW_GAUGE_ID), fields.rowGauge);
  setInputValue(triangleScarfNeedlesInput(), fields.needles);
  const unitButton = document.querySelector(
    `[data-unit-toggle="${TRIANGLE_SCARF_UNIT_TOGGLE_ID}"] button[data-unit="${fields.unit}"]`,
  );
  if (unitButton instanceof HTMLButtonElement && unitButton.getAttribute("aria-pressed") !== "true") {
    unitButton.click();
  }
  updateTriangleScarfDimensionLabels(fields.unit);
  syncTriangleScarfPresetHighlight();
}

export function syncTriangleScarfPresetHighlight(): void {
  const length = triangleScarfLengthInput()?.value.trim() ?? "";
  const depth = triangleScarfDepthInput()?.value.trim() ?? "";
  document.querySelectorAll("[data-triangle-scarf-preset]").forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) return;
    node.classList.toggle("active", node.dataset.length === length && node.dataset.depth === depth);
  });
}

export function clearTriangleScarfFields(): void {
  applyTriangleScarfFields({
    length: "",
    depth: "",
    stitchGauge: "",
    rowGauge: "",
    needles: "",
    unit: "in",
  });
  const inches = document.querySelector(
    `[data-unit-toggle="${TRIANGLE_SCARF_UNIT_TOGGLE_ID}"] button[data-unit="in"]`,
  );
  if (inches instanceof HTMLButtonElement && inches.getAttribute("aria-pressed") !== "true") {
    inches.click();
  }
}

export function saveTriangleScarfFormDraft(): TriangleScarfDraft {
  const draft = triangleScarfDraftFromFields(readTriangleScarfFormFields(), readTriangleScarfDraft());
  writeTriangleScarfDraft(draft);
  return draft;
}

export function bindTriangleScarfFieldChrome(onChange?: () => void): void {
  bindAvailableNeedlesFieldValidation(triangleScarfNeedlesInput());
  const notify = () => {
    syncTriangleScarfPresetHighlight();
    updateTriangleScarfDimensionLabels();
    onChange?.();
  };
  [
    triangleScarfLengthInput(),
    triangleScarfDepthInput(),
    triangleScarfNeedlesInput(),
    inputById(TRIANGLE_SCARF_STITCH_GAUGE_ID),
    inputById(TRIANGLE_SCARF_ROW_GAUGE_ID),
  ].forEach((input) => input?.addEventListener("input", notify));

  document.querySelectorAll("[data-triangle-scarf-preset]").forEach((node) => {
    node.addEventListener("click", () => {
      if (!(node instanceof HTMLButtonElement)) return;
      setInputValue(triangleScarfLengthInput(), node.dataset.length ?? "");
      setInputValue(triangleScarfDepthInput(), node.dataset.depth ?? "");
      notify();
    });
  });

  window.addEventListener("kbm:units-change", () => {
    updateTriangleScarfDimensionLabels();
    onChange?.();
  });
}

export function showTriangleScarfFormError(message: string): void {
  const el = document.querySelector("[data-triangle-scarf-form-error]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.hidden = !message;
}

export function fieldsFromSearchParams(search: string): Partial<TriangleScarfFormFields> | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const keys = ["w", "l", "sg", "rg", "n", "u"];
  if (!keys.some((key) => params.has(key))) return null;
  const unit: TriangleUnit = params.get("u") === "cm" ? "cm" : "in";
  return {
    depth: params.get("w") ?? "",
    length: params.get("l") ?? "",
    stitchGauge: params.get("sg") ?? "",
    rowGauge: params.get("rg") ?? "",
    needles: params.get("n") ?? "",
    unit,
  };
}
