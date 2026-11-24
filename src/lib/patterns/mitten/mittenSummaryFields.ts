import type { PatternSummaryMeasurementField } from "../patternSummaryMeasurementField";
import { MITTEN_SUMMARY_TARGETS } from "./mittenDiagramSvg";

const MEASURE = {
  inputType: "number" as const,
  inputMode: "decimal",
  step: "0.01",
  min: "0",
  unitSuffixAttr: "data-mitten-edit-unit-suffix",
  editable: true,
};

/** Chips sit outside the summary anchors. The diagram is drawn thumb-right. */
const BESIDE_LENGTH = "translate(calc(-100% - 10px), -50%)";
const BESIDE_THUMB = "translate(10px, -50%)";
const ABOVE = "translate(-50%, calc(-100% - 10px))";
const BELOW = "translate(-50%, 10px)";

export const MITTEN_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...MEASURE,
    id: "cuff-circ",
    label: "Cuff circumference",
    targetId: MITTEN_SUMMARY_TARGETS.cuffCircumference,
    transform: BELOW,
    inputId: "mitten-cuff-circ",
    inputDataAttr: "data-mitten-edit-cuff-circ",
    testId: "mitten-edit-chip-cuff-circ",
    inputTestId: "mitten-edit-cuff-circ",
  },
  {
    ...MEASURE,
    id: "cuff-length",
    label: "Cuff length",
    targetId: MITTEN_SUMMARY_TARGETS.cuffLength,
    transform: BESIDE_LENGTH,
    inputId: "mitten-cuff-length",
    inputDataAttr: "data-mitten-edit-cuff-length",
    testId: "mitten-edit-chip-cuff-length",
    inputTestId: "mitten-edit-cuff-length",
  },
  {
    ...MEASURE,
    id: "hand-circ",
    label: "Hand circumference",
    targetId: MITTEN_SUMMARY_TARGETS.handCircumference,
    transform: ABOVE,
    inputId: "mitten-hand-circ",
    inputDataAttr: "data-mitten-edit-hand-circ",
    testId: "mitten-edit-chip-hand-circ",
    inputTestId: "mitten-edit-hand-circ",
  },
  {
    ...MEASURE,
    id: "hand-length",
    label: "Hand length",
    targetId: MITTEN_SUMMARY_TARGETS.handLength,
    transform: BESIDE_LENGTH,
    inputId: "mitten-hand-length",
    inputDataAttr: "data-mitten-edit-hand-length",
    testId: "mitten-edit-chip-hand-length",
    inputTestId: "mitten-edit-hand-length",
  },
  {
    ...MEASURE,
    id: "hand2",
    label: "Hand above the thumb",
    targetId: MITTEN_SUMMARY_TARGETS.hand2Length,
    transform: BESIDE_LENGTH,
    inputId: "mitten-hand2",
    inputDataAttr: "data-mitten-edit-hand2",
    testId: "mitten-edit-chip-hand2",
    inputTestId: "mitten-edit-hand2",
  },
  {
    ...MEASURE,
    id: "thumb-length",
    label: "Thumb length",
    targetId: MITTEN_SUMMARY_TARGETS.thumbLength,
    transform: BESIDE_THUMB,
    inputId: "mitten-thumb-length",
    inputDataAttr: "data-mitten-edit-thumb-length",
    testId: "mitten-edit-chip-thumb-length",
    inputTestId: "mitten-edit-thumb-length",
  },
  {
    ...MEASURE,
    id: "thumb-circ",
    label: "Thumb circumference",
    targetId: MITTEN_SUMMARY_TARGETS.thumbCircumference,
    transform: BESIDE_THUMB,
    inputId: "mitten-thumb-circ",
    inputDataAttr: "data-mitten-edit-thumb-circ",
    testId: "mitten-edit-chip-thumb-circ",
    inputTestId: "mitten-edit-thumb-circ",
  },
];
