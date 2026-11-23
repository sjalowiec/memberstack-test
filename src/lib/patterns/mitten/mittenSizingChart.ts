/**
 * KIN mitten sizing chart.
 * Thumb length is web to tip for a slotted thumb and a gored thumb.
 * That definition is approved. Gore shaping is below the web and is not part of thumb length.
 * A slotted thumb is not lengthened because it has no gore.
 * Women's sizes use 2.4 inches. Men's sizes use 2.6 inches.
 * Child 2–4 and Child 4–6 use 1.8 inches. Child 6–8 uses 2.0 inches.
 * Original chart columns are the body measurements, thumb length, and thumb opening.
 * `thumbCircumferenceInches` is a temporary comparison value. Those defaults still need to be checked.
 */
export type MittenSizingRow = {
  size: string;
  label: string;
  cuffCircumferenceInches: number;
  cuffLengthInches: number;
  handCircumferenceInches: number;
  handLengthInches: number;
  /**
   * Web to tip. Chart defaults are the approved lengths for these labels.
   */
  thumbLengthInches: number;
  thumbLengthInches: number;
  /** Original chart column. Not used for slotted-thumb sizing. */
  thumbOpeningInches: number;
  /** Temporary comparison value. Not an original chart column. Not verified. */
  thumbCircumferenceInches: number;
};

export const MITTEN_SIZING_CHART: readonly MittenSizingRow[] = [
  {
    size: "child_2_4",
    label: "Child 2–4",
    cuffCircumferenceInches: 5,
    cuffLengthInches: 1.75,
    handCircumferenceInches: 5.5,
    handLengthInches: 4,
    thumbLengthInches: 1.8,
    thumbOpeningInches: 1.25,
    thumbCircumferenceInches: 2,
  },
  {
    size: "child_4_6",
    label: "Child 4–6",
    cuffCircumferenceInches: 5.5,
    cuffLengthInches: 2.25,
    handCircumferenceInches: 6,
    handLengthInches: 4.75,
    thumbLengthInches: 1.8,
    thumbOpeningInches: 1.5,
    thumbCircumferenceInches: 2.5,
  },
  {
    size: "child_6_8",
    label: "Child 6–8",
    cuffCircumferenceInches: 6,
    cuffLengthInches: 2.5,
    handCircumferenceInches: 6.5,
    handLengthInches: 5.25,
    thumbLengthInches: 2,
    thumbOpeningInches: 1.5,
    thumbCircumferenceInches: 2.5,
  },
  {
    size: "woman_sm",
    label: "Woman Small",
    cuffCircumferenceInches: 6.5,
    cuffLengthInches: 2.5,
    handCircumferenceInches: 7,
    handLengthInches: 6,
    thumbLengthInches: 2.4,
    thumbOpeningInches: 1.75,
    thumbCircumferenceInches: 2.75,
  },
  {
    size: "woman_lg",
    label: "Woman Large",
    cuffCircumferenceInches: 7,
    cuffLengthInches: 2.75,
    handCircumferenceInches: 7.5,
    handLengthInches: 6.5,
    thumbLengthInches: 2.4,
    thumbOpeningInches: 2,
    thumbCircumferenceInches: 3.25,
  },
  {
    size: "man_sm",
    label: "Man Small",
    cuffCircumferenceInches: 7.5,
    cuffLengthInches: 2.75,
    handCircumferenceInches: 8,
    handLengthInches: 7.25,
    thumbLengthInches: 2.6,
    thumbOpeningInches: 2.25,
    thumbCircumferenceInches: 3.25,
  },
  {
    size: "man_med",
    label: "Man Medium",
    cuffCircumferenceInches: 8,
    cuffLengthInches: 3,
    handCircumferenceInches: 8.5,
    handLengthInches: 7.75,
    thumbLengthInches: 2.6,
    thumbOpeningInches: 2.5,
    thumbCircumferenceInches: 3.5,
  },
  {
    size: "man_lg",
    label: "Man Large",
    cuffCircumferenceInches: 8.5,
    cuffLengthInches: 3,
    handCircumferenceInches: 9,
    handLengthInches: 8.5,
    thumbLengthInches: 2.6,
    thumbOpeningInches: 2.75,
    thumbCircumferenceInches: 3.5,
  },
];

/** Web to tip. Same measurement for slotted and gored thumbs. */
export const THUMB_LENGTH_ENDPOINT = "thumb web to thumb tip";

export const THUMB_LENGTH_DEFINITION =
  "Thumb length is from the thumb web to the thumb tip. A gore is separate shaping below the web and is not added to this length. A slotted thumb uses the same length.";

/** Approved defaults. Children's chart rows are not these age groups. */
export const APPROVED_THUMB_LENGTH_INCHES = {
  children3to5: 1.8,
  children6to9: 2,
  children9to12: 2.2,
  women: 2.4,
  men: 2.6,
} as const;

export const CHILD_THUMB_LENGTH_ASSIGNMENT =
  "Child 2–4 and Child 4–6 use 1.8 inches. Child 6–8 uses 2.0 inches. This chart has no Child 9–12 size, so 2.2 inches is not assigned.";

export const THUMB_VALUE_SOURCES =
  "Women's sizes use 2.4 inches and men's sizes use 2.6 inches. " +
  CHILD_THUMB_LENGTH_ASSIGNMENT +
  " Thumb circumference is a temporary comparison value, and those defaults still need to be checked.";

export function mittenSizingRow(size: string): MittenSizingRow | null {
  return MITTEN_SIZING_CHART.find((row) => row.size === size) ?? null;
}

/** Robin Hansen's provisional default: two-thirds of the hand length. */
export function defaultHand2LengthInches(handLengthInches: number): number {
  if (!(handLengthInches > 0)) return 0;
  return Math.round(((handLengthInches * 2) / 3) * 100) / 100;
}
