/**
 * Shared pattern-print choices. The browser print dialog still prints or saves the PDF.
 */

export const PATTERN_PRINT_CHOICES = [
  {
    id: "instructions",
    title: "Instructions only",
    explanation:
      "Project title, pattern details, saved notes, measurement schematics, and the complete knitting and finishing instructions. Shaping maps, row-by-row charts, and checklists are left out. Where the pattern would say to use a checklist, the print includes written shaping from the same calculated rows.",
  },
  {
    id: "charts",
    title: "Charts and checklists only",
    explanation:
      "The charts and checklists for this saved pattern. Each one starts on a new page and names the project, the garment piece, and the setup needed to use it. Knitting instructions are not included.",
  },
  {
    id: "both",
    title: "Instructions + charts and checklists",
    explanation:
      "The complete instructions first, then a charts and checklists section. Each chart is printed once, after the instructions.",
  },
] as const;

export type PatternPrintChoice = (typeof PATTERN_PRINT_CHOICES)[number]["id"];

export const PATTERN_PRINT_CHOICE_REMINDER =
  "You can also follow your pattern on a computer, tablet, or phone beside your knitting machine, with access to videos and interactive help.";

export const PATTERN_PRINT_CHOICE_PDF_NOTE =
  "The next step is your computer's print dialog. You can print the pattern or save it as a PDF.";

export function isPatternPrintChoice(value: string): value is PatternPrintChoice {
  return PATTERN_PRINT_CHOICES.some((choice) => choice.id === value);
}
