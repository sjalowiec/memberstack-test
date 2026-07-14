export const SWEATER_SIZING_CHART_INTRO_SENTENCE =
  "Body measurements used by the Sleeveless and Drop Shoulder pattern builders.";

export const SWEATER_SIZING_CHART_CALLOUT_BULLETS = [
  {
    term: "Body measurement",
    description:
      "Your actual bust or chest measurement. Use the closest measurement in the chart to select your pattern size.",
  },
  {
    term: "Finished sweater measurement",
    description:
      "The sweater measurement after the selected fit and ease are applied. If this value is changed in the custom builder, the edited value becomes the final measurement and ease must not be added again.",
  },
] as const;

/** Legacy four-paragraph intro copy removed from the sizing chart callout. */
export const LEGACY_SWEATER_SIZING_CHART_INTRO_COPY = [
  "how you measure yourself, not the finished sweater",
  "That body measurement becomes your",
  "calculated separately from your selected size",
  "If you change a finished measurement in the custom builder, that value replaces the calculated one",
  "ease is not added a second time",
] as const;
