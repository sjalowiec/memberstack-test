/**
 * Shared pattern-print choices. The browser print dialog still prints or saves the PDF.
 */

export const PATTERN_PRINT_CHOICES = [
  {
    id: "instructions",
    title: "Instructions only",
    explanation: "Instructions, notes, and schematics. No charts or checklists.",
  },
  {
    id: "charts",
    title: "Charts & checklists only",
    explanation: "Charts and checklists. No pattern instructions.",
  },
  {
    id: "both",
    title: "Complete pattern",
    explanation: "Instructions, notes, schematics, charts, and checklists.",
  },
] as const;

export type PatternPrintChoice = (typeof PATTERN_PRINT_CHOICES)[number]["id"];

export const PATTERN_PRINT_HIDE_TIPS_LABEL = "Hide Pattern Tips";

export const PATTERN_PRINT_HIDE_TIPS_HELP = "Uncheck to include tips.";

export type PatternPrintSelection = {
  choice: PatternPrintChoice;
  includeTips: boolean;
};

export const PATTERN_PRINT_CHOICE_REMINDER =
  "You can also follow your pattern on a computer, tablet, or phone beside your knitting machine, with access to videos and interactive help.";

export const PATTERN_PRINT_CHOICE_PDF_NOTE =
  "The next step is your computer's print dialog. You can print the pattern or save it as a PDF.";

export function isPatternPrintChoice(value: string): value is PatternPrintChoice {
  return PATTERN_PRINT_CHOICES.some((choice) => choice.id === value);
}
